import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SubscriptionRequest {
  action: 'create' | 'cancel' | 'list';
  tenant_id?: string;
  member_id?: string;
  subscription_id?: string;
  customer?: {
    name: string;
    email: string;
    cpfCnpj: string;
  };
  value?: number;
  cycle?: string;
  billing_type?: string;
  next_due_date?: string;
  description?: string;
  bitrix_entity_type?: string;
  bitrix_entity_id?: string;
}

function getAsaasBaseUrl(environment: string): string {
  return environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';
}

async function findOrCreateCustomer(apiKey: string, baseUrl: string, data: { name: string; email: string; cpfCnpj: string }) {
  console.log('[Asaas] Finding or creating customer:', data.cpfCnpj);
  
  const cleanCpfCnpj = data.cpfCnpj.replace(/\D/g, '');
  
  // Search for existing customer
  const searchResponse = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanCpfCnpj}`, {
    headers: { 'access_token': apiKey },
  });
  
  const searchResult = await searchResponse.json();
  
  if (searchResult.data && searchResult.data.length > 0) {
    console.log('[Asaas] Found existing customer:', searchResult.data[0].id);
    return searchResult.data[0];
  }
  
  // Create new customer
  const createResponse = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: data.name || 'Cliente',
      email: data.email,
      cpfCnpj: cleanCpfCnpj,
    }),
  });
  
  const customer = await createResponse.json();
  console.log('[Asaas] Created new customer:', customer.id);
  return customer;
}

interface SplitConfig {
  wallet_id: string;
  split_type: 'fixed' | 'percentage';
  split_value: number;
}

async function createSubscription(
  apiKey: string,
  baseUrl: string,
  customerId: string,
  value: number,
  cycle: string,
  billingType: string,
  nextDueDate: string,
  description: string,
  splitConfigs?: SplitConfig[]
) {
  console.log('[Asaas] Creating subscription:', { customerId, value, cycle, billingType });
  
  const subscriptionData: Record<string, unknown> = {
    customer: customerId,
    billingType: billingType.toUpperCase(),
    value,
    cycle: cycle.toUpperCase(),
    nextDueDate,
    description,
  };
  
  // Add splits if configured
  if (splitConfigs && splitConfigs.length > 0) {
    subscriptionData.split = splitConfigs.map(config => ({
      walletId: config.wallet_id,
      ...(config.split_type === 'fixed' 
        ? { fixedValue: config.split_value }
        : { percentualValue: config.split_value }),
    }));
    console.log('[Asaas] Subscription splits:', JSON.stringify(subscriptionData.split));
  }
  
  const response = await fetch(`${baseUrl}/subscriptions`, {
    method: 'POST',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscriptionData),
  });
  
  const subscription = await response.json();
  console.log('[Asaas] Subscription created:', subscription.id, subscription.status);
  
  return subscription;
}

async function cancelSubscription(apiKey: string, baseUrl: string, subscriptionId: string) {
  console.log('[Asaas] Canceling subscription:', subscriptionId);
  
  const response = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: { 'access_token': apiKey },
  });
  
  if (response.ok) {
    console.log('[Asaas] Subscription canceled successfully');
    return { success: true };
  }
  
  const error = await response.json();
  console.error('[Asaas] Failed to cancel subscription:', error);
  return error;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Subscription Process called');
    
    // Handle GET requests (marketplace validation)
    if (req.method === 'GET') {
      return new Response('OK', { headers: corsHeaders });
    }
    
    const requestData: SubscriptionRequest = await req.json();
    console.log('Request data:', JSON.stringify(requestData));
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get tenant from member_id or tenant_id
    let tenantId = requestData.tenant_id;
    
    if (!tenantId && requestData.member_id) {
      const { data: installation } = await supabase
        .from('bitrix_installations')
        .select('tenant_id')
        .eq('member_id', requestData.member_id)
        .single();
      
      tenantId = installation?.tenant_id;
    }
    
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get Asaas configuration
    const { data: asaasConfig, error: asaasError } = await supabase
      .from('asaas_configurations')
      .select('api_key, environment')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();
    
    if (asaasError || !asaasConfig?.api_key) {
      return new Response(
        JSON.stringify({ error: 'Asaas not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const baseUrl = getAsaasBaseUrl(asaasConfig.environment);
    
    switch (requestData.action) {
      case 'create': {
        if (!requestData.customer || !requestData.value || !requestData.cycle || !requestData.billing_type) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: customer, value, cycle, billing_type' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Find or create customer
        const customer = await findOrCreateCustomer(asaasConfig.api_key, baseUrl, requestData.customer);
        
        if (customer.errors) {
          return new Response(
            JSON.stringify({ error: customer.errors[0]?.description || 'Failed to create customer' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Calculate next due date if not provided
        const nextDueDate = requestData.next_due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Fetch active split configurations for the tenant
        const { data: splits } = await supabase
          .from('split_configurations')
          .select('wallet_id, split_type, split_value')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);
        
        const splitConfigs: SplitConfig[] = (splits || []).map(s => ({
          wallet_id: s.wallet_id,
          split_type: s.split_type as 'fixed' | 'percentage',
          split_value: s.split_value,
        }));
        
        console.log('[Subscription] Found active splits:', splitConfigs.length);
        
        // Create subscription in Asaas with splits
        const subscription = await createSubscription(
          asaasConfig.api_key,
          baseUrl,
          customer.id,
          requestData.value,
          requestData.cycle,
          requestData.billing_type,
          nextDueDate,
          requestData.description || 'Assinatura via ConnectPay',
          splitConfigs.length > 0 ? splitConfigs : undefined
        );
        
        if (subscription.errors) {
          return new Response(
            JSON.stringify({ error: subscription.errors[0]?.description || 'Failed to create subscription' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Save subscription to database
        const { data: savedSubscription, error: saveError } = await supabase
          .from('subscriptions')
          .insert({
            tenant_id: tenantId,
            asaas_id: subscription.id,
            customer_id: customer.id,
            customer_name: requestData.customer.name,
            customer_email: requestData.customer.email,
            customer_document: requestData.customer.cpfCnpj,
            value: requestData.value,
            billing_type: requestData.billing_type.toLowerCase(),
            cycle: requestData.cycle.toUpperCase(),
            next_due_date: subscription.nextDueDate,
            status: 'active',
            description: requestData.description,
            bitrix_entity_type: requestData.bitrix_entity_type,
            bitrix_entity_id: requestData.bitrix_entity_id,
          })
          .select()
          .single();
        
        if (saveError) {
          console.error('Error saving subscription:', saveError);
        }
        
        // Log the event
        await supabase.from('integration_logs').insert({
          tenant_id: tenantId,
          action: 'subscription_created',
          entity_type: 'subscription',
          entity_id: subscription.id,
          status: 'success',
          request_data: requestData,
          response_data: subscription,
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            subscription_id: subscription.id,
            subscription_status: subscription.status,
            next_due_date: subscription.nextDueDate,
            customer_id: customer.id,
            internal_id: savedSubscription?.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'cancel': {
        if (!requestData.subscription_id) {
          return new Response(
            JSON.stringify({ error: 'Missing subscription_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Get subscription from database
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('asaas_id')
          .eq('id', requestData.subscription_id)
          .eq('tenant_id', tenantId)
          .single();
        
        const asaasId = subscription?.asaas_id || requestData.subscription_id;
        
        // Cancel in Asaas
        const result = await cancelSubscription(asaasConfig.api_key, baseUrl, asaasId);
        
        if (result.errors) {
          return new Response(
            JSON.stringify({ error: result.errors[0]?.description || 'Failed to cancel subscription' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Update database
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('asaas_id', asaasId);
        
        // Log the event
        await supabase.from('integration_logs').insert({
          tenant_id: tenantId,
          action: 'subscription_canceled',
          entity_type: 'subscription',
          entity_id: asaasId,
          status: 'success',
          request_data: requestData,
        });
        
        return new Response(
          JSON.stringify({ success: true, subscription_id: asaasId, status: 'canceled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'list': {
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });
        
        return new Response(
          JSON.stringify({ success: true, subscriptions: subscriptions || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: create, cancel, or list' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-subscription-process:', error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
