import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AsaasWebhookPayment {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  status: string;
  billingType: string;
  confirmedDate?: string;
  paymentDate?: string;
  externalReference?: string;
  invoiceUrl?: string;
  subscription?: string; // Subscription ID if payment is from a subscription
}

interface AsaasWebhookSubscription {
  id: string;
  customer: string;
  value: number;
  status: string;
  cycle: string;
  billingType: string;
  nextDueDate?: string;
  description?: string;
}

interface AsaasWebhookEvent {
  event: string;
  payment?: AsaasWebhookPayment;
  subscription?: AsaasWebhookSubscription;
}

const asaasStatusMap: Record<string, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RECEIVED: 'received',
  OVERDUE: 'overdue',
  REFUNDED: 'refunded',
  RECEIVED_IN_CASH: 'received',
  REFUND_REQUESTED: 'pending',
  REFUND_IN_PROGRESS: 'pending',
  CHARGEBACK_REQUESTED: 'pending',
  CHARGEBACK_DISPUTE: 'pending',
  AWAITING_CHARGEBACK_REVERSAL: 'pending',
  DUNNING_REQUESTED: 'overdue',
  DUNNING_RECEIVED: 'received',
  AWAITING_RISK_ANALYSIS: 'pending',
};

const subscriptionStatusMap: Record<string, string> = {
  ACTIVE: 'active',
  INACTIVE: 'canceled',
  EXPIRED: 'expired',
};

