import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InvoiceRequest {
  action: 'list_municipal_services' | 'create' | 'authorize' | 'get' | 'cancel';
  tenant_id: string;
  // For list_municipal_services
  description?: string;
  // For create
  payment_id?: string;
  customer_id?: string;
  transaction_id?: string;
  service_description?: string;
  observations?: string;
  value?: number;
  effective_date?: string;
  municipal_service_id?: string;
  municipal_service_code?: string;
  municipal_service_name?: string;
  taxes?: {
    retain_iss?: boolean;
    iss?: number;
  };
  external_reference?: string;
  bitrix_entity_type?: string;
  bitrix_entity_id?: string;
  // For get, authorize, cancel
  invoice_id?: string;
}

function getAsaasBaseUrl(environment: string): string {
  return environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Asaas Invoice Process called');
    
    const requestData: InvoiceRequest = await req.json();
    const { action, tenant_id } = requestData;
    
    if (!action || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'action and tenant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get Asaas configuration
    const { data: asaasConfig, error: asaasError } = await supabase
      .from('asaas_configurations')
      .select('api_key, environment')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .single();
    
    if (asaasError || !asaasConfig?.api_key) {
      console.error('Asaas config not found:', asaasError);
      return new Response(
        JSON.stringify({ error: 'Asaas not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const baseUrl = getAsaasBaseUrl(asaasConfig.environment);
    const apiKey = asaasConfig.api_key;
    
    let result: Record<string, unknown> = {};
    
    switch (action) {
      case 'list_municipal_services': {
        const { description } = requestData;
        const queryParams = description ? `?description=${encodeURIComponent(description)}` : '';
        
        const response = await fetch(`${baseUrl}/invoices/municipalServices${queryParams}`, {
          headers: { 'access_token': apiKey },
        });
        
        const data = await response.json();
        console.log('[Asaas] Municipal services:', data.data?.length || 0, 'found');
        
        result = { services: data.data || [], totalCount: data.totalCount || 0 };
        break;
      }
      
      case 'create': {
        const {
          payment_id,
          customer_id,
          transaction_id,
          service_description,
          observations,
          value,
          effective_date,
          municipal_service_id,
          municipal_service_code,
          municipal_service_name,
          taxes,
          external_reference,
          bitrix_entity_type,
          bitrix_entity_id,
        } = requestData;
        
        if (!service_description || !value) {
          return new Response(
            JSON.stringify({ error: 'service_description and value are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Build invoice payload
        const invoicePayload: Record<string, unknown> = {
          serviceDescription: service_description,
          observations: observations || '',
          value: value,
        };
        
        // Link to payment or customer
        if (payment_id) {
          invoicePayload.payment = payment_id;
        } else if (customer_id) {
          invoicePayload.customer = customer_id;
        }
        
        if (effective_date) {
          invoicePayload.effectiveDate = effective_date;
        }
        
        if (municipal_service_id) {
          invoicePayload.municipalServiceId = municipal_service_id;
        } else if (municipal_service_code) {
          invoicePayload.municipalServiceCode = municipal_service_code;
        }
        
        if (municipal_service_name) {
          invoicePayload.municipalServiceName = municipal_service_name;
        }
        
        if (external_reference) {
          invoicePayload.externalReference = external_reference;
        }
        
        if (taxes) {
          invoicePayload.taxes = {
            retainIss: taxes.retain_iss || false,
            iss: taxes.iss || 0,
          };
        }
        
        console.log('[Asaas] Creating invoice:', JSON.stringify(invoicePayload));
        
        const response = await fetch(`${baseUrl}/invoices`, {
          method: 'POST',
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoicePayload),
        });
        
        const invoice = await response.json();
        console.log('[Asaas] Invoice created:', invoice.id, invoice.status);
        
        if (invoice.errors) {
          return new Response(
            JSON.stringify({ error: invoice.errors[0]?.description || 'Error creating invoice' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Save to database
        const { data: savedInvoice, error: saveError } = await supabase
          .from('invoices')
          .insert({
            tenant_id,
            transaction_id: transaction_id || null,
            asaas_invoice_id: invoice.id,
            customer_id: invoice.customer,
            value: value,
            service_description: service_description,
            observations: observations,
            status: invoice.status === 'AUTHORIZED' ? 'authorized' : 
                   invoice.status === 'SCHEDULED' ? 'scheduled' : 
                   invoice.status === 'SYNCHRONIZED' ? 'synchronized' : 'scheduled',
            invoice_number: invoice.number,
            invoice_url: invoice.invoiceUrl,
            effective_date: invoice.effectiveDate,
            external_reference: external_reference,
            bitrix_entity_type: bitrix_entity_type,
            bitrix_entity_id: bitrix_entity_id,
          })
          .select()
          .single();
        
        if (saveError) {
          console.error('[DB] Error saving invoice:', saveError);
        }
        
        result = {
          invoice_id: invoice.id,
          status: invoice.status,
          number: invoice.number,
          invoice_url: invoice.invoiceUrl,
          db_id: savedInvoice?.id,
        };
        break;
      }
      
      case 'authorize': {
        const { invoice_id } = requestData;
        
        if (!invoice_id) {
          return new Response(
            JSON.stringify({ error: 'invoice_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const response = await fetch(`${baseUrl}/invoices/${invoice_id}/authorize`, {
          method: 'POST',
          headers: { 'access_token': apiKey },
        });
        
        const invoice = await response.json();
        console.log('[Asaas] Invoice authorized:', invoice.id, invoice.status);
        
        if (invoice.errors) {
          // Update database with error
          await supabase
            .from('invoices')
            .update({
              status: 'error',
              error_message: invoice.errors[0]?.description,
            })
            .eq('asaas_invoice_id', invoice_id);
          
          return new Response(
            JSON.stringify({ error: invoice.errors[0]?.description || 'Error authorizing invoice' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Update database
        await supabase
          .from('invoices')
          .update({
            status: 'authorized',
            invoice_number: invoice.number,
            invoice_url: invoice.invoiceUrl,
          })
          .eq('asaas_invoice_id', invoice_id);
        
        result = {
          invoice_id: invoice.id,
          status: invoice.status,
          number: invoice.number,
          invoice_url: invoice.invoiceUrl,
        };
        break;
      }
      
      case 'get': {
        const { invoice_id } = requestData;
        
        if (!invoice_id) {
          return new Response(
            JSON.stringify({ error: 'invoice_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const response = await fetch(`${baseUrl}/invoices/${invoice_id}`, {
          headers: { 'access_token': apiKey },
        });
        
        const invoice = await response.json();
        console.log('[Asaas] Invoice fetched:', invoice.id, invoice.status);
        
        result = { invoice };
        break;
      }
      
      case 'cancel': {
        const { invoice_id } = requestData;
        
        if (!invoice_id) {
          return new Response(
            JSON.stringify({ error: 'invoice_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const response = await fetch(`${baseUrl}/invoices/${invoice_id}`, {
          method: 'DELETE',
          headers: { 'access_token': apiKey },
        });
        
        if (response.ok) {
          console.log('[Asaas] Invoice canceled:', invoice_id);
          
          // Update database
          await supabase
            .from('invoices')
            .update({ status: 'canceled' })
            .eq('asaas_invoice_id', invoice_id);
          
          result = { invoice_id, status: 'canceled' };
        } else {
          const error = await response.json();
          return new Response(
            JSON.stringify({ error: error.errors?.[0]?.description || 'Error canceling invoice' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
      }
      
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    // Log the operation
    await supabase.from('integration_logs').insert({
      tenant_id,
      action: `asaas_invoice_${action}`,
      entity_type: 'invoice',
      entity_id: result.invoice_id as string || null,
      status: 'success',
      request_data: requestData,
      response_data: result,
    });
    
    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in asaas-invoice-process:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
