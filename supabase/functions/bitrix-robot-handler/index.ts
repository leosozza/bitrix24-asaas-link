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

// Flattens nested params into Bitrix bracket notation: { fields: { ID: 1 } } -> fields[ID]=1
function flattenParams(obj: unknown, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...flattenParams(v, prefix ? `${prefix}[${i}]` : String(i))));
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && typeof v === 'object') {
        out.push(...flattenParams(v, key));
      } else if (v !== undefined && v !== null) {
        out.push([key, String(v)]);
      }
    }
    return out;
  }
  out.push([prefix, String(obj)]);
  return out;
}

async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string) {
  const url = `${endpoint}${method}`;
  console.log(`[Bitrix API] Calling: ${method}`);

  try {
    // Bitrix REST is most reliable with application/x-www-form-urlencoded + bracket notation.
    // Auth goes as a top-level form field, not nested.
    const form = new URLSearchParams();
    for (const [k, v] of flattenParams(params)) form.append(k, v);
    form.append('auth', accessToken);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: 'INVALID_JSON', error_description: text.slice(0, 300) }; }

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

// Parses BR-style currency: "R$ 1.500,00", "1.500,50", "1500.00", numbers, etc.
function parseBRLAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/[Rr]\$\s*/g, '').replace(/\s/g, '');
  if (s.includes(',')) {
    // BR format: dot is thousands separator, comma is decimal
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  return n;
}

// Strip mask from CPF/CNPJ — keep digits only
function stripDocument(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}


async function createAsaasCharge(
  apiKey: string,
  baseUrl: string,
  customerId: string,
  paymentMethod: string,
  amount: number,
  dueDays: number,
  externalReference: string,
  extras: {
    description?: string;
    installmentCount?: number;
    interestPercent?: number;
    finePercent?: number;
    discountValue?: number;
    discountDueDays?: number;
  } = {}
) {
  console.log('[Asaas] Creating charge:', { paymentMethod, amount, dueDays, extras });

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
    description: extras.description?.trim() || `Cobrança automática - ${externalReference}`,
  };

  if (paymentMethod === 'credit_card' && extras.installmentCount && extras.installmentCount > 1) {
    paymentData.installmentCount = extras.installmentCount;
    paymentData.installmentValue = Number((amount / extras.installmentCount).toFixed(2));
  }
  if (extras.discountValue && extras.discountValue > 0) {
    paymentData.discount = {
      value: extras.discountValue,
      dueDateLimitDays: extras.discountDueDays ?? 0,
    };
  }
  if (extras.finePercent && extras.finePercent > 0) {
    paymentData.fine = { value: extras.finePercent };
  }
  if (extras.interestPercent && extras.interestPercent > 0) {
    paymentData.interest = { value: extras.interestPercent };
  }

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

