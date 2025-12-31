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
}

interface AsaasWebhookEvent {
  event: string;
  payment: AsaasWebhookPayment;
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
    
    const webhookData: AsaasWebhookEvent = await req.json();
    console.log('Webhook event:', webhookData.event);
    console.log('Payment data:', JSON.stringify(webhookData.payment));
    
    const { event, payment } = webhookData;
    
    // Only process payment events
    if (!event.startsWith('PAYMENT_')) {
      console.log('Ignoring non-payment event:', event);
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Find the transaction by Asaas ID
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*, bitrix_entity_id, bitrix_entity_type, tenant_id')
      .eq('asaas_id', payment.id)
      .single();
    
    if (findError || !transaction) {
      console.log('Transaction not found for Asaas ID:', payment.id);
      // Try to find by external reference
      if (payment.externalReference?.startsWith('bitrix_')) {
        const parts = payment.externalReference.split('_');
        const orderId = parts[1];
        const { data: txByRef } = await supabase
          .from('transactions')
          .select('*')
          .eq('bitrix_entity_id', orderId)
          .single();
        
        if (txByRef) {
          // Update with Asaas ID
          await supabase
            .from('transactions')
            .update({ asaas_id: payment.id })
            .eq('id', txByRef.id);
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Transaction not found, webhook logged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      tenant_id: transaction.tenant_id,
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
        .eq('tenant_id', transaction.tenant_id)
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
