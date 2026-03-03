import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RobotRequest {
  event_token: string;
  code: string;
  document_id: string[];
  document_type: string[];
  properties: Record<string, string>;
  auth: {
    access_token: string;
    domain: string;
    member_id: string;
    application_token: string;
  };
  ts: string;
}

async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string) {
  const url = `${endpoint}${method}`;
  console.log(`[Bitrix API] Calling: ${method}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, auth: accessToken }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`[Bitrix API] Error in ${method}:`, data.error, data.error_description);
    } else {
      console.log(`[Bitrix API] Success in ${method}`);
    }
    
    return data;
  } catch (error) {
    console.error(`[Bitrix API] Fetch error in ${method}:`, error);
    throw error;
  }
}

function getAsaasBaseUrl(environment: string): string {
  return environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';
}

async function findOrCreateCustomer(apiKey: string, baseUrl: string, data: { name: string; email: string; cpfCnpj: string }) {
  console.log('[Asaas] Finding or creating customer:', data.cpfCnpj);
  
  // Search for existing customer
  const searchResponse = await fetch(`${baseUrl}/customers?cpfCnpj=${data.cpfCnpj}`, {
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
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
    }),
  });
  
  const customer = await createResponse.json();
  console.log('[Asaas] Created new customer:', customer.id);
  return customer;
}

async function createAsaasCharge(
  apiKey: string, 
  baseUrl: string, 
  customerId: string, 
  paymentMethod: string, 
  amount: number, 
  dueDays: number,
  externalReference: string
) {
  console.log('[Asaas] Creating charge:', { paymentMethod, amount, dueDays });
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);
  
  const billingTypeMap: Record<string, string> = {
    pix: 'PIX',
    boleto: 'BOLETO',
    credit_card: 'CREDIT_CARD',
  };
  
  const paymentData: Record<string, unknown> = {
    customer: customerId,
    billingType: billingTypeMap[paymentMethod] || 'PIX',
    value: amount,
    dueDate: dueDate.toISOString().split('T')[0],
    externalReference,
    description: `Cobrança automática - ${externalReference}`,
  };
  
  const response = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentData),
  });
  
  const payment = await response.json();
  console.log('[Asaas] Payment created:', payment.id, payment.status);
  
  // If PIX, get the QR code
  if (paymentMethod === 'pix' && payment.id) {
    const pixResponse = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: { 'access_token': apiKey },
    });
    
    if (pixResponse.ok) {
      const pixData = await pixResponse.json();
      payment.pixCode = pixData.payload;
      payment.pixQrCodeUrl = pixData.encodedImage;
    }
  }
  
  return payment;
}

async function checkAsaasPayment(apiKey: string, baseUrl: string, chargeId: string) {
  console.log('[Asaas] Checking payment status:', chargeId);
  
  const response = await fetch(`${baseUrl}/payments/${chargeId}`, {
    headers: { 'access_token': apiKey },
  });
  
  const payment = await response.json();
  console.log('[Asaas] Payment status:', payment.status);
  
  return payment;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Robot Handler called');
    console.log('Method:', req.method);
    
    // Handle GET requests (marketplace validation)
    if (req.method === 'GET') {
      return new Response('OK', { headers: corsHeaders });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    console.log('Content-Type:', contentType);
    console.log('Body length:', bodyText.length);
    
    // Handle empty body
    if (!bodyText || bodyText.trim() === '') {
      return new Response('OK', { headers: corsHeaders });
    }
    
    let robotData: RobotRequest;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyText);
      const allParams = Object.fromEntries(params.entries());
      console.log('All params:', JSON.stringify(allParams));
      
      // Parse robot request from form data
      robotData = {
        event_token: params.get('event_token') || params.get('EVENT_TOKEN') || '',
        code: params.get('code') || params.get('CODE') || '',
        document_id: [],
        document_type: [],
        properties: {},
        auth: {
          access_token: params.get('auth[access_token]') || params.get('AUTH_ID') || '',
          domain: params.get('auth[domain]') || params.get('DOMAIN') || '',
          member_id: params.get('auth[member_id]') || params.get('member_id') || '',
          application_token: params.get('auth[application_token]') || '',
        },
        ts: params.get('ts') || '',
      };
      
      // Parse properties from form data
      for (const [key, value] of params.entries()) {
        if (key.startsWith('properties[')) {
          const propName = key.match(/properties\[([^\]]+)\]/)?.[1];
          if (propName) {
            robotData.properties[propName] = value;
          }
        }
      }
      
      // Parse document_id and document_type
      for (let i = 0; i < 5; i++) {
        const docId = params.get(`document_id[${i}]`);
        const docType = params.get(`document_type[${i}]`);
        if (docId) robotData.document_id.push(docId);
        if (docType) robotData.document_type.push(docType);
      }
    } else {
      robotData = JSON.parse(bodyText);
    }
    
    console.log('Robot data:', JSON.stringify({
      code: robotData.code,
      event_token: robotData.event_token ? '***exists***' : 'missing',
      properties: robotData.properties,
      member_id: robotData.auth?.member_id,
    }));
    
    if (!robotData.event_token || !robotData.auth?.member_id) {
      console.error('Missing required robot data');
      return new Response(JSON.stringify({ error: 'Missing required data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get installation by member_id
    const { data: installation, error: installError } = await supabase
      .from('bitrix_installations')
      .select('id, tenant_id, client_endpoint, server_endpoint')
      .eq('member_id', robotData.auth.member_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (installError || !installation) {
      console.error('Installation not found:', installError);
      return new Response(JSON.stringify({ error: 'Installation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Found installation:', installation.id);
    
    // Get Asaas configuration
    const { data: asaasConfig, error: asaasError } = await supabase
      .from('asaas_configurations')
      .select('api_key, environment')
      .eq('tenant_id', installation.tenant_id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (asaasError || !asaasConfig?.api_key) {
      console.error('Asaas config not found:', asaasError);
      
      // Send error back to Bitrix
      const apiEndpoint = installation.client_endpoint || installation.server_endpoint || '';
      await callBitrixApi(apiEndpoint, 'bizproc.event.send', {
        EVENT_TOKEN: robotData.event_token,
        RETURN_VALUES: {
          error: 'Configuração do Asaas não encontrada. Por favor, configure sua API Key.',
        },
        LOG_MESSAGE: 'Erro: Asaas não configurado',
      }, robotData.auth.access_token);
      
      return new Response(JSON.stringify({ error: 'Asaas not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const baseUrl = getAsaasBaseUrl(asaasConfig.environment);
    const apiEndpoint = installation.client_endpoint || installation.server_endpoint || '';
    
    let returnValues: Record<string, unknown> = {};
    let logMessage = '';
    
    // Process based on robot code
    switch (robotData.code) {
      case 'asaas_create_charge': {
        const { payment_method, amount, customer_name, customer_email, customer_document, due_days } = robotData.properties;
        
        if (!amount || !customer_document) {
          returnValues = { error: 'Valor e CPF/CNPJ são obrigatórios' };
          logMessage = 'Erro: Dados incompletos';
          break;
        }
        
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          returnValues = { error: 'Valor inválido' };
          logMessage = 'Erro: Valor inválido';
          break;
        }
        
        // Create or find customer
        const customer = await findOrCreateCustomer(asaasConfig.api_key, baseUrl, {
          name: customer_name || 'Cliente',
          email: customer_email || '',
          cpfCnpj: customer_document,
        });
        
        if (customer.errors) {
          returnValues = { error: customer.errors[0]?.description || 'Erro ao criar cliente' };
          logMessage = `Erro: ${customer.errors[0]?.description}`;
          break;
        }
        
        // Create external reference
        const docId = robotData.document_id[2] || robotData.document_id[0] || 'unknown';
        const externalReference = `bitrix_${robotData.auth.member_id}_${docId}`;
        
        // Create charge
        const payment = await createAsaasCharge(
          asaasConfig.api_key,
          baseUrl,
          customer.id,
          payment_method || 'pix',
          parsedAmount,
          parseInt(due_days) || 3,
          externalReference
        );
        
        if (payment.errors) {
          returnValues = { error: payment.errors[0]?.description || 'Erro ao criar cobrança' };
          logMessage = `Erro: ${payment.errors[0]?.description}`;
          break;
        }
        
        // Save transaction to database
        if (installation.tenant_id) {
          const { data: insertedTx } = await supabase.from('transactions').insert({
            tenant_id: installation.tenant_id,
            asaas_id: payment.id,
            amount: parsedAmount,
            payment_method: payment_method || 'pix',
            status: 'pending',
            customer_name: customer_name,
            customer_email: customer_email,
            customer_document: customer_document,
            payment_url: payment.invoiceUrl,
            bitrix_entity_id: docId,
            bitrix_entity_type: 'deal',
          }).select('id').single();
          
          // Create configurable activity with badge in Bitrix24 timeline
          if (apiEndpoint && robotData.auth.access_token) {
            try {
              const methodLabel: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão' };
              const actResult = await callBitrixApi(apiEndpoint, 'crm.activity.configurable.add', {
                ownerTypeId: 2, // Deal
                ownerId: parseInt(docId),
                fields: {
                  completed: false,
                  badgeCode: 'asaas_charge_created',
                },
                layout: {
                  header: { title: `Cobrança Asaas - ${methodLabel[payment_method] || payment_method}` },
                  body: {
                    blocks: {
                      info: {
                        type: 'lineOfBlocks',
                        properties: {
                          blocks: {
                            value: { type: 'text', properties: { value: `R$ ${parsedAmount.toFixed(2).replace('.', ',')}` } },
                            status: { type: 'text', properties: { value: 'Pendente', color: 'warning' } },
                          },
                        },
                      },
                    },
                  },
                  footer: {
                    buttons: {
                      copy: {
                        title: 'Copiar Link',
                        action: { type: 'copyToClipboard', value: payment.invoiceUrl || '' },
                        type: 'secondary',
                      },
                    },
                  },
                },
              }, robotData.auth.access_token);
              
              if (actResult.result?.id && insertedTx?.id) {
                await supabase.from('transactions')
                  .update({ bitrix_activity_id: String(actResult.result.id) })
                  .eq('id', insertedTx.id);
                console.log('[Robot] Created activity:', actResult.result.id);
              }
            } catch (actError) {
              console.error('[Robot] Error creating activity:', actError);
            }
          }
        }
        
        returnValues = {
          charge_id: payment.id,
          charge_status: payment.status,
          payment_url: payment.invoiceUrl || '',
          pix_code: payment.pixCode || '',
          boleto_url: payment.bankSlipUrl || '',
        };
        logMessage = `Cobrança criada: ${payment.id} - R$ ${parsedAmount}`;
        break;
      }
      
      case 'asaas_check_payment': {
        const { charge_id } = robotData.properties;
        
        if (!charge_id) {
          returnValues = { error: 'ID da cobrança é obrigatório' };
          logMessage = 'Erro: ID não informado';
          break;
        }
        
        const payment = await checkAsaasPayment(asaasConfig.api_key, baseUrl, charge_id);
        
        if (payment.errors) {
          returnValues = { error: payment.errors[0]?.description || 'Erro ao verificar cobrança' };
          logMessage = `Erro: ${payment.errors[0]?.description}`;
          break;
        }
        
        returnValues = {
          status: payment.status,
          paid_at: payment.confirmedDate || payment.paymentDate || '',
          paid_value: payment.value || 0,
        };
        logMessage = `Status: ${payment.status}`;
        break;
      }
      
      case 'asaas_create_subscription': {
        const { payment_method, amount, customer_name, customer_email, customer_document, cycle, first_due_days } = robotData.properties;
        
        if (!amount || !customer_document || !cycle) {
          returnValues = { error: 'Valor, CPF/CNPJ e ciclo são obrigatórios' };
          logMessage = 'Erro: Dados incompletos';
          break;
        }
        
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          returnValues = { error: 'Valor inválido' };
          logMessage = 'Erro: Valor inválido';
          break;
        }
        
        // Create or find customer
        const customer = await findOrCreateCustomer(asaasConfig.api_key, baseUrl, {
          name: customer_name || 'Cliente',
          email: customer_email || '',
          cpfCnpj: customer_document,
        });
        
        if (customer.errors) {
          returnValues = { error: customer.errors[0]?.description || 'Erro ao criar cliente' };
          logMessage = `Erro: ${customer.errors[0]?.description}`;
          break;
        }
        
        // Calculate first due date
        const dueDays = parseInt(first_due_days) || 7;
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + dueDays);
        
        // Map billing type
        const billingTypeMap: Record<string, string> = {
          pix: 'PIX',
          boleto: 'BOLETO',
          credit_card: 'CREDIT_CARD',
        };
        
        // Create subscription in Asaas
        const docId = robotData.document_id[2] || robotData.document_id[0] || 'unknown';
        
        const subscriptionResponse = await fetch(`${baseUrl}/subscriptions`, {
          method: 'POST',
          headers: {
            'access_token': asaasConfig.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: customer.id,
            billingType: billingTypeMap[payment_method] || 'PIX',
            value: parsedAmount,
            cycle: cycle.toUpperCase(),
            nextDueDate: nextDueDate.toISOString().split('T')[0],
            description: `Assinatura - Bitrix ${docId}`,
          }),
        });
        
        const subscription = await subscriptionResponse.json();
        console.log('[Asaas] Subscription created:', subscription.id, subscription.status);
        
        if (subscription.errors) {
          returnValues = { error: subscription.errors[0]?.description || 'Erro ao criar assinatura' };
          logMessage = `Erro: ${subscription.errors[0]?.description}`;
          break;
        }
        
        // Save subscription to database
        if (installation.tenant_id) {
          await supabase.from('subscriptions').insert({
            tenant_id: installation.tenant_id,
            asaas_id: subscription.id,
            customer_id: customer.id,
            customer_name: customer_name,
            customer_email: customer_email,
            customer_document: customer_document,
            value: parsedAmount,
            billing_type: payment_method || 'pix',
            cycle: cycle.toUpperCase(),
            next_due_date: subscription.nextDueDate,
            status: 'active',
            description: `Assinatura - Bitrix ${docId}`,
            bitrix_entity_id: docId,
            bitrix_entity_type: 'deal',
          });
        }
        
        returnValues = {
          subscription_id: subscription.id,
          subscription_status: subscription.status,
          next_due_date: subscription.nextDueDate,
          customer_id: customer.id,
        };
        logMessage = `Assinatura criada: ${subscription.id} - R$ ${parsedAmount}/${cycle}`;
        break;
      }
      
      case 'asaas_cancel_subscription': {
        const { subscription_id } = robotData.properties;
        
        if (!subscription_id) {
          returnValues = { error: 'ID da assinatura é obrigatório' };
          logMessage = 'Erro: ID não informado';
          break;
        }
        
        // Cancel subscription in Asaas
        const cancelResponse = await fetch(`${baseUrl}/subscriptions/${subscription_id}`, {
          method: 'DELETE',
          headers: { 'access_token': asaasConfig.api_key },
        });
        
        if (cancelResponse.ok) {
          // Update in database
          await supabase
            .from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('asaas_id', subscription_id);
          
          returnValues = {
            subscription_id: subscription_id,
            status: 'canceled',
          };
          logMessage = `Assinatura cancelada: ${subscription_id}`;
        } else {
          const errorData = await cancelResponse.json();
          returnValues = { error: errorData.errors?.[0]?.description || 'Erro ao cancelar assinatura' };
          logMessage = `Erro: ${errorData.errors?.[0]?.description}`;
        }
        break;
      }
      
      case 'asaas_create_invoice': {
        const { charge_id, value, service_description, observations } = robotData.properties;
        
        if (!charge_id && !value) {
          returnValues = { error: 'ID da cobrança ou valor são obrigatórios' };
          logMessage = 'Erro: Dados incompletos';
          break;
        }
        
        // Get fiscal configuration
        const { data: fiscalConfig } = await supabase
          .from('fiscal_configurations')
          .select('*')
          .eq('tenant_id', installation.tenant_id)
          .eq('is_active', true)
          .single();
        
        const docId = robotData.document_id[2] || robotData.document_id[0] || 'unknown';
        
        // Build invoice payload
        const invoicePayload: Record<string, unknown> = {
          serviceDescription: service_description || fiscalConfig?.municipal_service_name || 'Serviço',
          observations: observations || fiscalConfig?.observations_template || '',
          value: charge_id ? undefined : parseFloat(value),
        };
        
        if (charge_id) {
          invoicePayload.payment = charge_id;
        }
        
        if (fiscalConfig?.municipal_service_id) {
          invoicePayload.municipalServiceId = fiscalConfig.municipal_service_id;
        }
        
        if (fiscalConfig?.default_iss) {
          invoicePayload.taxes = {
            retainIss: false,
            iss: fiscalConfig.default_iss,
          };
        }
        
        invoicePayload.externalReference = `bitrix_${robotData.auth.member_id}_${docId}`;
        
        console.log('[Asaas] Creating invoice:', JSON.stringify(invoicePayload));
        
        const invoiceResponse = await fetch(`${baseUrl}/invoices`, {
          method: 'POST',
          headers: {
            'access_token': asaasConfig.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoicePayload),
        });
        
        const invoice = await invoiceResponse.json();
        console.log('[Asaas] Invoice created:', invoice.id, invoice.status);
        
        if (invoice.errors) {
          returnValues = { error: invoice.errors[0]?.description || 'Erro ao criar nota fiscal' };
          logMessage = `Erro: ${invoice.errors[0]?.description}`;
          break;
        }
        
        // Save to database
        if (installation.tenant_id) {
          await supabase.from('invoices').insert({
            tenant_id: installation.tenant_id,
            asaas_invoice_id: invoice.id,
            customer_id: invoice.customer,
            value: invoice.value,
            service_description: invoicePayload.serviceDescription,
            observations: invoicePayload.observations,
            status: invoice.status === 'AUTHORIZED' ? 'authorized' : 'scheduled',
            invoice_number: invoice.number,
            invoice_url: invoice.invoiceUrl,
            external_reference: invoicePayload.externalReference,
            bitrix_entity_id: docId,
            bitrix_entity_type: 'deal',
          });
        }
        
        returnValues = {
          invoice_id: invoice.id,
          invoice_status: invoice.status,
          invoice_number: invoice.number || '',
          invoice_url: invoice.invoiceUrl || '',
        };
        logMessage = `Nota Fiscal criada: ${invoice.id}`;
        break;
      }
      
      default:
        console.error('Unknown robot code:', robotData.code);
        returnValues = { error: `Robot não reconhecido: ${robotData.code}` };
        logMessage = 'Erro: Robot desconhecido';
    }
    
    // Send result back to Bitrix24
    console.log('Sending result back to Bitrix:', returnValues);
    
    const eventResult = await callBitrixApi(apiEndpoint, 'bizproc.event.send', {
      EVENT_TOKEN: robotData.event_token,
      RETURN_VALUES: returnValues,
      LOG_MESSAGE: logMessage,
    }, robotData.auth.access_token);
    
    console.log('Event send result:', JSON.stringify(eventResult));
    
    return new Response(JSON.stringify({ success: true, returnValues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-robot-handler:', error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