// Best-effort update of Deal UF_CRM_ASAAS_* fields. Only acts when target is a Deal.
async function updateDealAsaasFields(
  apiEndpoint: string,
  accessToken: string,
  entityType: string,
  entityId: number,
  fields: Record<string, unknown>
) {
  if (entityType !== 'deal' || !entityId || !apiEndpoint || !accessToken) return;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return;
  try {
    const res = await callBitrixApi(apiEndpoint, 'crm.deal.update', {
      id: entityId,
      fields: cleaned,
    }, accessToken);
    if (res.error) {
      console.error('[updateDealAsaasFields] error:', res.error, res.error_description);
    } else {
      console.log('[updateDealAsaasFields] Deal', entityId, 'updated with', Object.keys(cleaned).join(', '));
    }
  } catch (e) {
    console.error('[updateDealAsaasFields] exception:', e);
  }
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
    
    // Resolve Bitrix entity early so timeline comments work on every error path.
    // Priority: explicit robot properties (bitrix_entity_id / bitrix_entity_type)
    // override the workflow's document_id, so the user can target any Deal/Lead/Contact.
    const apiEndpoint = installation.client_endpoint || installation.server_endpoint || '';
    const docTypeRaw = String(robotData.document_id?.[1] || '');
    const docIdRaw = String(robotData.document_id?.[2] || robotData.document_id?.[0] || '');

    const propEntityIdRaw = String(robotData.properties?.bitrix_entity_id ?? '').trim();
    const propEntityTypeRaw = String(robotData.properties?.bitrix_entity_type ?? '').trim().toLowerCase();

    let entityType: 'deal' | 'lead' | 'contact' | 'company' = 'deal';
    if (propEntityIdRaw) {
      if (propEntityTypeRaw === 'lead' || propEntityTypeRaw === 'contact' || propEntityTypeRaw === 'company') {
        entityType = propEntityTypeRaw;
      } else {
        entityType = 'deal';
      }
    } else {
      if (/Lead/i.test(docTypeRaw)) entityType = 'lead';
      else if (/Contact/i.test(docTypeRaw)) entityType = 'contact';
      else if (/Company/i.test(docTypeRaw)) entityType = 'company';
    }

    const entityIdSource = propEntityIdRaw || docIdRaw;
    const entityIdNum = parseInt(entityIdSource.replace(/[^0-9]/g, '')) || 0;
    console.log('[Robot] Target entity resolved:', { entityType, entityIdNum, fromProperty: !!propEntityIdRaw });

    const postTimelineComment = async (text: string) => {
      if (!apiEndpoint || !robotData.auth.access_token || !entityIdNum) return;
      try {
        await callBitrixApi(apiEndpoint, 'crm.timeline.comment.add', {
          fields: {
            ENTITY_ID: entityIdNum,
            ENTITY_TYPE: entityType,
            COMMENT: text,
          },
        }, robotData.auth.access_token);
        console.log('[Robot] Timeline comment posted to', entityType, entityIdNum);
      } catch (e) {
        console.error('[Robot] Timeline comment error:', e);
      }
    };

    // Get Asaas configuration
    const { data: asaasConfig, error: asaasError } = await supabase
      .from('asaas_configurations')
      .select('api_key, environment')
      .eq('tenant_id', installation.tenant_id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (asaasError || !asaasConfig?.api_key) {
      console.error('Asaas config not found:', asaasError);
      await postTimelineComment('[B]❌ Asaas — configuração ausente[/B]\nConfigure a API Key no app Asaas Connector antes de executar o robô.');
      
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
    
    let returnValues: Record<string, unknown> = {};
    let logMessage = '';

    // Process based on robot code
    switch (robotData.code) {
      case 'asaas_create_charge': {
        const { payment_method, amount, customer_name, customer_email, customer_document, due_days, description, external_reference, installment_count, interest_percent, fine_percent, discount_value, discount_due_days } = robotData.properties;
        console.log('[Robot] create_charge raw inputs:', { amount, customer_document, payment_method });

        const docDigits = stripDocument(customer_document);
        if (!amount || !docDigits) {
          returnValues = { error: 'Valor e CPF/CNPJ são obrigatórios' };
          logMessage = 'Erro: Dados incompletos';
          await postTimelineComment('[B]❌ Asaas — dados incompletos[/B]\nInforme valor e CPF/CNPJ do cliente nas propriedades do robô.');
          break;
        }
        
        const parsedAmount = parseBRLAmount(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          returnValues = { error: 'Valor inválido' };
          logMessage = 'Erro: Valor inválido';
          await postTimelineComment(`[B]❌ Asaas — valor inválido[/B]\nValor recebido: \`${String(amount)}\`\nUse formatos como 1500.00 ou R$ 1.500,00.`);
          break;
        }
        
        // Create or find customer
        const customer = await findOrCreateCustomer(asaasConfig.api_key, baseUrl, {
          name: customer_name || 'Cliente',

          email: customer_email || '',
          cpfCnpj: docDigits,

        });
        
        if (customer.errors) {
          const msg = customer.errors[0]?.description || 'Erro ao criar cliente';
          returnValues = { error: msg };
          logMessage = `Erro: ${msg}`;
          await postTimelineComment(`[B]❌ Asaas — falha ao criar cliente[/B]\n${msg}`);
          break;
        }
        
        // Create external reference — prefer the resolved target entity (override or workflow)
        const ownerTypeIdMap: Record<string, number> = { lead: 1, deal: 2, contact: 3, company: 4 };
        const targetOwnerTypeId = ownerTypeIdMap[entityType] || 2;
        const targetId = entityIdNum || (robotData.document_id[2] || robotData.document_id[0] || 'unknown');
        const externalReference = (String(external_reference || '').trim()) || `bitrix_${robotData.auth.member_id}_${entityType}_${targetId}`;
        const dueDaysParsed = parseInt(String(due_days)) || 3;

        // Create charge
        const payment = await createAsaasCharge(
          asaasConfig.api_key,
          baseUrl,
          customer.id,
          payment_method || 'pix',
          parsedAmount,
          dueDaysParsed,
          externalReference,
          {
            description: description ? String(description) : undefined,
            installmentCount: installment_count ? parseInt(String(installment_count)) : undefined,
            interestPercent: interest_percent ? parseFloat(String(interest_percent)) : undefined,
            finePercent: fine_percent ? parseFloat(String(fine_percent)) : undefined,
            discountValue: discount_value ? parseBRLAmount(discount_value) : undefined,
            discountDueDays: discount_due_days ? parseInt(String(discount_due_days)) : undefined,
          }
        );
        
        if (payment.errors) {
          const msg = payment.errors[0]?.description || 'Erro ao criar cobrança';
          returnValues = { error: msg };
          logMessage = `Erro: ${msg}`;
          await postTimelineComment(`[B]❌ Asaas — falha ao criar cobrança[/B]\nValor: R$ ${parsedAmount.toFixed(2).replace('.', ',')}\nMotivo: ${msg}`);
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
            bitrix_entity_id: String(targetId),
            bitrix_entity_type: entityType,
          }).select('id').single();
          
          // Create configurable activity with badge in Bitrix24 timeline (on resolved entity)
          if (apiEndpoint && robotData.auth.access_token && entityIdNum) {
            try {
              const methodLabel: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão' };
              const actResult = await callBitrixApi(apiEndpoint, 'crm.activity.configurable.add', {
                ownerTypeId: targetOwnerTypeId,
                ownerId: entityIdNum,
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

        // Post a plain timeline comment with success info + link
        {
          const methodLabel: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão de Crédito' };
          const m = methodLabel[payment_method] || (payment_method || 'PIX');
          const amountFmt = `R$ ${parsedAmount.toFixed(2).replace('.', ',')}`;
          const link = payment.invoiceUrl ? `\nLink: ${payment.invoiceUrl}` : '';
          await postTimelineComment(
            `[B]✅ Asaas — cobrança criada com sucesso[/B]\nID: ${payment.id}\nMétodo: ${m}\nValor: ${amountFmt}\nStatus: ${payment.status}${link}`
          );
        }

        // Update Deal UF_CRM_ASAAS_* fields (best-effort)
        {
          const billingTypeLabel: Record<string, string> = { pix: 'PIX', boleto: 'BOLETO', credit_card: 'CREDIT_CARD' };
          await updateDealAsaasFields(apiEndpoint, robotData.auth.access_token, entityType, entityIdNum, {
            UF_CRM_ASAAS_CHARGE_ID: payment.id,
            UF_CRM_ASAAS_CHARGE_URL: payment.invoiceUrl,
            UF_CRM_ASAAS_CHARGE_STATUS: payment.status,
            UF_CRM_ASAAS_CHARGE_VALUE: parsedAmount,
            UF_CRM_ASAAS_BILLING_TYPE: billingTypeLabel[payment_method] || payment_method,
            UF_CRM_ASAAS_DUE_DATE: payment.dueDate,
            UF_CRM_ASAAS_PIX_CODE: payment.pixCode,
            UF_CRM_ASAAS_BOLETO_URL: payment.bankSlipUrl,
          });
        }
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

        await updateDealAsaasFields(apiEndpoint, robotData.auth.access_token, entityType, entityIdNum, {
          UF_CRM_ASAAS_CHARGE_STATUS: payment.status,
          UF_CRM_ASAAS_PAID_AT: payment.confirmedDate || payment.paymentDate || undefined,
        });
        break;
      }
      
      case 'asaas_create_subscription': {
        const { payment_method, amount, customer_name, customer_email, customer_document, cycle, first_due_days, description: subDescription, end_date, max_payments } = robotData.properties;
        console.log('[Robot] create_subscription raw inputs:', { amount, customer_document, cycle });

        const docDigits = stripDocument(customer_document);
        if (!amount || !docDigits || !cycle) {
          returnValues = { error: 'Valor, CPF/CNPJ e ciclo são obrigatórios' };
          logMessage = 'Erro: Dados incompletos';
          await postTimelineComment('[B]❌ Asaas — assinatura: dados incompletos[/B]\nInforme valor, CPF/CNPJ e ciclo.');
          break;
        }
        
        const parsedAmount = parseBRLAmount(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          returnValues = { error: 'Valor inválido' };
          logMessage = 'Erro: Valor inválido';
          await postTimelineComment(`[B]❌ Asaas — assinatura: valor inválido[/B]\nValor recebido: \`${String(amount)}\``);
          break;
        }
        
        // Create or find customer
        const customer = await findOrCreateCustomer(asaasConfig.api_key, baseUrl, {
          name: customer_name || 'Cliente',
          email: customer_email || '',
          cpfCnpj: docDigits,
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
        
        // Create subscription in Asaas — use resolved target entity (override or workflow)
        const docId = entityIdNum ? String(entityIdNum) : (robotData.document_id[2] || robotData.document_id[0] || 'unknown');
        
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
            bitrix_entity_type: entityType,
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
        
        const docId = entityIdNum ? String(entityIdNum) : (robotData.document_id[2] || robotData.document_id[0] || 'unknown');
        
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
        
        invoicePayload.externalReference = `bitrix_${robotData.auth.member_id}_${entityType}_${docId}`;
        
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
            bitrix_entity_type: entityType,
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