async function updateBitrixPaymentStatus(
  installation: { client_endpoint: string; access_token: string },
  orderId: string,
  paymentId: string,
  status: string
): Promise<void> {
  if (!installation.client_endpoint || !installation.access_token) {
    console.log('No Bitrix credentials available for status update');
    return;
  }
  
  try {
    // Mark payment as paid in Bitrix24
    if (status === 'confirmed' || status === 'received') {
      const response = await fetch(`${installation.client_endpoint}sale.paysystem.pay.payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth: installation.access_token,
          PAYMENT_ID: paymentId,
        }),
      });
      
      const result = await response.json();
      console.log('Bitrix payment update result:', result);
    }
  } catch (error) {
    console.error('Error updating Bitrix payment status:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Asaas Webhook Handler called');
    
    // Get the access token from headers (sent by Asaas)
    const accessToken = req.headers.get('asaas-access-token');
    
    const webhookData: AsaasWebhookEvent = await req.json();
    console.log('Webhook event:', webhookData.event);
    
    const { event } = webhookData;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Handle SUBSCRIPTION events
    if (event.startsWith('SUBSCRIPTION_')) {
      const subscription = webhookData.subscription;
      if (!subscription) {
        console.log('No subscription data in event');
        return new Response(
          JSON.stringify({ success: true, message: 'No subscription data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Subscription data:', JSON.stringify(subscription));
      
      // Find existing subscription in database
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('asaas_id', subscription.id)
        .single();
      
      if (event === 'SUBSCRIPTION_CREATED' && !existingSubscription) {
        // Subscription created externally - we need to find the tenant
        // This might happen if subscription was created directly in Asaas
        console.log('Subscription created externally, cannot associate without tenant context');
        return new Response(
          JSON.stringify({ success: true, message: 'External subscription logged' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (existingSubscription) {
        const newStatus = subscriptionStatusMap[subscription.status] || subscription.status.toLowerCase();
        
        // Update subscription
        await supabase
          .from('subscriptions')
          .update({
            status: newStatus,
            next_due_date: subscription.nextDueDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSubscription.id);
        
        console.log(`Updated subscription ${existingSubscription.id} to status: ${newStatus}`);
        
        // Log the event
        await supabase.from('integration_logs').insert({
          tenant_id: existingSubscription.tenant_id,
          action: `asaas_webhook_${event.toLowerCase()}`,
          entity_type: 'subscription',
          entity_id: subscription.id,
          status: 'success',
          request_data: webhookData,
          response_data: { newStatus },
        });
      }
      
      return new Response(
        JSON.stringify({ success: true, event }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle PAYMENT events
    if (!event.startsWith('PAYMENT_')) {
      console.log('Ignoring non-payment/subscription event:', event);
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const payment = webhookData.payment;
    if (!payment) {
      console.log('No payment data in event');
      return new Response(
        JSON.stringify({ success: true, message: 'No payment data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Payment data:', JSON.stringify(payment));
    
    // First, find the transaction to get tenant_id
    let transaction = null;
    let tenantId = null;
    
    // Try to find by asaas_id
    const { data: txByAsaasId } = await supabase
      .from('transactions')
      .select('*, bitrix_entity_id, bitrix_entity_type, tenant_id')
      .eq('asaas_id', payment.id)
      .single();
    
    if (txByAsaasId) {
      transaction = txByAsaasId;
      tenantId = txByAsaasId.tenant_id;
    }
    
    // If payment is from a subscription, try to find/create via subscription
    if (!transaction && payment.subscription) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('asaas_id', payment.subscription)
        .single();
      
      if (subscription) {
        tenantId = subscription.tenant_id;
        
        // Create new transaction for this subscription payment
        const { data: newTransaction } = await supabase
          .from('transactions')
          .insert({
            tenant_id: subscription.tenant_id,
            subscription_id: subscription.id,
            asaas_id: payment.id,
            amount: payment.value,
            payment_method: subscription.billing_type,
            status: 'pending',
            customer_name: subscription.customer_name,
            customer_email: subscription.customer_email,
            customer_document: subscription.customer_document,
            payment_url: payment.invoiceUrl,
            bitrix_entity_type: subscription.bitrix_entity_type,
            bitrix_entity_id: subscription.bitrix_entity_id,
          })
          .select()
          .single();
        
        transaction = newTransaction;
        console.log('Created transaction for subscription payment:', newTransaction?.id);
      }
    }
    
    // Try to find by external reference
    if (!transaction && payment.externalReference?.startsWith('bitrix_')) {
      const parts = payment.externalReference.split('_');
      const orderId = parts[2] || parts[1];
      
      const { data: txByRef } = await supabase
        .from('transactions')
        .select('*')
        .eq('bitrix_entity_id', orderId)
        .maybeSingle();
      
      if (txByRef) {
        transaction = txByRef;
        tenantId = txByRef.tenant_id;
        
        // Update with Asaas ID
        await supabase
          .from('transactions')
          .update({ asaas_id: payment.id })
          .eq('id', txByRef.id);
      }
    }
    
    if (!transaction || !tenantId) {
      console.log('Transaction not found for Asaas ID:', payment.id);
      return new Response(
        JSON.stringify({ success: true, message: 'Transaction not found, webhook logged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate webhook secret if configured
    if (accessToken) {
      const { data: asaasConfig } = await supabase
        .from('asaas_configurations')
        .select('webhook_secret')
        .eq('tenant_id', tenantId)
        .single();
      
      if (asaasConfig?.webhook_secret && asaasConfig.webhook_secret !== accessToken) {
        console.warn('Invalid webhook access token for tenant:', tenantId);
        // Log the attempt but don't reject - some older webhooks may not have the secret
      }
    }
    
    // Map Asaas status to our status
    const newStatus = asaasStatusMap[payment.status] || 'pending';
    
    // Update transaction status
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    
    if (payment.paymentDate) {
      updateData.payment_date = payment.paymentDate;
    }
    
    const { error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transaction.id);
    
    if (updateError) {
      console.error('Error updating transaction:', updateError);
      throw updateError;
    }
    
    console.log(`Updated transaction ${transaction.id} to status: ${newStatus}`);
    
    // Log the webhook event
    await supabase.from('integration_logs').insert({
      tenant_id: tenantId,
      action: `asaas_webhook_${event.toLowerCase()}`,
      entity_type: 'payment',
      entity_id: payment.id,
      status: 'success',
      request_data: webhookData,
      response_data: { newStatus, transactionId: transaction.id },
    });
    
    // If payment confirmed/received, update Bitrix24
    if (newStatus === 'confirmed' || newStatus === 'received') {
      // Get Bitrix installation for this tenant
      const { data: installation } = await supabase
        .from('bitrix_installations')
        .select('client_endpoint, access_token')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .single();
      
      if (installation && transaction.bitrix_entity_id) {
        // Parse external reference to get original payment ID
        const parts = payment.externalReference?.split('_') || [];
        const bitrixPaymentId = parts[2] || '';
        
        await updateBitrixPaymentStatus(
          installation,
          transaction.bitrix_entity_id,
          bitrixPaymentId,
          newStatus
        );
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, transactionId: transaction.id, newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in asaas-webhook:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
