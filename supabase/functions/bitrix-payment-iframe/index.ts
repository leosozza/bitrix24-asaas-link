import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Logo do Asaas em Data URL format (fundo azul com asas brancas) - usado nos pay systems do Bitrix24
const ASAAS_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAADpElEQVR4nO2bS2gUQRCGv9UYFRRviIoH8eJBPYh4VDx4UEE8qCgi4kHEg4iIB0G8eBBEUQQVEUFEVBQ8iAoiogfx4EXxoIiKoogoRiWJxmS1oHYZhp2Znpmd6dnZ+qFhszNdXV1/d1dVd4MHBgEDgN+Aj8BH4C1wG5gJdAL/8hwAzAVOA/eBT0A/EHQR0A28A54C54DpQH+e5ecrcBG4BMwDOoE/Pg4bB5wAnnpYLuiPngNrgZ7QNw4cBF77sCp0ewm0BbkQ6AU+hb5pNLAGeODDutDlI7Ah9I0CrgE/fVobukwGThJMCd0X+HKS4IsO4IYPGxG6dQGXUxrL0gU4l1Cvl5CuMz0pjWXtCFxMoNNjpFfaVU6sSaC/P6BPW5iWBPo/B8akNJalFTidQL9rwIQE+vcCf1May9IKXEygvxtYn0D/R8CSoO8J3f4D+qU0lqUFOJNA/0tAZwL9bwNzUhrL0h3w+xpYDYxNoP+OgD4hZZVA71bgg4/9/gLjE+r/MKBPm54RqTIB2ObD6tBlLDAb+Bo61+j5Mwr4E/pGGf09ANYAZxy2J9D/E7ACGBPwnUH/T2E9lsCfwMaEej8EVgG9AX0CvqM+DI95hP4uBLYH/c7o5mUQ8C2E7QvS7xQwKK0H+C3kO0L/Z8D+AvXZBYxKoL8loCeiPE/A98PQvR14X8D3l0K+GhGfQ38j/Y4AE0K3h8DfEN+XwOmQv5YEet8K+OoXCiVo7RsK3BEBvo8BawL8PgCWhK6vE+r9AxgY0i+ov1sDvv1CwQ3dRqbcqX+CPL+BqaFLhf4XyDcADB4GbAwdewT0D/I8+b8T+tXo3wmsKXQ8HeCnv1t/dwb8h4a+g4GJoc9LoNjHxAJgX+joLaS/L0F/90L/E/p3hPy3hm7vQ8efgd8Ff63Aj4D/kxD2LuS7DPgS0v+Pf/8PnQr57g353gvxvYJ+f0P/UE8+P4FDQU+vhvT/E/g+Af8nCjzvAvwXBvkzMeCv0P8v8K3Qb9D/zxD2Kvj2EPo3Db0vBPw3hH7NQ++YzqLzwM0EJ7h7IZ8+4JaP/h0B/50B/51JfGf8O+T/goDvT6HfuwR6Xgv5DwMPBPgFuJ1CuxNB/wc+1rsE/FcH/H+EbkE9VgT0/xj0uwD8TKC/w9A3BngT8h0A/gv6hDTYF7q9SaC/M+B7lUDPqwH/LQE9LwO/E+j5CDge8B0EnCrEh+IIsMSHdaHLJeC+jz0dgNdC/x0+dnwMHEqo/69C/xOJ1P0LdDsbkGqUwVMAAAAABJRU5ErkJggg==';

interface PaymentData {
  paymentId: string;
  orderId: string;
  amount: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerDocument: string;
  paymentMethod: string;
  domain: string;
  memberId: string;
  accessToken?: string;
  serverEndpoint?: string;
  placement?: string;
  placementOptions?: { ID?: string; CATEGORY_ID?: string } | null;
}

// ============= BITRIX API FUNCTIONS FOR PAY SYSTEM REGISTRATION =============

async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string) {
  const url = `${endpoint}${method}`;
  console.log(`[Bitrix API] Calling: ${method}`);
  console.log(`[Bitrix API] URL: ${url}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken }),
  });
  
  const result = await response.json();
  
  if (result.error) {
    console.error(`[Bitrix API] Error in ${method}:`, result.error, result.error_description);
  } else if (result.result) {
    const resultStr = JSON.stringify(result.result);
    console.log(`[Bitrix API] Success in ${method}:`, resultStr.substring(0, 200));
  }
  
  return result;
}

// Get real portal domain via profile API
async function getPortalDomainFromProfile(serverEndpoint: string, accessToken: string): Promise<string | null> {
  console.log('[getPortalDomain] Fetching domain via profile endpoint...');
  
  try {
    // Call profile to get portal domain
    const profileResult = await callBitrixApi(serverEndpoint, 'profile', {}, accessToken);
    
    if (profileResult.result) {
      // The profile response contains ADMIN_MODE and other info
      // The actual domain comes from the response headers or needs to be extracted differently
      console.log('[getPortalDomain] Profile result:', JSON.stringify(profileResult.result).substring(0, 300));
    }
    
    // Try server.info which might return the portal domain
    const serverInfoResult = await callBitrixApi(serverEndpoint, 'server.info', {}, accessToken);
    
    if (serverInfoResult.result) {
      console.log('[getPortalDomain] Server info result:', JSON.stringify(serverInfoResult.result).substring(0, 300));
    }
    
    // Try app.info which returns more details
    const appInfoResult = await callBitrixApi(serverEndpoint, 'app.info', {}, accessToken);
    
    if (appInfoResult.result) {
      console.log('[getPortalDomain] App info result:', JSON.stringify(appInfoResult.result).substring(0, 500));
      
      // Check if there's a client_endpoint or domain in the response
      const installInfo = appInfoResult.result.install || appInfoResult.result;
      if (installInfo.client_endpoint) {
        // Extract domain from client_endpoint: https://domain.bitrix24.com.br/rest/
        const match = installInfo.client_endpoint.match(/https?:\/\/([^\/]+)/);
        if (match) {
          console.log('[getPortalDomain] Extracted domain from client_endpoint:', match[1]);
          return match[1];
        }
      }
    }
    
    // Try scope endpoint to get portal info
    const scopeResult = await callBitrixApi(serverEndpoint, 'scope', {}, accessToken);
    
    if (scopeResult.result) {
      console.log('[getPortalDomain] Scope result:', JSON.stringify(scopeResult.result).substring(0, 300));
    }
    
    // Try user.current which might contain portal info
    const userResult = await callBitrixApi(serverEndpoint, 'user.current', {}, accessToken);
    
    if (userResult.result) {
      console.log('[getPortalDomain] User current result:', JSON.stringify(userResult.result).substring(0, 300));
      
      // Check if there's a portal domain in user data
      const portalUrl = userResult.result.PERSONAL_WWW || userResult.result.portal || null;
      if (portalUrl) {
        const match = portalUrl.match(/https?:\/\/([^\/]+)/);
        if (match) {
          console.log('[getPortalDomain] Extracted domain from user data:', match[1]);
          return match[1];
        }
      }
    }
    
    console.log('[getPortalDomain] Could not extract domain from any API response');
    return null;
    
  } catch (error) {
    console.error('[getPortalDomain] Error:', error);
    return null;
  }
}

async function registerPaySystemHandler(clientEndpoint: string, accessToken: string, iframeBaseUrl: string) {
  console.log('Registering Pay System Handler at endpoint:', clientEndpoint);
  
  // First, try to delete any existing handler with the same code
  await callBitrixApi(clientEndpoint, 'sale.paysystem.handler.delete', {
    CODE: 'asaas_payments',
  }, accessToken);

  const iframeUrl = `${iframeBaseUrl}/functions/v1/bitrix-payment-iframe`;
  console.log('IFRAME URL for handler:', iframeUrl);

  const handlerResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.handler.add', {
    NAME: 'Asaas Pagamentos',
    CODE: 'asaas_payments',
    SORT: 100,
    SETTINGS: {
      CURRENCY: ['BRL'],
      CLIENT_TYPE: 'b2c',
      IFRAME_DATA: {
        ACTION_URI: iframeUrl,
        FIELDS: {
          paymentId: { CODE: 'PAYMENT_ID' },
          paymentAmount: { CODE: 'PAYMENT_AMOUNT' },
          paymentCurrency: { CODE: 'PAYMENT_CURRENCY' },
          customerName: { CODE: 'CUSTOMER_NAME' },
          customerEmail: { CODE: 'CUSTOMER_EMAIL' },
          customerDocument: { CODE: 'CUSTOMER_DOCUMENT' },
          paymentMethod: { CODE: 'PAYMENT_METHOD' },
        },
      },
      CODES: {
        PAYMENT_ID: { 
          NAME: 'ID do Pagamento', 
          GROUP: 'PAYMENT', 
          DEFAULT: { PROVIDER_KEY: 'PAYMENT', PROVIDER_VALUE: 'ID' } 
        },
        PAYMENT_AMOUNT: { 
          NAME: 'Valor', 
          GROUP: 'PAYMENT', 
          DEFAULT: { PROVIDER_KEY: 'PAYMENT', PROVIDER_VALUE: 'SUM' } 
        },
        PAYMENT_CURRENCY: { 
          NAME: 'Moeda', 
          GROUP: 'PAYMENT', 
          DEFAULT: { PROVIDER_KEY: 'PAYMENT', PROVIDER_VALUE: 'CURRENCY' } 
        },
        CUSTOMER_NAME: { 
          NAME: 'Nome do Cliente', 
          GROUP: 'ORDER', 
          DEFAULT: { PROVIDER_KEY: 'ORDER', PROVIDER_VALUE: 'USER_NAME' } 
        },
        CUSTOMER_EMAIL: { 
          NAME: 'Email do Cliente', 
          GROUP: 'ORDER', 
          DEFAULT: { PROVIDER_KEY: 'ORDER', PROVIDER_VALUE: 'USER_EMAIL' } 
        },
        CUSTOMER_DOCUMENT: { 
          NAME: 'CPF/CNPJ do Cliente', 
          GROUP: 'PROPERTY',
          INPUT: { TYPE: 'STRING' }
        },
        PAYMENT_METHOD: { 
          NAME: 'Método de Pagamento', 
          DESCRIPTION: 'PIX, Boleto ou Cartão',
          INPUT: { TYPE: 'STRING' }
        },
      },
    },
  }, accessToken);

  if (handlerResult.error) {
    // Check if handler already exists - this is OK, we can continue
    if (handlerResult.error.includes('ALREADY_EXIST')) {
      console.log('Handler already registered, continuing with pay system creation...');
      return { ...handlerResult, alreadyExisted: true };
    }
    console.error('Failed to register handler:', handlerResult.error, handlerResult.error_description);
  } else {
    console.log('Handler registered successfully:', JSON.stringify(handlerResult.result));
  }
  
  return handlerResult;
}

async function createPaySystems(clientEndpoint: string, accessToken: string, installationId: string, supabase: any) {
  console.log('Creating Pay Systems at endpoint:', clientEndpoint);
  
  // First, get available person types
  console.log('Fetching available person types...');
  const personTypesResult = await callBitrixApi(clientEndpoint, 'sale.persontype.list', {}, accessToken);
  
  let personTypeId: string | null = null;
  
  if (personTypesResult.result && Array.isArray(personTypesResult.result.personTypes)) {
    const personTypes = personTypesResult.result.personTypes;
    console.log('Available person types:', JSON.stringify(personTypes));
    
    if (personTypes.length > 0) {
      // Use the first available person type
      personTypeId = personTypes[0].ID || personTypes[0].id;
      console.log('Using person type ID:', personTypeId);
    }
  } else if (personTypesResult.result && typeof personTypesResult.result === 'object') {
    // Alternative format: object with IDs as keys
    const personTypeIds = Object.keys(personTypesResult.result);
    console.log('Available person type IDs:', personTypeIds);
    
    if (personTypeIds.length > 0) {
      personTypeId = personTypeIds[0];
      console.log('Using person type ID:', personTypeId);
    }
  } else {
    console.log('Person types result:', JSON.stringify(personTypesResult));
  }
  
  if (!personTypeId) {
    console.error('No person types available in portal. Cannot create pay systems.');
    return 0;
  }
  
  const payMethods = [
    { code: 'pix', name: 'Asaas - PIX', description: 'Pagamento instantâneo via PIX' },
    { code: 'boleto', name: 'Asaas - Boleto', description: 'Pagamento via Boleto Bancário' },
    { code: 'credit_card', name: 'Asaas - Cartão', description: 'Pagamento via Cartão de Crédito' },
  ];

  let successCount = 0;

  for (const method of payMethods) {
    const paySystemResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.add', {
      NAME: method.name,
      DESCRIPTION: method.description,
      PSA_NAME: method.name,
      BX_REST_HANDLER: 'asaas_payments',
      ACTIVE: 'Y',
      ENTITY_REGISTRY_TYPE: 'ORDER',
      PERSON_TYPE_ID: personTypeId,
      NEW_WINDOW: 'N',
      LOGOTIP: ASAAS_LOGO_BASE64,
      SETTINGS: {
        PAYMENT_METHOD: { TYPE: 'VALUE', VALUE: method.code },
      },
    }, accessToken);

    if (paySystemResult.result) {
      console.log(`Created pay system: ${method.name} (ID: ${paySystemResult.result})`);
      successCount++;
      
      // Save to database
      await supabase.from('bitrix_pay_systems').insert({
        installation_id: installationId,
        pay_system_id: String(paySystemResult.result),
        payment_method: method.code,
        is_active: true,
      });
    } else if (paySystemResult.error) {
      console.error(`Failed to create pay system ${method.name}:`, paySystemResult.error, paySystemResult.error_description);
    }
  }

  return successCount;
}

// Update existing pay systems with logo
async function updatePaySystemsLogo(clientEndpoint: string, accessToken: string, installationId: string, supabase: any) {
  console.log('Updating existing pay systems with logo...');
  
  // Fetch existing pay systems from database
  const { data: paySystems, error } = await supabase
    .from('bitrix_pay_systems')
    .select('pay_system_id, payment_method')
    .eq('installation_id', installationId);
  
  if (error || !paySystems || paySystems.length === 0) {
    console.log('No existing pay systems found to update');
    return 0;
  }
  
  let updatedCount = 0;
  
  for (const ps of paySystems) {
    console.log(`Updating pay system ${ps.pay_system_id} with logo...`);
    
    const updateResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.update', {
      ID: ps.pay_system_id,
      FIELDS: {
        LOGOTIP: ASAAS_LOGO_BASE64
      }
    }, accessToken);
    
    if (updateResult.result) {
      console.log(`Successfully updated pay system ${ps.pay_system_id} with logo`);
      updatedCount++;
    } else if (updateResult.error) {
      console.error(`Failed to update pay system ${ps.pay_system_id}:`, updateResult.error);
    }
  }
  
  console.log(`Updated ${updatedCount}/${paySystems.length} pay systems with logo`);
  return updatedCount;
}

// Register automation robots (Asaas: Criar Cobrança, Asaas: Verificar Pagamento)
// forceReregister: if true, always delete and re-add robots (for repair/reinstall scenarios)
async function registerAutomationRobots(clientEndpoint: string, accessToken: string, forceReregister: boolean = false): Promise<{ success: boolean; registered: string[] }> {
  console.log('[Robots] Starting automation robots registration...');
  console.log('[Robots] Using endpoint:', clientEndpoint);
  console.log('[Robots] Force reregister:', forceReregister);
  
  const handlerUrl = `${SUPABASE_URL}/functions/v1/bitrix-robot-handler`;
  
  const robots = [
    {
      CODE: 'asaas_create_charge',
      NAME: 'Asaas: Criar Cobrança',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        payment_method: {
          Name: 'Método de Pagamento',
          Type: 'select',
          Options: { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão de Crédito' },
          Required: 'Y',
          Default: 'pix',
        },
        amount: { Name: 'Valor da Cobrança (R$)', Type: 'double', Required: 'Y' },
        customer_name: { Name: 'Nome do Cliente', Type: 'string', Required: 'Y' },
        customer_email: { Name: 'Email do Cliente', Type: 'string', Required: 'N' },
        customer_document: { Name: 'CPF/CNPJ', Type: 'string', Required: 'Y' },
        due_days: { Name: 'Dias para Vencimento', Type: 'int', Default: 3 },
        description: { Name: 'Descrição da Cobrança', Type: 'string', Required: 'N' },
        external_reference: { Name: 'Referência Externa', Type: 'string', Required: 'N' },
        installment_count: { Name: 'Nº de Parcelas (cartão)', Type: 'int', Required: 'N' },
        interest_percent: { Name: 'Juros ao mês (%)', Type: 'double', Required: 'N' },
        fine_percent: { Name: 'Multa por atraso (%)', Type: 'double', Required: 'N' },
        discount_value: { Name: 'Desconto (R$)', Type: 'double', Required: 'N' },
        discount_due_days: { Name: 'Validade do desconto (dias antes venc.)', Type: 'int', Required: 'N' },
        bitrix_entity_type: {
          Name: 'Tipo de Entidade Bitrix (alvo)',
          Type: 'select',
          Options: { deal: 'Negócio', lead: 'Lead', contact: 'Contato', company: 'Empresa' },
          Default: 'deal',
          Required: 'N',
        },
        bitrix_entity_id: { Name: 'ID do Deal/Lead (opcional)', Type: 'string', Required: 'N' },
      },
      RETURN_PROPERTIES: {
        charge_id: { Name: 'ID da Cobrança', Type: 'string' },
        charge_status: { Name: 'Status', Type: 'string' },
        payment_url: { Name: 'Link de Pagamento', Type: 'string' },
        pix_code: { Name: 'Código PIX Copia-Cola', Type: 'string' },
        boleto_url: { Name: 'URL do Boleto', Type: 'string' },
        error: { Name: 'Mensagem de Erro', Type: 'string' },
      },
    },
    {
      CODE: 'asaas_check_payment',
      NAME: 'Asaas: Verificar Pagamento',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        charge_id: {
          Name: 'ID da Cobrança',
          Type: 'string',
          Required: 'Y',
        },
        bitrix_entity_type: {
          Name: 'Tipo de Entidade Bitrix (alvo)',
          Type: 'select',
          Options: { deal: 'Negócio', lead: 'Lead', contact: 'Contato', company: 'Empresa' },
          Default: 'deal',
          Required: 'N',
        },
        bitrix_entity_id: {
          Name: 'ID do Deal/Lead (opcional)',
          Type: 'string',
          Required: 'N',
        },
      },
      RETURN_PROPERTIES: {
        status: { Name: 'Status do Pagamento', Type: 'string' },
        paid_at: { Name: 'Data do Pagamento', Type: 'string' },
        paid_value: { Name: 'Valor Pago', Type: 'double' },
        error: { Name: 'Mensagem de Erro', Type: 'string' },
      },
    },
    {
      CODE: 'asaas_create_subscription',
      NAME: 'Asaas: Criar Assinatura',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        payment_method: {
          Name: 'Método de Pagamento',
          Type: 'select',
          Options: { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão de Crédito' },
          Required: 'Y',
          Default: 'pix',
        },
        amount: { Name: 'Valor da Assinatura (R$)', Type: 'double', Required: 'Y' },
        cycle: {
          Name: 'Ciclo de Cobrança',
          Type: 'select',
          Options: {
            WEEKLY: 'Semanal',
            BIWEEKLY: 'Quinzenal',
            MONTHLY: 'Mensal',
            BIMONTHLY: 'Bimestral',
            QUARTERLY: 'Trimestral',
            SEMIANNUALLY: 'Semestral',
            YEARLY: 'Anual',
          },
          Required: 'Y',
          Default: 'MONTHLY',
        },
        customer_name: { Name: 'Nome do Cliente', Type: 'string', Required: 'Y' },
        customer_email: { Name: 'Email do Cliente', Type: 'string', Required: 'N' },
        customer_document: { Name: 'CPF/CNPJ', Type: 'string', Required: 'Y' },
        first_due_days: { Name: 'Dias para Primeira Cobrança', Type: 'int', Default: 7 },
        description: { Name: 'Descrição da Assinatura', Type: 'string', Required: 'N' },
        end_date: { Name: 'Data Final (YYYY-MM-DD, opcional)', Type: 'string', Required: 'N' },
        max_payments: { Name: 'Máx. cobranças (opcional)', Type: 'int', Required: 'N' },
        bitrix_entity_type: {
          Name: 'Tipo de Entidade Bitrix (alvo)',
          Type: 'select',
          Options: { deal: 'Negócio', lead: 'Lead', contact: 'Contato', company: 'Empresa' },
          Default: 'deal',
          Required: 'N',
        },
        bitrix_entity_id: { Name: 'ID do Deal/Lead (opcional)', Type: 'string', Required: 'N' },
      },
      RETURN_PROPERTIES: {
        subscription_id: { Name: 'ID da Assinatura', Type: 'string' },
        subscription_status: { Name: 'Status', Type: 'string' },
        next_due_date: { Name: 'Próximo Vencimento', Type: 'string' },
        customer_id: { Name: 'ID do Cliente', Type: 'string' },
        error: { Name: 'Mensagem de Erro', Type: 'string' },
      },
    },
    {
      CODE: 'asaas_cancel_subscription',
      NAME: 'Asaas: Cancelar Assinatura',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        subscription_id: {
          Name: 'ID da Assinatura',
          Type: 'string',
          Required: 'Y',
        },
        bitrix_entity_type: {
          Name: 'Tipo de Entidade Bitrix (alvo)',
          Type: 'select',
          Options: { deal: 'Negócio', lead: 'Lead', contact: 'Contato', company: 'Empresa' },
          Default: 'deal',
          Required: 'N',
        },
        bitrix_entity_id: {
          Name: 'ID do Deal/Lead (opcional)',
          Type: 'string',
          Required: 'N',
        },
      },
      RETURN_PROPERTIES: {
        subscription_id: { Name: 'ID da Assinatura', Type: 'string' },
        status: { Name: 'Status', Type: 'string' },
        error: { Name: 'Mensagem de Erro', Type: 'string' },
      },
    },
    {
      CODE: 'asaas_create_invoice',
      NAME: 'Asaas: Emitir Nota Fiscal',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        charge_id: {
          Name: 'ID da Cobrança (opcional)',
          Type: 'string',
          Required: 'N',
        },
        value: {
          Name: 'Valor (se não vinculada)',
          Type: 'double',
          Required: 'N',
        },
        service_description: {
          Name: 'Descrição do Serviço',
          Type: 'string',
          Required: 'N',
        },
        observations: {
          Name: 'Observações',
          Type: 'string',
          Required: 'N',
        },
        bitrix_entity_type: {
          Name: 'Tipo de Entidade Bitrix (alvo)',
          Type: 'select',
          Options: { deal: 'Negócio', lead: 'Lead', contact: 'Contato', company: 'Empresa' },
          Default: 'deal',
          Required: 'N',
        },
        bitrix_entity_id: {
          Name: 'ID do Deal/Lead (opcional)',
          Type: 'string',
          Required: 'N',
        },
      },
      RETURN_PROPERTIES: {
        invoice_id: { Name: 'ID da Nota Fiscal', Type: 'string' },
        invoice_status: { Name: 'Status', Type: 'string' },
        invoice_number: { Name: 'Número da NF', Type: 'string' },
        invoice_url: { Name: 'URL da NF', Type: 'string' },
        error: { Name: 'Mensagem de Erro', Type: 'string' },
      },
    },
  ];

  const registered: string[] = [];

  for (const robot of robots) {
    // Always delete existing robot first (handles reinstallations and repairs)
    console.log(`[Robots] Deleting existing robot ${robot.CODE}...`);
    const deleteResult = await callBitrixApi(clientEndpoint, 'bizproc.robot.delete', {
      CODE: robot.CODE,
    }, accessToken);
    // Ignore "not found" errors - robot may not exist
    if (deleteResult.error && !deleteResult.error.includes('NOT_FOUND')) {
      console.log(`[Robots] Delete ${robot.CODE}:`, deleteResult.error);
    } else {
      console.log(`[Robots] Delete ${robot.CODE}: done`);
    }

    // Register the robot
    console.log(`[Robots] Registering robot ${robot.CODE}...`);
    const addResult = await callBitrixApi(clientEndpoint, 'bizproc.robot.add', robot, accessToken);
    
    if (addResult.error) {
      console.error(`[Robots] Failed to register ${robot.CODE}:`, addResult.error, addResult.error_description);
    } else {
      console.log(`[Robots] Successfully registered ${robot.CODE}:`, addResult.result);
      registered.push(robot.CODE);
    }
  }
  
  console.log(`[Robots] Registration complete: ${registered.length}/${robots.length} robots registered`);
  return { success: registered.length > 0, registered };
}

// Self-healing robots - checks if robots exist and re-registers if missing
async function ensureAutomationRobots(
  clientEndpoint: string, 
  accessToken: string, 
  installationId: string, 
  supabase: any,
  forceRepair: boolean = false
): Promise<{ success: boolean; message: string; action: 'none' | 'repaired' | 'failed' }> {
  console.log('[Robots Ensure] Checking robot status...');
  console.log('[Robots Ensure] Client endpoint:', clientEndpoint);
  console.log('[Robots Ensure] Force repair:', forceRepair);
  
  const expectedRobots = ['asaas_create_charge', 'asaas_check_payment', 'asaas_create_subscription', 'asaas_cancel_subscription', 'asaas_create_invoice'];
  
  // Step 1: Call bizproc.robot.list to check which robots exist
  console.log('[Robots Ensure] Calling bizproc.robot.list...');
  const listResult = await callBitrixApi(clientEndpoint, 'bizproc.robot.list', {}, accessToken);
  
  let existingRobots: string[] = [];
  
  if (listResult.result && Array.isArray(listResult.result)) {
    // Extract robot codes from the list
    existingRobots = listResult.result
      .filter((r: any) => r.CODE && expectedRobots.includes(r.CODE))
      .map((r: any) => r.CODE);
    console.log('[Robots Ensure] Found existing robots:', existingRobots);
  } else if (listResult.error) {
    console.log('[Robots Ensure] bizproc.robot.list error:', listResult.error, listResult.error_description);
    // If we can't list robots, assume we need to try registering
    existingRobots = [];
  }
  
  // Step 2: Determine if we need to (re)register
  const missingRobots = expectedRobots.filter(code => !existingRobots.includes(code));
  console.log('[Robots Ensure] Missing robots:', missingRobots);
  
  if (missingRobots.length === 0 && !forceRepair) {
    console.log('[Robots Ensure] All robots present, no action needed');
    
    // Ensure database is in sync
    await supabase
      .from('bitrix_installations')
      .update({ 
        robots_registered: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', installationId);
    
    return { success: true, message: 'Todos os robots já estão registrados', action: 'none' };
  }
  
  // Step 3: Register missing robots (or all if forceRepair)
  console.log('[Robots Ensure] Registering robots...');
  const registerResult = await registerAutomationRobots(clientEndpoint, accessToken, true);
  
  if (registerResult.success) {
    // Update database to mark robots as registered
    await supabase
      .from('bitrix_installations')
      .update({ 
        robots_registered: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', installationId);
    
    console.log('[Robots Ensure] Success - registered:', registerResult.registered);
    return { 
      success: true, 
      message: `Robots registrados: ${registerResult.registered.join(', ')}`,
      action: 'repaired'
    };
  } else {
    console.log('[Robots Ensure] Failed to register robots');
    return { success: false, message: 'Falha ao registrar robots', action: 'failed' };
  }
}

async function registerPaySystemsLazy(
  domain: string | null,
  accessToken: string,
  serverEndpoint: string,
  installationId: string,
  supabase: any
): Promise<{ success: boolean; message: string; domain?: string }> {
  console.log('=== LAZY PAY SYSTEM REGISTRATION ===');
  console.log('Initial domain:', domain);
  console.log('Server endpoint:', serverEndpoint);
  console.log('Installation ID:', installationId);
  
  let portalDomain = domain;
  
  // If we don't have a valid domain, try to get it from the profile API
  if (!portalDomain || portalDomain.length < 5 || !portalDomain.includes('.')) {
    console.log('Domain invalid or missing, attempting to fetch from profile API...');
    
    const fetchedDomain = await getPortalDomainFromProfile(serverEndpoint, accessToken);
    
    if (fetchedDomain) {
      portalDomain = fetchedDomain;
      console.log('Successfully fetched domain from API:', portalDomain);
    } else {
      console.log('Failed to fetch domain from API');
      return { success: false, message: 'Could not determine portal domain. Please reinstall the app or contact support.' };
    }
  }
  
  // Validate domain format
  if (!portalDomain || !portalDomain.includes('.')) {
    console.log('Invalid domain format:', portalDomain);
    return { success: false, message: `Invalid domain format: ${portalDomain}` };
  }
  
  // Build the REST endpoint from domain
  const clientEndpoint = `https://${portalDomain}/rest/`;
  console.log('Client endpoint:', clientEndpoint);
  
  // Build iframe URL
  const supabaseUrl = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  const iframeBaseUrl = `https://${supabaseUrl}.supabase.co`;
  
  try {
    // Step 1: Register the pay system handler
    console.log('Step 1: Registering pay system handler...');
    const handlerResult = await registerPaySystemHandler(clientEndpoint, accessToken, iframeBaseUrl);
    
    // Check if handler registration failed (but allow if already exists)
    if (handlerResult.error && !handlerResult.alreadyExisted) {
      return { success: false, message: `Handler registration failed: ${handlerResult.error_description || handlerResult.error}` };
    }
    
    if (handlerResult.alreadyExisted) {
      console.log('Handler already exists - updating logos and checking for missing pay systems');
      
      // Try to update existing pay systems with the logo
      await updatePaySystemsLogo(clientEndpoint, accessToken, installationId, supabase);
    }
    
    // Step 2: Create pay systems
    console.log('Step 2: Creating pay systems...');
    const successCount = await createPaySystems(clientEndpoint, accessToken, installationId, supabase);
    
    if (successCount > 0) {
      // Mark installation as having pay systems registered and update domain
      await supabase
        .from('bitrix_installations')
        .update({ 
          pay_systems_registered: true, 
          domain: portalDomain,
          updated_at: new Date().toISOString() 
        })
        .eq('id', installationId);
      
      console.log(`Pay system registration completed: ${successCount}/3 created`);
      return { success: true, message: `${successCount} pay systems created successfully`, domain: portalDomain };
    } else if (handlerResult.alreadyExisted) {
      // If handler existed and no new pay systems were created, logos were updated
      return { success: true, message: 'Pay systems logos updated', domain: portalDomain };
    } else {
      return { success: false, message: 'No pay systems were created' };
    }
  } catch (error) {
    console.error('Error during lazy pay system registration:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Register CRM placements (detail tabs for Lead, Deal)
async function registerPlacements(clientEndpoint: string, accessToken: string): Promise<{ success: boolean; registered: string[] }> {
  console.log('[Placements] Registering CRM detail tab placements...');
  
  const handlerUrl = `${SUPABASE_URL}/functions/v1/bitrix-crm-detail-tab`;
  const placements = [
    { placement: 'CRM_LEAD_DETAIL_TAB', title: 'Pagamentos Asaas' },
    { placement: 'CRM_DEAL_DETAIL_TAB', title: 'Pagamentos Asaas' },
  ];

  const registered: string[] = [];

  for (const p of placements) {
    // Unbind first to avoid duplicates
    await callBitrixApi(clientEndpoint, 'placement.unbind', {
      PLACEMENT: p.placement,
      HANDLER: handlerUrl,
    }, accessToken);

    const result = await callBitrixApi(clientEndpoint, 'placement.bind', {
      PLACEMENT: p.placement,
      HANDLER: handlerUrl,
      TITLE: p.title,
    }, accessToken);

    if (result.result || (result.error && String(result.error).includes('ALREADY'))) {
      console.log(`[Placements] Registered ${p.placement}`);
      registered.push(p.placement);
    } else {
      console.error(`[Placements] Failed ${p.placement}:`, result.error);
    }
  }

  return { success: registered.length > 0, registered };
}

// Register CRM activity badges
async function registerBadges(clientEndpoint: string, accessToken: string): Promise<{ success: boolean; registered: string[] }> {
  console.log('[Badges] Registering CRM activity badges...');

  const badges = [
    { code: 'asaas_charge_created', title: 'Asaas', value: 'Cobrança Criada', type: 'primary' },
    { code: 'asaas_charge_viewed', title: 'Asaas', value: 'Cobrança Visualizada', type: 'warning' },
    { code: 'asaas_charge_overdue', title: 'Asaas', value: 'Cobrança em Atraso', type: 'failure' },
    { code: 'asaas_charge_paid', title: 'Asaas', value: 'Cobrança Paga', type: 'success' },
    { code: 'asaas_charge_cancelled', title: 'Asaas', value: 'Cobrança Cancelada', type: 'secondary' },
  ];

  const registered: string[] = [];

  for (const b of badges) {
    // Delete first to avoid duplicates
    await callBitrixApi(clientEndpoint, 'crm.activity.badge.delete', { code: b.code }, accessToken);

    const result = await callBitrixApi(clientEndpoint, 'crm.activity.badge.add', {
      code: b.code,
      title: b.title,
      value: b.value,
      type: b.type,
    }, accessToken);

    if (result.result || (result.error && String(result.error).includes('ALREADY'))) {
      console.log(`[Badges] Registered ${b.code}`);
      registered.push(b.code);
    } else {
      console.error(`[Badges] Failed ${b.code}:`, result.error, result.error_description);
    }
  }

  return { success: registered.length > 0, registered };
}

// Auto-create Asaas custom fields (UF_CRM_ASAAS_*) on Deal entity. Idempotent.
async function ensureDealAsaasFields(clientEndpoint: string, accessToken: string): Promise<{ success: boolean; created: string[] }> {
  console.log('[DealFields] Ensuring UF_CRM_ASAAS_* fields on Deal...');
  const fields: Array<{ FIELD_NAME: string; USER_TYPE_ID: string; LABEL: string }> = [
    // Charge
    { FIELD_NAME: 'UF_CRM_ASAAS_CHARGE_ID', USER_TYPE_ID: 'string', LABEL: 'ID Cobrança Asaas' },
    { FIELD_NAME: 'UF_CRM_ASAAS_CHARGE_URL', USER_TYPE_ID: 'string', LABEL: 'Link de Pagamento' },
    { FIELD_NAME: 'UF_CRM_ASAAS_CHARGE_STATUS', USER_TYPE_ID: 'string', LABEL: 'Status Cobrança' },
    { FIELD_NAME: 'UF_CRM_ASAAS_CHARGE_VALUE', USER_TYPE_ID: 'double', LABEL: 'Valor da Cobrança' },
    { FIELD_NAME: 'UF_CRM_ASAAS_BILLING_TYPE', USER_TYPE_ID: 'string', LABEL: 'Forma de Pagamento' },
    { FIELD_NAME: 'UF_CRM_ASAAS_DUE_DATE', USER_TYPE_ID: 'date', LABEL: 'Data de Vencimento' },
    { FIELD_NAME: 'UF_CRM_ASAAS_PAID_AT', USER_TYPE_ID: 'date', LABEL: 'Data do Pagamento' },
    { FIELD_NAME: 'UF_CRM_ASAAS_PIX_CODE', USER_TYPE_ID: 'string', LABEL: 'PIX Copia-Cola' },
    { FIELD_NAME: 'UF_CRM_ASAAS_BOLETO_URL', USER_TYPE_ID: 'string', LABEL: 'URL do Boleto' },
    // Subscription
    { FIELD_NAME: 'UF_CRM_ASAAS_SUBSCRIPTION_ID', USER_TYPE_ID: 'string', LABEL: 'ID Assinatura Asaas' },
    { FIELD_NAME: 'UF_CRM_ASAAS_SUBSCRIPTION_URL', USER_TYPE_ID: 'string', LABEL: 'URL Assinatura' },
    { FIELD_NAME: 'UF_CRM_ASAAS_SUBSCRIPTION_STATUS', USER_TYPE_ID: 'string', LABEL: 'Status Assinatura' },
    { FIELD_NAME: 'UF_CRM_ASAAS_SUBSCRIPTION_VALUE', USER_TYPE_ID: 'double', LABEL: 'Valor Assinatura' },
    { FIELD_NAME: 'UF_CRM_ASAAS_NEXT_DUE', USER_TYPE_ID: 'date', LABEL: 'Próximo Vencimento' },
    { FIELD_NAME: 'UF_CRM_ASAAS_CYCLE', USER_TYPE_ID: 'string', LABEL: 'Ciclo' },
    // Invoice (NFSe)
    { FIELD_NAME: 'UF_CRM_ASAAS_INVOICE_ID', USER_TYPE_ID: 'string', LABEL: 'ID NFSe' },
    { FIELD_NAME: 'UF_CRM_ASAAS_INVOICE_NUMBER', USER_TYPE_ID: 'string', LABEL: 'Número da NFSe' },
    { FIELD_NAME: 'UF_CRM_ASAAS_INVOICE_PDF', USER_TYPE_ID: 'string', LABEL: 'PDF da NFSe' },
    { FIELD_NAME: 'UF_CRM_ASAAS_INVOICE_STATUS', USER_TYPE_ID: 'string', LABEL: 'Status NFSe' },
    // Parcelado (lista de parcelas em JSON)
    { FIELD_NAME: 'UF_CRM_ASAAS_INSTALLMENTS_JSON', USER_TYPE_ID: 'string', LABEL: 'Parcelas (JSON)' },
    // Contrato
    { FIELD_NAME: 'UF_CRM_ASAAS_CONTRACT_START', USER_TYPE_ID: 'date', LABEL: 'Início do Contrato' },
    { FIELD_NAME: 'UF_CRM_ASAAS_CONTRACT_END', USER_TYPE_ID: 'date', LABEL: 'Fim do Contrato' },
    { FIELD_NAME: 'UF_CRM_ASAAS_ENTRY_INSTALLMENTS', USER_TYPE_ID: 'integer', LABEL: 'Nº Parcelas da Entrada' },
    { FIELD_NAME: 'UF_CRM_ASAAS_RECURRING_INSTALLMENTS', USER_TYPE_ID: 'integer', LABEL: 'Nº Parcelas Recorrentes' },
  ];

  const created: string[] = [];
  for (const f of fields) {
    const res = await callBitrixApi(clientEndpoint, 'crm.deal.userfield.add', {
      fields: {
        FIELD_NAME: f.FIELD_NAME,
        USER_TYPE_ID: f.USER_TYPE_ID,
        EDIT_FORM_LABEL: { pt: f.LABEL, br: f.LABEL, en: f.LABEL, ru: f.LABEL },
        LIST_COLUMN_LABEL: { pt: f.LABEL, br: f.LABEL, en: f.LABEL, ru: f.LABEL },
        LIST_FILTER_LABEL: { pt: f.LABEL, br: f.LABEL, en: f.LABEL, ru: f.LABEL },
        SHOW_FILTER: 'Y',
        SHOW_IN_LIST: 'Y',
        EDIT_IN_LIST: 'Y',
        IS_SEARCHABLE: 'Y',
        MULTIPLE: 'N',
      },
    }, accessToken);

    if (res.result) {
      console.log(`[DealFields] Created ${f.FIELD_NAME}`);
      created.push(f.FIELD_NAME);
    } else if (res.error && /ALREADY|EXIST|DUPLICATE/i.test(String(res.error) + ' ' + String(res.error_description || ''))) {
      console.log(`[DealFields] Already exists: ${f.FIELD_NAME}`);
    } else {
      console.error(`[DealFields] Failed ${f.FIELD_NAME}:`, res.error, res.error_description);
    }
  }
  return { success: true, created };
}

// ============= END BITRIX API FUNCTIONS =============

// ============= CRM TAB HELPERS =============

function addPeriod(date: Date, period: string, count = 1): Date {
  const d = new Date(date);
  const map: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30, QUARTERLY: 90, SEMIANNUALLY: 180, YEARLY: 365 };
  const days = (map[period] || 30) * count;
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function splitInstallmentValues(saldo: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((saldo * 100) / n) / 100;
  const arr = Array(n).fill(base);
  const used = base * n;
  const diff = Math.round((saldo - used) * 100) / 100;
  arr[n - 1] = Math.round((base + diff) * 100) / 100;
  return arr;
}

async function asaasFetch(apiKey: string, baseUrl: string, path: string, init: RequestInit = {}): Promise<any> {
  const resp = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await resp.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function loadInstallationContext(supabase: any, inst: any) {
  const { data: cfg } = await supabase
    .from('asaas_configurations')
    .select('api_key, environment')
    .eq('tenant_id', inst.tenant_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!cfg?.api_key) throw new Error('Asaas não configurado para este tenant');
  const baseUrl = cfg.environment === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
  return { apiKey: cfg.api_key, baseUrl, environment: cfg.environment };
}

async function getEntityContact(clientEndpoint: string, accessToken: string, entityType: string, entityId: string) {
  // Fetch the deal/lead to get contact info, opportunity, etc.
  const method = entityType === 'deal' ? 'crm.deal.get' : 'crm.lead.get';
  const res = await callBitrixApi(clientEndpoint, method, { id: entityId }, accessToken);
  const entity = res.result || {};
  
  let contact: any = {};
  if (entityType === 'deal' && entity.CONTACT_ID) {
    const cRes = await callBitrixApi(clientEndpoint, 'crm.contact.get', { id: entity.CONTACT_ID }, accessToken);
    contact = cRes.result || {};
  } else if (entityType === 'lead') {
    // Lead has contact info inline
    contact = {
      NAME: entity.NAME,
      LAST_NAME: entity.LAST_NAME,
      EMAIL: entity.EMAIL,
      PHONE: entity.PHONE,
      UF_CRM_CPF: entity.UF_CRM_CPF,
    };
  }
  
  const email = Array.isArray(contact.EMAIL) ? contact.EMAIL[0]?.VALUE : (contact.EMAIL || '');
  const phone = Array.isArray(contact.PHONE) ? contact.PHONE[0]?.VALUE : (contact.PHONE || '');
  // Try several common CPF field names
  const cpfRaw = contact.UF_CRM_CPF || contact.UF_CRM_CPF_CNPJ || contact.UF_CRM_DOCUMENT || entity.UF_CRM_CPF || '';
  const cpfCnpj = String(cpfRaw).replace(/\D/g, '');
  const name = [contact.NAME, contact.LAST_NAME].filter(Boolean).join(' ').trim() || entity.TITLE || 'Cliente';
  
  return {
    entity,
    contact,
    customerData: { name, email, phone, cpfCnpj },
    dealValue: parseFloat(entity.OPPORTUNITY || '0') || 0,
  };
}

async function findOrCreateAsaasCustomerSimple(apiKey: string, baseUrl: string, data: { name: string; email: string; cpfCnpj: string; phone?: string }) {
  if (!data.cpfCnpj || data.cpfCnpj.length < 11) {
    throw new Error('CPF/CNPJ do contato é obrigatório para criar cobrança. Cadastre o documento no Contato do Bitrix.');
  }
  const search = await asaasFetch(apiKey, baseUrl, `/customers?cpfCnpj=${data.cpfCnpj}`);
  if (search.data && search.data.length > 0) return search.data[0];
  const created = await asaasFetch(apiKey, baseUrl, `/customers`, {
    method: 'POST',
    body: JSON.stringify({
      name: data.name || 'Cliente',
      email: data.email || undefined,
      cpfCnpj: data.cpfCnpj,
      mobilePhone: data.phone || undefined,
    }),
  });
  if (created.errors) throw new Error('Asaas: ' + JSON.stringify(created.errors));
  return created;
}

async function getClientEndpointForInst(inst: any, supabase: any): Promise<{ endpoint: string; token: string } | null> {
  // Reload installation to get fresh tokens
  const { data: full } = await supabase
    .from('bitrix_installations')
    .select('domain, access_token')
    .eq('id', inst.id)
    .maybeSingle();
  if (!full?.access_token || !full?.domain) return null;
  return { endpoint: `https://${full.domain}/rest/`, token: full.access_token };
}

async function handleCrmTabLoad(body: any, supabase: any, inst: any): Promise<Response> {
  try {
    const { entityType, entityId } = body;
    if (!entityType || !entityId) return jsonError('entityType e entityId são obrigatórios');
    
    const ctx = await loadInstallationContext(supabase, inst);
    const ep = await getClientEndpointForInst(inst, supabase);
    if (!ep) return jsonError('Instalação Bitrix sem token de acesso');
    
    let customer: any = null;
    let charges: any[] = [];
    let subscriptions: any[] = [];
    let dealValue = 0;
    let savedFields: Record<string, any> = {};
    
    try {
      const ec = await getEntityContact(ep.endpoint, ep.token, entityType, entityId);
      dealValue = ec.dealValue;
      savedFields = {
        contractStart: ec.entity?.UF_CRM_ASAAS_CONTRACT_START || '',
        contractEnd: ec.entity?.UF_CRM_ASAAS_CONTRACT_END || '',
        entryInstallments: ec.entity?.UF_CRM_ASAAS_ENTRY_INSTALLMENTS || '',
        recurringInstallments: ec.entity?.UF_CRM_ASAAS_RECURRING_INSTALLMENTS || '',
        cycle: ec.entity?.UF_CRM_ASAAS_CYCLE || '',
      };
      
      if (ec.customerData.cpfCnpj && ec.customerData.cpfCnpj.length >= 11) {
        const search = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/customers?cpfCnpj=${ec.customerData.cpfCnpj}`);
        if (search.data && search.data.length > 0) {
          customer = search.data[0];
          const ch = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/payments?customer=${customer.id}&limit=100`);
          charges = (ch.data || []).sort((a: any, b: any) => (a.dueDate || '').localeCompare(b.dueDate || ''));
          const sb = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/subscriptions?customer=${customer.id}&limit=50`);
          subscriptions = sb.data || [];
        }
      }
    } catch (e: any) {
      console.error('[CrmTabLoad] contact/charge error:', e.message);
    }
    
    // Also surface raw contact data so the UI can validate required fields client-side
    let customerData: any = null;
    try {
      const ec2 = await getEntityContact(ep.endpoint, ep.token, entityType, entityId);
      customerData = ec2.customerData;
    } catch { /* ignore */ }
    return jsonSuccess({ customer, charges, subscriptions, dealValue, savedFields, customerData });
  } catch (e: any) {
    return jsonError(e.message);
  }
}

async function updateDealUfFields(clientEndpoint: string, accessToken: string, entityType: string, entityId: string, fields: Record<string, any>) {
  if (entityType !== 'deal') return; // Lead writes skipped for now
  await callBitrixApi(clientEndpoint, 'crm.deal.update', { id: entityId, fields }, accessToken);
}

// Post a comment on the Deal/Lead timeline
async function addTimelineComment(clientEndpoint: string, accessToken: string, entityType: 'deal' | 'lead', entityId: string, comment: string): Promise<void> {
  try {
    const ENTITY_TYPE = entityType === 'deal' ? 'deal' : 'lead';
    await callBitrixApi(clientEndpoint, 'crm.timeline.comment.add', {
      fields: { ENTITY_ID: Number(entityId), ENTITY_TYPE, COMMENT: comment },
    }, accessToken);
  } catch (e: any) {
    console.error('[Timeline] comment.add failed:', e?.message || e);
  }
}

function formatAsaasErrors(errors: any): string {
  if (!errors) return '';
  if (Array.isArray(errors)) {
    return errors.map((e: any) => {
      const code = e.code ? '[' + e.code + '] ' : '';
      const field = e.field ? '(' + e.field + ') ' : '';
      const desc = e.description || e.message || JSON.stringify(e);
      return '- ' + code + field + desc;
    }).join('\n');
  }
  if (typeof errors === 'string') return '- ' + errors;
  return '- ' + JSON.stringify(errors);
}

async function handleCrmTabCreate(body: any, supabase: any, inst: any): Promise<Response> {
  const { entityType, entityId, payload } = body;
  const ep0 = await getClientEndpointForInst(inst, supabase);
  try {
    if (!payload) return jsonError('payload obrigatório');
    const ctx = await loadInstallationContext(supabase, inst);
    const ep = ep0;
    if (!ep) return jsonError('Instalação Bitrix sem token de acesso');
    
    const ec = await getEntityContact(ep.endpoint, ep.token, entityType, entityId);

    // === Server-side required-field validation ===
    const missing: string[] = [];
    if (!ec.customerData.cpfCnpj || ec.customerData.cpfCnpj.length < 11) missing.push('CPF/CNPJ do contato');
    if (!ec.customerData.email && !ec.customerData.phone) missing.push('E-mail ou telefone do contato');
    const total = Number(payload.total) || 0;
    if (!(total > 0)) missing.push('Valor total');
    if (!payload.billingType) missing.push('Forma de pagamento');
    if (!payload.startDate) missing.push('Data de início');
    const type = payload.type as 'ONCE' | 'INSTALLMENT' | 'SUBSCRIPTION';
    const period = payload.period || 'MONTHLY';
    const installments = Math.max(1, parseInt(payload.installments) || 1);
    if (type === 'SUBSCRIPTION') {
      if (!period) missing.push('Ciclo (período)');
    }
    if (type === 'INSTALLMENT') {
      if (!period) missing.push('Ciclo (período)');
      if (!(installments > 0)) missing.push('Nº de parcelas');
    }
    if (missing.length > 0) {
      const msg = 'Campos obrigatórios faltando:\n' + missing.map(m => '- ' + m).join('\n');
      await addTimelineComment(ep.endpoint, ep.token, entityType, entityId,
        '❌ Cobrança Asaas não enviada\n\n' + msg);
      return jsonError(msg);
    }

    const customer = await findOrCreateAsaasCustomerSimple(ctx.apiKey, ctx.baseUrl, ec.customerData);

    const billingType = payload.billingType || 'BOLETO';
    const entry = Number(payload.entryValue) || 0;
    const description = (payload.description || '').toString();
    const startDate = new Date(payload.startDate + 'T12:00:00Z');
    if (isNaN(startDate.getTime())) throw new Error('Data de início inválida');
    
    const externalRef = `bitrix-${entityType}-${entityId}`;
    const created: any[] = [];
    const installmentsList: any[] = [];
    const successList: Array<{ label: string; id: string; value: number; dueDate: string; url?: string }> = [];
    const errorList: Array<{ label: string; errors: any; payload: any }> = [];
    let firstCharge: any = null;
    let subscriptionRec: any = null;
    let entryCharge: any = null;
    
    let entryItems: Array<{ value: number; dueDate: string }> = [];
    if (Array.isArray(payload.entryInstallments) && payload.entryInstallments.length > 0) {
      entryItems = payload.entryInstallments
        .map((it: any) => ({ value: Number(it.value) || 0, dueDate: String(it.dueDate || '') }))
        .filter((it: any) => it.value > 0 && it.dueDate);
    } else if (entry > 0) {
      entryItems = [{ value: entry, dueDate: toISODate(startDate) }];
    }
    
    for (let i = 0; i < entryItems.length; i++) {
      const it = entryItems[i];
      const label = entryItems.length > 1 ? `Entrada ${i + 1}/${entryItems.length}` : 'Entrada';
      const entryPayload: any = {
        customer: customer.id,
        billingType,
        value: it.value,
        dueDate: it.dueDate,
        description: (description ? description + ' - ' : '') + label,
        externalReference: externalRef + '-entry-' + (i + 1),
      };
      const r = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/payments`, { method: 'POST', body: JSON.stringify(entryPayload) });
      if (r.errors) {
        errorList.push({ label, errors: r.errors, payload: entryPayload });
        continue;
      }
      if (!entryCharge) entryCharge = r;
      created.push(r);
      successList.push({ label, id: r.id, value: r.value, dueDate: r.dueDate, url: r.invoiceUrl });
      installmentsList.push({ type: 'entry', n: i + 1, label, id: r.id, value: r.value, dueDate: r.dueDate, url: r.invoiceUrl });
    }
    
    const saldo = Math.max(0, total - entry);
    
    if (type === 'ONCE') {
      const p: any = {
        customer: customer.id, billingType,
        value: total, dueDate: toISODate(startDate),
        description: description || `Cobrança ${entityType} ${entityId}`,
        externalReference: externalRef,
      };
      const r = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/payments`, { method: 'POST', body: JSON.stringify(p) });
      if (r.errors) {
        errorList.push({ label: 'Cobrança única', errors: r.errors, payload: p });
      } else {
        firstCharge = entryCharge || r;
        created.push(r);
        successList.push({ label: 'Cobrança única', id: r.id, value: r.value, dueDate: r.dueDate, url: r.invoiceUrl });
        installmentsList.push({ type: 'balance', n: 1, id: r.id, value: r.value, dueDate: r.dueDate, url: r.invoiceUrl });
      }
    } else if (type === 'INSTALLMENT') {
      const values = splitInstallmentValues(saldo, installments);
      const baseDate = entry > 0 ? addPeriod(startDate, period, 1) : startDate;
      for (let i = 0; i < installments; i++) {
        const dueDate = addPeriod(baseDate, period, i);
        const label = `Parcela ${i + 1}/${installments}`;
        const p: any = {
          customer: customer.id, billingType,
          value: values[i],
          dueDate: toISODate(dueDate),
          description: (description ? description + ' - ' : '') + label,
          externalReference: externalRef + `-p${i + 1}`,
        };
        const r = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/payments`, { method: 'POST', body: JSON.stringify(p) });
        if (r.errors) {
          errorList.push({ label, errors: r.errors, payload: p });
          continue;
        }
        if (!firstCharge) firstCharge = entryCharge || r;
        created.push(r);
        successList.push({ label, id: r.id, value: r.value, dueDate: r.dueDate, url: r.invoiceUrl });
        installmentsList.push({ type: 'balance', n: i + 1, id: r.id, value: r.value, dueDate: r.dueDate, url: r.invoiceUrl });
      }
    } else if (type === 'SUBSCRIPTION') {
      const nextDue = entry > 0 ? addPeriod(startDate, period, 1) : startDate;
      const subPayload: any = {
        customer: customer.id, billingType,
        value: saldo || total,
        nextDueDate: toISODate(nextDue),
        cycle: period,
        description: description || `Assinatura ${entityType} ${entityId}`,
        externalReference: externalRef,
      };
      if (payload.endDate) subPayload.endDate = payload.endDate;
      const r = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/subscriptions`, { method: 'POST', body: JSON.stringify(subPayload) });
      if (r.errors) {
        errorList.push({ label: 'Assinatura recorrente', errors: r.errors, payload: subPayload });
      } else {
        subscriptionRec = r;
        successList.push({ label: 'Assinatura recorrente', id: r.id, value: r.value || (saldo || total), dueDate: r.nextDueDate });
        if (!firstCharge) firstCharge = entryCharge;
      }
    }
    
    // Update Deal UF_CRM_ASAAS_* fields (best-effort)
    try {
      const uf: Record<string, any> = {};
      if (firstCharge) {
        uf.UF_CRM_ASAAS_CHARGE_ID = firstCharge.id;
        uf.UF_CRM_ASAAS_CHARGE_URL = firstCharge.invoiceUrl || '';
        uf.UF_CRM_ASAAS_CHARGE_STATUS = firstCharge.status || '';
        uf.UF_CRM_ASAAS_CHARGE_VALUE = firstCharge.value || 0;
        uf.UF_CRM_ASAAS_BILLING_TYPE = firstCharge.billingType || billingType;
        if (firstCharge.dueDate) uf.UF_CRM_ASAAS_DUE_DATE = firstCharge.dueDate;
        if (firstCharge.bankSlipUrl) uf.UF_CRM_ASAAS_BOLETO_URL = firstCharge.bankSlipUrl;
      }
      if (subscriptionRec) {
        uf.UF_CRM_ASAAS_SUBSCRIPTION_ID = subscriptionRec.id;
        uf.UF_CRM_ASAAS_SUBSCRIPTION_URL = `https://www.asaas.com/subscriptions/show/${subscriptionRec.id}`;
        uf.UF_CRM_ASAAS_SUBSCRIPTION_STATUS = subscriptionRec.status || 'ACTIVE';
        uf.UF_CRM_ASAAS_SUBSCRIPTION_VALUE = subscriptionRec.value || 0;
        uf.UF_CRM_ASAAS_NEXT_DUE = subscriptionRec.nextDueDate || '';
        uf.UF_CRM_ASAAS_CYCLE = subscriptionRec.cycle || period;
      }
      if (installmentsList.length > 0) {
        uf.UF_CRM_ASAAS_INSTALLMENTS_JSON = JSON.stringify(installmentsList);
      }
      uf.UF_CRM_ASAAS_CONTRACT_START = payload.startDate || '';
      if (payload.endDate) uf.UF_CRM_ASAAS_CONTRACT_END = payload.endDate;
      uf.UF_CRM_ASAAS_ENTRY_INSTALLMENTS = entryItems.length || 0;
      uf.UF_CRM_ASAAS_CYCLE = period;
      if (type === 'INSTALLMENT') uf.UF_CRM_ASAAS_RECURRING_INSTALLMENTS = installments;
      else if (type === 'SUBSCRIPTION') uf.UF_CRM_ASAAS_RECURRING_INSTALLMENTS = 0;
      else uf.UF_CRM_ASAAS_RECURRING_INSTALLMENTS = 1;
      if (Object.keys(uf).length > 0) {
        await updateDealUfFields(ep.endpoint, ep.token, entityType, entityId, uf);
      }
    } catch (e: any) {
      console.error('[CrmTabCreate] UF update failed:', e.message);
    }

    // === Timeline comment with success / error summary ===
    try {
      const lines: string[] = [];
      const hasErr = errorList.length > 0;
      const hasOk = successList.length > 0 || !!subscriptionRec;
      if (hasErr && !hasOk) {
        lines.push('❌ Falha ao criar cobrança Asaas');
      } else if (hasErr && hasOk) {
        lines.push('⚠️ Cobrança Asaas criada com erros');
      } else {
        lines.push('✅ Cobrança Asaas criada com sucesso');
      }
      lines.push('');
      lines.push('Valor total: ' + (total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
      lines.push('Forma: ' + billingType + ' · Tipo: ' + type + (type !== 'ONCE' ? ' · Ciclo: ' + period : ''));
      lines.push('Sucesso: ' + successList.length + ' · Erros: ' + errorList.length);
      if (successList.length > 0) {
        lines.push('');
        lines.push('Cobranças criadas:');
        for (const s of successList) {
          const v = (Number(s.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          lines.push('- ' + s.label + ' · ' + v + ' · venc. ' + (s.dueDate || '-') + ' · ID ' + s.id + (s.url ? ' · ' + s.url : ''));
        }
      }
      if (errorList.length > 0) {
        lines.push('');
        lines.push('Erros retornados pelo Asaas:');
        for (const er of errorList) {
          lines.push('• ' + er.label);
          lines.push(formatAsaasErrors(er.errors));
        }
      }
      await addTimelineComment(ep.endpoint, ep.token, entityType, entityId, lines.join('\n'));
    } catch (e: any) {
      console.error('[CrmTabCreate] timeline comment failed:', e.message);
    }

    if (errorList.length > 0 && successList.length === 0 && !subscriptionRec) {
      return jsonError('Asaas: ' + formatAsaasErrors(errorList[0].errors));
    }
    return jsonSuccess({
      created: created.length + (subscriptionRec ? 1 : 0),
      charges: created,
      subscription: subscriptionRec,
      successCount: successList.length,
      errorCount: errorList.length,
      errors: errorList,
    });
  } catch (e: any) {
    console.error('[CrmTabCreate] error:', e);
    if (ep0) {
      try { await addTimelineComment(ep0.endpoint, ep0.token, entityType, entityId,
        '❌ Erro ao processar envio Asaas\n\n' + (e?.message || String(e))); } catch { /* ignore */ }
    }
    return jsonError(e.message);
  }
}

async function handleCrmTabCancelCharge(body: any, supabase: any, inst: any): Promise<Response> {
  try {
    const { chargeId } = body;
    if (!chargeId) return jsonError('chargeId obrigatório');
    const ctx = await loadInstallationContext(supabase, inst);
    const r = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/payments/${chargeId}`, { method: 'DELETE' });
    if (r.errors) throw new Error('Asaas: ' + JSON.stringify(r.errors));
    return jsonSuccess({ deleted: true });
  } catch (e: any) {
    return jsonError(e.message);
  }
}

async function handleCrmTabCancelSub(body: any, supabase: any, inst: any): Promise<Response> {
  try {
    const { subscriptionId } = body;
    if (!subscriptionId) return jsonError('subscriptionId obrigatório');
    const ctx = await loadInstallationContext(supabase, inst);
    const r = await asaasFetch(ctx.apiKey, ctx.baseUrl, `/subscriptions/${subscriptionId}`, { method: 'DELETE' });
    if (r.errors) throw new Error('Asaas: ' + JSON.stringify(r.errors));
    return jsonSuccess({ deleted: true });
  } catch (e: any) {
    return jsonError(e.message);
  }
}

// ============= END CRM TAB HELPERS =============



// Generate auth page when installation is not linked
function generateAuthPage(data: PaymentData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ativar Integração - Asaas</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .auth-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
      overflow: hidden;
    }
    .auth-header {
      background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .auth-header h1 { font-size: 20px; margin-bottom: 8px; }
    .auth-header p { opacity: 0.9; font-size: 14px; }
    .tabs {
      display: flex;
      border-bottom: 1px solid #eee;
    }
    .tab {
      flex: 1;
      padding: 14px;
      border: none;
      background: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      color: #666;
      transition: all 0.2s;
    }
    .tab.active {
      color: #0066cc;
      border-bottom: 2px solid #0066cc;
    }
    .auth-body { padding: 24px; }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #333;
    }
    .form-group input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #0066cc;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #0066cc;
      color: white;
    }
    .btn-primary:hover { background: #0052a3; }
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error-message {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .error-message.show { display: block; }
    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .success-message.show { display: block; }
    .loading { display: none; text-align: center; padding: 20px; }
    .loading.show { display: block; }
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #0066cc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    #signup-form { display: none; }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="auth-header">
      <h1>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Ativar Integração Asaas
      </h1>
      <p>Faça login ou crie uma conta para processar pagamentos</p>
    </div>
    
    <div class="tabs">
      <button class="tab active" id="loginTab" onclick="showTab('login')">Entrar</button>
      <button class="tab" id="signupTab" onclick="showTab('signup')">Criar Conta</button>
    </div>
    
    <div class="auth-body">
      <div class="error-message" id="errorMessage"></div>
      <div class="success-message" id="successMessage"></div>
      
      <div id="login-form">
        <div class="form-group">
          <label for="loginEmail">Email</label>
          <input type="email" id="loginEmail" placeholder="seu@email.com">
        </div>
        <div class="form-group">
          <label for="loginPassword">Senha</label>
          <input type="password" id="loginPassword" placeholder="••••••••">
        </div>
        <button class="btn btn-primary" id="loginBtn" onclick="doLogin()">Entrar</button>
      </div>
      
      <div id="signup-form">
        <div class="form-group">
          <label for="companyName">Nome da Empresa</label>
          <input type="text" id="companyName" placeholder="Minha Empresa LTDA">
        </div>
        <div class="form-group">
          <label for="signupEmail">Email</label>
          <input type="email" id="signupEmail" placeholder="seu@email.com">
        </div>
        <div class="form-group">
          <label for="signupPassword">Senha</label>
          <input type="password" id="signupPassword" placeholder="Mínimo 6 caracteres">
        </div>
        <button class="btn btn-primary" id="signupBtn" onclick="doSignup()">Criar Conta</button>
      </div>
      
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Processando...</p>
      </div>
    </div>
  </div>
  
  <script>
    let memberId = '${data.memberId}';
    let domain = '${data.domain}';
    
    function showTab(tab) {
      document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
      document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
      document.getElementById('loginTab').classList.toggle('active', tab === 'login');
      document.getElementById('signupTab').classList.toggle('active', tab === 'signup');
      hideMessages();
    }
    
    function showLoading() {
      document.getElementById('loading').classList.add('show');
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('signup-form').style.display = 'none';
    }
    
    function hideLoading(tab) {
      document.getElementById('loading').classList.remove('show');
      showTab(tab);
    }
    
    function showError(msg) {
      document.getElementById('errorMessage').textContent = msg;
      document.getElementById('errorMessage').classList.add('show');
    }
    
    function showSuccess(msg) {
      document.getElementById('successMessage').textContent = msg;
      document.getElementById('successMessage').classList.add('show');
    }
    
    function hideMessages() {
      document.getElementById('errorMessage').classList.remove('show');
      document.getElementById('successMessage').classList.remove('show');
    }
    
    async function doLogin() {
      hideMessages();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      
      if (!email || !password) {
        showError('Preencha email e senha');
        return;
      }
      
      showLoading();
      
      try {
        const response = await fetch('${SUPABASE_URL}/functions/v1/bitrix-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, memberId, domain, action: 'login' }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          hideLoading('login');
          showError(result.error || 'Erro ao fazer login');
          return;
        }
        
        showSuccess(result.message);
        
        // Reload to show next step (config or payment)
        setTimeout(() => window.location.reload(), 1500);
        
      } catch (err) {
        hideLoading('login');
        showError('Erro de conexão. Tente novamente.');
      }
    }
    
    async function doSignup() {
      hideMessages();
      const companyName = document.getElementById('companyName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      
      if (!companyName || !email || !password) {
        showError('Preencha todos os campos');
        return;
      }
      
      if (password.length < 6) {
        showError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      
      showLoading();
      
      try {
        const response = await fetch('${SUPABASE_URL}/functions/v1/bitrix-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, companyName, memberId, domain, action: 'signup' }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          hideLoading('signup');
          showError(result.error || 'Erro ao criar conta');
          return;
        }
        
        showSuccess(result.message);
        
        // Reload to show next step (config)
        setTimeout(() => window.location.reload(), 1500);
        
      } catch (err) {
        hideLoading('signup');
        showError('Erro de conexão. Tente novamente.');
      }
    }
    
    // Initialize BX24 and get memberId/domain if not set
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() {
        BX24.fitWindow();
        
        // Try to get memberId and domain from BX24 SDK if not set
        if (!memberId || !domain) {
          try {
            const auth = BX24.getAuth();
            if (auth) {
              memberId = memberId || auth.member_id || '';
              domain = domain || auth.domain || '';
              console.log('Got from BX24.getAuth():', memberId, domain);
            }
          } catch (e) {
            console.log('BX24.getAuth() failed:', e);
          }
          
          // Also try app.info as fallback
          BX24.callMethod('app.info', {}, function(result) {
            if (result.data()) {
              const info = result.data();
              memberId = memberId || info.member_id || '';
              domain = domain || info.DOMAIN || '';
              console.log('Got from app.info:', memberId, domain);
            }
          });
        }
      });
    }
  </script>
</body>
</html>`;
}

// Generate config page when installation is linked but no Asaas key
function generateConfigPage(data: PaymentData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configurar Asaas</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .config-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
      overflow: hidden;
    }
    .config-header {
      background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .config-header h1 { font-size: 20px; margin-bottom: 8px; }
    .config-header p { opacity: 0.9; font-size: 14px; }
    .config-body { padding: 24px; }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #333;
    }
    .form-group input, .form-group select {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    .form-group input:focus, .form-group select:focus {
      outline: none;
      border-color: #28a745;
    }
    .form-group small {
      display: block;
      margin-top: 6px;
      color: #666;
      font-size: 12px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-success {
      background: #28a745;
      color: white;
    }
    .btn-success:hover { background: #1e7e34; }
    .btn-success:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error-message {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .error-message.show { display: block; }
    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .success-message.show { display: block; }
    .loading { display: none; text-align: center; padding: 20px; }
    .loading.show { display: block; }
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #28a745;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .help-link {
      text-align: center;
      margin-top: 16px;
    }
    .help-link a {
      color: #0066cc;
      text-decoration: none;
      font-size: 14px;
    }
    .help-link a:hover { text-decoration: underline; }
    #config-form { display: block; }
  </style>
</head>
<body>
  <div class="config-card">
    <div class="config-header">
      <h1>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Configurar Asaas
      </h1>
      <p>Insira sua chave API para processar pagamentos</p>
    </div>
    
    <div class="config-body">
      <div class="error-message" id="errorMessage"></div>
      <div class="success-message" id="successMessage"></div>
      
      <div id="config-form">
        <div class="form-group">
          <label for="environment">Ambiente</label>
          <select id="environment">
            <option value="sandbox">Sandbox (Testes)</option>
            <option value="production">Produção</option>
          </select>
          <small>Use Sandbox para testes e Produção para cobranças reais</small>
        </div>
        <div class="form-group">
          <label for="apiKey">Chave API do Asaas</label>
          <input type="password" id="apiKey" placeholder="$aact_xxxxxxxxxxxxxxxx...">
          <small>Encontre em: Asaas → Configurações → Integrações → API</small>
        </div>
        <button class="btn btn-success" onclick="saveConfig()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Ativar Pagamentos
        </button>
        
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;">
          <button class="btn" onclick="repairWebhook()" id="repairBtn" style="background: #f59e0b; color: white; font-size: 14px; padding: 10px 16px; display:inline-flex; align-items:center; gap:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Reparar Webhook
          </button>
          <p style="font-size: 11px; color: #888; margin-top: 6px;">
            Use se os status de pagamento não estão atualizando automaticamente
          </p>
        </div>
      </div>
      
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p id="loadingText">Validando configuração...</p>
      </div>
      
      <div class="help-link">
        <a href="https://www.asaas.com/conta/criar" target="_blank">Não tem conta Asaas? Crie gratuitamente →</a>
      </div>
    </div>
  </div>
  
  <script>
    let memberId = '${data.memberId}';
    let domain = '${data.domain}';
    
    function showLoading() {
      document.getElementById('loading').classList.add('show');
      document.getElementById('config-form').style.display = 'none';
    }
    
    function hideLoading() {
      document.getElementById('loading').classList.remove('show');
      document.getElementById('config-form').style.display = 'block';
    }
    
    function showError(msg) {
      document.getElementById('errorMessage').textContent = msg;
      document.getElementById('errorMessage').classList.add('show');
      document.getElementById('successMessage').classList.remove('show');
    }
    
    function showSuccess(msg) {
      document.getElementById('successMessage').textContent = msg;
      document.getElementById('successMessage').classList.add('show');
      document.getElementById('errorMessage').classList.remove('show');
    }
    
    async function saveConfig() {
      const apiKey = document.getElementById('apiKey').value.trim();
      const environment = document.getElementById('environment').value;
      
      if (!apiKey) {
        showError('Insira a chave API do Asaas');
        return;
      }
      
      if (!memberId) {
        showError('Identificação da instalação não encontrada. Recarregue a página.');
        return;
      }
      
      showLoading();
      
      try {
        const response = await fetch('${SUPABASE_URL}/functions/v1/bitrix-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, environment, memberId, domain }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          hideLoading();
          showError(result.error || 'Erro ao salvar configuração');
          return;
        }
        
        hideLoading();
        showSuccess(result.message);
        
        // Reload to show payment form
        setTimeout(() => window.location.reload(), 1500);
        
      } catch (err) {
        hideLoading();
        showError('Erro de conexão. Tente novamente.');
      }
    }
    
    async function repairWebhook() {
      if (!memberId) {
        showError('Identificação da instalação não encontrada. Recarregue a página.');
        return;
      }
      
      document.getElementById('loadingText').textContent = 'Reparando webhook...';
      showLoading();
      
      try {
        const response = await fetch('${SUPABASE_URL}/functions/v1/bitrix-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, domain, action: 'repair_webhook' }),
        });
        
        const result = await response.json();
        
        hideLoading();
        document.getElementById('loadingText').textContent = 'Validando configuração...';
        
        if (!response.ok) {
          showError(result.error || 'Erro ao reparar webhook');
          return;
        }
        
        showSuccess(result.message);
      } catch (err) {
        hideLoading();
        document.getElementById('loadingText').textContent = 'Validando configuração...';
        showError('Erro de conexão. Tente novamente.');
      }
    }
    
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() {
        BX24.fitWindow();
        
        // Try to get memberId and domain from BX24 SDK if not set
        if (!memberId || !domain) {
          try {
            const auth = BX24.getAuth();
            if (auth) {
              memberId = memberId || auth.member_id || '';
              domain = domain || auth.domain || '';
              console.log('Got from BX24.getAuth():', memberId, domain);
            }
          } catch (e) {
            console.log('BX24.getAuth() failed:', e);
          }
          
          // Also try app.info as fallback
          BX24.callMethod('app.info', {}, function(result) {
            if (result.data()) {
              const info = result.data();
              memberId = memberId || info.member_id || '';
              domain = domain || info.DOMAIN || '';
              console.log('Got from app.info:', memberId, domain);
            }
          });
        }
      });
    }
  </script>
</body>
</html>`;
}

// ============= ACTION HANDLERS FOR DASHBOARD TABS =============

async function handleDashboardAction(body: any, supabase: any): Promise<Response> {
  const { action, memberId, filters, data, splitId, invoiceId, subscriptionId } = body;
  
  // Find installation by memberId to get tenant_id
  const { data: inst } = await supabase
    .from('bitrix_installations')
    .select('id, tenant_id, domain, access_token')
    .eq('member_id', memberId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!inst?.tenant_id) {
    return new Response(JSON.stringify({ error: 'Installation not found or not linked' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const tenantId = inst.tenant_id;
  
  switch (action) {
    case 'get_transactions': {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.method && filters.method !== 'all') {
        query = query.eq('payment_method', filters.method);
      }
      if (filters?.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`);
      }
      
      const { data: transactions, error } = await query;
      if (error) return jsonError(error.message);
      return jsonSuccess({ transactions: transactions || [] });
    }
    
    case 'get_subscriptions': {
      let query = supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      const { data: subscriptions, error } = await query;
      if (error) return jsonError(error.message);
      return jsonSuccess({ subscriptions: subscriptions || [] });
    }
    
    case 'cancel_subscription': {
      if (!subscriptionId) return jsonError('subscriptionId required');
      
      // Get asaas config
      const { data: asaasConf } = await supabase
        .from('asaas_configurations')
        .select('api_key, environment')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();
      
      if (!asaasConf?.api_key) return jsonError('Asaas not configured');
      
      // Get subscription asaas_id
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('asaas_id')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (!sub?.asaas_id) return jsonError('Subscription not found');
      
      const baseUrl = asaasConf.environment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';
      
      const resp = await fetch(`${baseUrl}/subscriptions/${sub.asaas_id}`, {
        method: 'DELETE',
        headers: { 'access_token': asaasConf.api_key },
      });
      
      if (resp.ok) {
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', subscriptionId);
        return jsonSuccess({ message: 'Assinatura cancelada' });
      } else {
        const err = await resp.json();
        return jsonError(err.errors?.[0]?.description || 'Erro ao cancelar');
      }
    }
    
    case 'get_splits': {
      const { data: splits, error } = await supabase
        .from('split_configurations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) return jsonError(error.message);
      return jsonSuccess({ splits: splits || [] });
    }
    
    case 'create_split': {
      if (!data?.name || !data?.wallet_id || !data?.split_value) {
        return jsonError('name, wallet_id and split_value are required');
      }
      
      const { data: newSplit, error } = await supabase
        .from('split_configurations')
        .insert({
          tenant_id: tenantId,
          name: data.name,
          wallet_id: data.wallet_id,
          wallet_name: data.wallet_name || null,
          split_type: data.split_type || 'percentage',
          split_value: data.split_value,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) return jsonError(error.message);
      return jsonSuccess({ split: newSplit, message: 'Split criado' });
    }
    
    case 'delete_split': {
      if (!splitId) return jsonError('splitId required');
      
      const { error } = await supabase
        .from('split_configurations')
        .delete()
        .eq('id', splitId)
        .eq('tenant_id', tenantId);
      
      if (error) return jsonError(error.message);
      return jsonSuccess({ message: 'Split removido' });
    }
    
    case 'toggle_split': {
      if (!splitId) return jsonError('splitId required');
      
      const { data: current } = await supabase
        .from('split_configurations')
        .select('is_active')
        .eq('id', splitId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (!current) return jsonError('Split not found');
      
      const { error } = await supabase
        .from('split_configurations')
        .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
        .eq('id', splitId)
        .eq('tenant_id', tenantId);
      
      if (error) return jsonError(error.message);
      return jsonSuccess({ message: current.is_active ? 'Split desativado' : 'Split ativado' });
    }
    
    case 'get_invoices': {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) return jsonError(error.message);
      return jsonSuccess({ invoices: invoices || [] });
    }
    
    case 'create_invoice': {
      if (!data?.service_description || !data?.value) {
        return jsonError('service_description and value are required');
      }
      
      // Call asaas-invoice-process
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-invoice-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          action: 'create',
          tenant_id: tenantId,
          service_description: data.service_description,
          value: data.value,
          observations: data.observations || '',
        }),
      });
      
      const result = await resp.json();
      if (!resp.ok) return jsonError(result.error || 'Erro ao criar nota fiscal');
      return jsonSuccess({ message: 'Nota fiscal criada', ...result });
    }
    
    case 'authorize_invoice': {
      if (!invoiceId) return jsonError('invoiceId required');
      
      // Get asaas_invoice_id
      const { data: inv } = await supabase
        .from('invoices')
        .select('asaas_invoice_id')
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (!inv?.asaas_invoice_id) return jsonError('Invoice not found');
      
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-invoice-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          action: 'authorize',
          tenant_id: tenantId,
          invoice_id: inv.asaas_invoice_id,
        }),
      });
      
      const result = await resp.json();
      if (!resp.ok) return jsonError(result.error || 'Erro ao autorizar');
      return jsonSuccess({ message: 'Nota fiscal autorizada', ...result });
    }
    
    case 'cancel_invoice': {
      if (!invoiceId) return jsonError('invoiceId required');
      
      const { data: inv } = await supabase
        .from('invoices')
        .select('asaas_invoice_id')
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (!inv?.asaas_invoice_id) return jsonError('Invoice not found');
      
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-invoice-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          action: 'cancel',
          tenant_id: tenantId,
          invoice_id: inv.asaas_invoice_id,
        }),
      });
      
      const result = await resp.json();
      if (!resp.ok) return jsonError(result.error || 'Erro ao cancelar');
      return jsonSuccess({ message: 'Nota fiscal cancelada', ...result });
    }
    
    case 'get_integrations_status': {
      const { data: asaasConf } = await supabase
        .from('asaas_configurations')
        .select('environment, is_active, webhook_configured')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();
      
      return jsonSuccess({
        bitrix: { connected: true, domain: inst.domain },
        asaas: {
          connected: !!asaasConf,
          environment: asaasConf?.environment || null,
          webhook_configured: asaasConf?.webhook_configured || false,
        },
      });
    }
    
    case 'save_config': {
      if (!data) return jsonError('data required');
      
      // Delegate to bitrix-config
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/bitrix-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: data.apiKey,
          environment: data.environment,
          memberId,
          domain: inst.domain,
          action: data.action || 'save',
        }),
      });
      
      const result = await resp.json();
      if (!resp.ok) return jsonError(result.error || 'Erro ao salvar');
      return jsonSuccess({
        message: result.message || 'Configuração salva',
        webhookConfigured: result.webhookConfigured,
        webhookUrl: result.webhookUrl,
        webhookSecret: result.webhookSecret,
        webhookEvents: result.webhookEvents,
        webhookError: result.webhookError,
      });
    }
    
    case 'repair_webhook': {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/bitrix-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, domain: inst.domain, action: 'repair_webhook' }),
      });
      
      const result = await resp.json();
      if (!resp.ok) return jsonError(result.error || 'Erro ao reparar');
      return jsonSuccess({
        message: result.message || 'Webhook reparado',
        webhookConfigured: result.webhookConfigured,
        webhookUrl: result.webhookUrl,
        webhookSecret: result.webhookSecret,
        webhookEvents: result.webhookEvents,
        webhookError: result.webhookError,
      });
    }
    
    case 'repair_integration': {
      // Reset all lazy-registration flags so next iframe load re-registers everything:
      // pay systems, robots, placements, badges, and Deal UF_CRM_ASAAS_* fields.
      const { error: updErr } = await supabase
        .from('bitrix_installations')
        .update({
          pay_systems_registered: false,
          robots_registered: false,
          placements_registered: false,
          badges_registered: false,
          deal_fields_registered: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inst.id);
      
      if (updErr) return jsonError(updErr.message);
      
      return jsonSuccess({
        message: 'Integração marcada para reparo. Abra o app no Bitrix24 para concluir a recriação automática de robôs, campos personalizados e meios de pagamento.',
      });
    }
    
    case 'crm_tab_load': return await handleCrmTabLoad(body, supabase, inst);
    case 'crm_tab_create': return await handleCrmTabCreate(body, supabase, inst);
    case 'crm_tab_cancel_charge': return await handleCrmTabCancelCharge(body, supabase, inst);
    case 'crm_tab_cancel_subscription': return await handleCrmTabCancelSub(body, supabase, inst);
    

    
    
    
    case 'get_config': {
      const { data: asaasConf } = await supabase
        .from('asaas_configurations')
        .select('environment, is_active, webhook_configured, webhook_secret, api_key')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle();
      
      const { data: fiscalConf } = await supabase
        .from('fiscal_configurations')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, email, phone, bitrix_domain')
        .eq('id', tenantId)
        .maybeSingle();
      
      const webhookUrl = `${SUPABASE_URL}/functions/v1/asaas-webhook`;
      const webhookEvents = [
        'PAYMENT_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED',
        'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED',
        'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_DELETED',
        'INVOICE_AUTHORIZED', 'INVOICE_ERROR', 'INVOICE_CANCELED',
      ];
      
      return jsonSuccess({
        profile: profile || null,
        asaas: asaasConf ? {
          environment: asaasConf.environment,
          webhook_configured: asaasConf.webhook_configured,
          webhook_secret: asaasConf.webhook_secret,
          has_api_key: !!asaasConf.api_key,
          api_key_masked: asaasConf.api_key ? asaasConf.api_key.substring(0, 10) + '...' : null,
        } : null,
        webhook: {
          url: webhookUrl,
          events: webhookEvents,
          configured: !!asaasConf?.webhook_configured,
          secret: asaasConf?.webhook_secret || null,
        },
        fiscal: fiscalConf,
      });
    }
    
    case 'save_profile': {
      if (!data) return jsonError('data required');
      const company_name = (data.company_name || '').toString().trim();
      const email = (data.email || '').toString().trim();
      const phone = (data.phone || '').toString().trim();
      
      if (!company_name) return jsonError('Nome da empresa é obrigatório');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('E-mail válido é obrigatório');
      
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          company_name,
          email,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
      
      if (upErr) return jsonError('Erro ao salvar empresa: ' + upErr.message);
      
      return jsonSuccess({ message: 'Dados da empresa atualizados' });
    }
    
    case 'search_municipal_services': {
      const query = (data?.query || '').toString().trim();
      if (query.length < 3) return jsonSuccess({ services: [] });
      
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-invoice-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          action: 'list_municipal_services',
          tenantId,
          description: query,
        }),
      });
      
      const result = await resp.json();
      if (!resp.ok) return jsonError(result.error || 'Erro ao buscar serviços');
      
      const list = (result.data || result || []).map((s: any) => ({
        id: s.id,
        code: s.code || s.serviceCode,
        description: s.description,
      }));
      return jsonSuccess({ services: list });
    }
    
    case 'save_fiscal_config': {
      if (!data) return jsonError('data required');
      
      const { data: existing } = await supabase
        .from('fiscal_configurations')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      const fiscalData = {
        tenant_id: tenantId,
        municipal_service_id: data.municipal_service_id || null,
        municipal_service_code: data.municipal_service_code || null,
        municipal_service_name: data.municipal_service_name || null,
        default_iss: data.default_iss || 0,
        observations_template: data.observations_template || null,
        auto_emit_on_payment: data.auto_emit_on_payment || false,
        updated_at: new Date().toISOString(),
      };
      
      if (existing) {
        await supabase.from('fiscal_configurations').update(fiscalData).eq('id', existing.id);
      } else {
        await supabase.from('fiscal_configurations').insert(fiscalData);
      }
      
      return jsonSuccess({ message: 'Configuração fiscal salva' });
    }
    
    case 'test_charge': {
      const billing_type = (data?.billing_type || 'PIX').toString();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-test-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ tenant_id: tenantId, billing_type }),
      });
      const result = await resp.json();
      return new Response(JSON.stringify(result), {
        status: resp.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'save_webhook_secret': {
      const secret = (data?.secret || '').toString().trim();
      if (!secret) return jsonError('Token vazio');
      const { error } = await supabase
        .from('asaas_configurations')
        .update({ webhook_secret: secret, webhook_configured: true, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (error) return jsonError(`Erro ao salvar: ${error.message}`);
      return jsonSuccess({ message: 'Token do webhook salvo' });
    }
    
    
    default:
      return jsonError(`Unknown action: ${action}`);
  }
}

function jsonSuccess(data: any): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============= DASHBOARD PAGE WITH TABS =============

// Generate dashboard page for normal app context (not checkout)
async function generateDashboardPage(
  installation: { id: string; tenant_id: string; domain: string },
  asaasConfig: { apiKey: string; environment: string },
  supabase: any
): Promise<string> {
  // Fetch metrics for current month (overview tab - server-side rendered)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('tenant_id', installation.tenant_id)
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);
  
  const total = transactions?.length || 0;
  const totalAmount = transactions?.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0) || 0;
  const confirmed = transactions?.filter((t: any) => ['confirmed', 'received'].includes(t.status)).length || 0;
  const successRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const pending = transactions?.filter((t: any) => t.status === 'pending').length || 0;
  const recentTransactions = (transactions || []).slice(0, 5);
  
  const statusLabels: Record<string, string> = {
    pending: 'Pendente', confirmed: 'Confirmado', received: 'Recebido',
    overdue: 'Vencido', refunded: 'Reembolsado', cancelled: 'Cancelado',
  };
  const statusColors: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#10b981', received: '#10b981',
    overdue: '#ef4444', refunded: '#8b5cf6', cancelled: '#6b7280',
  };

  // Fetch member_id for client-side API calls
  const { data: instData } = await supabase
    .from('bitrix_installations')
    .select('member_id')
    .eq('id', installation.id)
    .single();
  
  const memberId = instData?.member_id || '';

  // Pre-build recent transactions HTML to avoid nested template literals
  let recentTransactionsHtml = '';
  if (recentTransactions.length > 0) {
    const rows = recentTransactions.map((t: any) => {
      const name = t.customer_name || 'N/A';
      const amount = (parseFloat(t.amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const method = t.payment_method === 'pix' ? 'PIX' : t.payment_method === 'boleto' ? 'Boleto' : 'Cartão';
      const color = statusColors[t.status] || '#6b7280';
      const label = statusLabels[t.status] || t.status;
      const date = new Date(t.created_at).toLocaleDateString('pt-BR');
      return `<tr><td>${name}</td><td>R$ ${amount}</td><td>${method}</td><td><span class="status-badge" style="background:${color}20;color:${color}">${label}</span></td><td>${date}</td></tr>`;
    }).join('');
    recentTransactionsHtml = `<table><thead><tr><th>Cliente</th><th>Valor</th><th>Método</th><th>Status</th><th>Data</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else {
    recentTransactionsHtml = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin-bottom:12px;opacity:0.5;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg><p>Nenhuma transação este mês</p></div>`;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Asaas</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      line-height: 1.5;
    }
    
    /* FLOATING DOCK NAV */
    .dock-wrapper {
      display: flex;
      justify-content: center;
      padding: 16px 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .dock-nav {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .dock-separator {
      width: 1.2px;
      height: 24px;
      background: #e5e7eb;
      margin: 0 4px;
    }
    .dock-tab {
      display: inline-flex;
      align-items: center;
      gap: 0;
      padding: 8px;
      border: none;
      background: none;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      white-space: nowrap;
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    .dock-tab:hover { color: #374151; background: #f3f4f6; }
    .dock-tab.active {
      color: #0066cc;
      background: #f3f4f6;
      gap: 8px;
      padding: 8px 16px;
    }
    .dock-tab svg { width: 20px; height: 20px; flex-shrink: 0; }
    .dock-label { 
      display: none;
      overflow: hidden;
      max-width: 0;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .dock-tab.active .dock-label { 
      display: inline; 
      max-width: 200px;
      opacity: 1;
    }
    @media (max-width: 768px) {
      .dock-nav { 
        overflow-x: auto; 
        scrollbar-width: none;
        max-width: 100%;
      }
      .dock-nav::-webkit-scrollbar { display: none; }
    }
    
    /* CONTENT */
    .content { padding: 24px; width: 100%; box-sizing: border-box; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    /* CARDS & METRICS */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .metric-card .value { font-size: 28px; font-weight: 700; color: #111827; display: block; }
    .metric-card .label { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .metric-card.highlight {
      background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
    }
    .metric-card.highlight .value,
    .metric-card.highlight .label { color: white; }
    
    /* CONNECTION STATUS */
    .connection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .connection-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .connection-icon {
      width: 40px; height: 40px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .connection-icon.bitrix { background: #f0f9ff; color: #0284c7; }
    .connection-icon.asaas { background: #f0fdf4; color: #16a34a; }
    .connection-status {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #16a34a;
    }
    .connection-status::before {
      content: ''; width: 8px; height: 8px; background: #16a34a; border-radius: 50%;
    }
    .env-badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 500; text-transform: uppercase;
    }
    .env-badge.sandbox { background: #fef3c7; color: #92400e; }
    .env-badge.production { background: #dcfce7; color: #166534; }
    
    /* TABLE */
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
      margin-bottom: 24px;
    }
    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .card-header h3 { font-size: 16px; font-weight: 600; }
    .card-body { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; padding: 10px 16px; background: #f9fafb;
      font-size: 12px; font-weight: 600; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.05em;
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 10px 16px; font-size: 14px;
      border-bottom: 1px solid #f3f4f6;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: #f9fafb; }
    .status-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 12px; font-weight: 500;
    }
    .empty-state {
      text-align: center; padding: 40px; color: #6b7280;
    }
    .empty-state svg { width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5; }
    
    /* FILTERS */
    .filters {
      display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
    }
    .filter-input {
      padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 14px; min-width: 180px;
    }
    .filter-input:focus { outline: none; border-color: #0066cc; }
    .filter-select {
      padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 14px; background: white; cursor: pointer;
    }
    
    /* BUTTONS */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;
    }
    .btn-primary { background: #0066cc; color: white; }
    .btn-primary:hover { background: #0052a3; }
    .btn-success { background: #10b981; color: white; }
    .btn-success:hover { background: #059669; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-warning { background: #f59e0b; color: white; }
    .btn-warning:hover { background: #d97706; }
    .btn-outline {
      background: white; border: 1px solid #d1d5db; color: #374151;
    }
    .btn-outline:hover { background: #f9fafb; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    /* FORM */
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block; font-size: 14px; font-weight: 500;
      margin-bottom: 6px; color: #333;
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 10px 14px; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: 14px;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      outline: none; border-color: #0066cc;
    }
    .form-group small { display: block; margin-top: 4px; color: #6b7280; font-size: 12px; }
    
    /* MODAL */
    .modal-overlay {
      display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 200;
      align-items: center; justify-content: center; padding: 20px;
    }
    .modal-overlay.show { display: flex; }
    .modal {
      background: white; border-radius: 16px; width: 100%; max-width: 500px;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .modal-header {
      padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
      display: flex; align-items: center; justify-content: space-between;
    }
    .modal-header h3 { font-size: 18px; font-weight: 600; }
    .modal-close {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: #f3f4f6; cursor: pointer; font-size: 18px;
      display: flex; align-items: center; justify-content: center;
    }
    .modal-body { padding: 24px; }
    .modal-footer {
      padding: 16px 24px; border-top: 1px solid #e5e7eb;
      display: flex; gap: 12px; justify-content: flex-end;
    }
    
    /* TOAST */
    .toast {
      position: fixed; bottom: 20px; right: 20px; z-index: 300;
      padding: 12px 20px; border-radius: 8px; color: white;
      font-size: 14px; font-weight: 500; transform: translateY(100px);
      opacity: 0; transition: all 0.3s;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { background: #10b981; }
    .toast.error { background: #ef4444; }
    
    /* LOADING */
    .loading-overlay {
      display: flex; align-items: center; justify-content: center;
      padding: 40px; color: #6b7280;
    }
    .spinner-sm {
      width: 20px; height: 20px; border: 2px solid #e5e7eb;
      border-top-color: #0066cc; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    /* SECTION TITLE */
    .section-title {
      font-size: 14px; font-weight: 600; color: #374151;
      margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* TOGGLE */
    .toggle {
      position: relative; width: 44px; height: 24px; border-radius: 12px;
      background: #d1d5db; cursor: pointer; border: none; transition: 0.2s;
    }
    .toggle.on { background: #10b981; }
    .toggle::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 20px; height: 20px; border-radius: 50%; background: white;
      transition: 0.2s;
    }
    .toggle.on::after { left: 22px; }
  </style>
</head>
<body>
  <div class="dock-wrapper">
    <nav class="dock-nav">
      <button class="dock-tab active" onclick="switchTab('overview')" data-tab="overview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span class="dock-label">Visão Geral</span>
      </button>
      <button class="dock-tab" onclick="switchTab('transactions')" data-tab="transactions">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <span class="dock-label">Transações</span>
      </button>
      <button class="dock-tab" onclick="switchTab('subscriptions')" data-tab="subscriptions">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
        <span class="dock-label">Assinaturas</span>
      </button>
      <div class="dock-separator"></div>
      <button class="dock-tab" onclick="switchTab('invoices')" data-tab="invoices">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span class="dock-label">Notas Fiscais</span>
      </button>
      <div class="dock-separator"></div>
      <button class="dock-tab" onclick="switchTab('integrations')" data-tab="integrations">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span class="dock-label">Integrações</span>
      </button>
      <button class="dock-tab" onclick="switchTab('settings')" data-tab="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span class="dock-label">Configurações</span>
      </button>
    </nav>
  </div>
  
  <div class="content">
    <!-- OVERVIEW TAB -->
    <div id="tab-overview" class="tab-content active">
      <section class="connection-grid" style="margin-bottom:24px;">
        <div class="connection-card">
          <div class="connection-icon bitrix">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;">Bitrix24</div>
            <span class="connection-status">Conectado</span>
          </div>
        </div>
        <div class="connection-card">
          <div class="connection-icon asaas">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;">Asaas</div>
            <span class="connection-status">
              Ativo
              <span class="env-badge ${asaasConfig.environment}" style="margin-left:6px;">${asaasConfig.environment === 'production' ? 'Produção' : 'Sandbox'}</span>
            </span>
          </div>
        </div>
      </section>
      
      <h2 class="section-title">Métricas do Mês</h2>
      <div class="metrics-grid">
        <div class="metric-card highlight">
          <span class="value">${total}</span>
          <span class="label">Transações</span>
        </div>
        <div class="metric-card">
          <span class="value">R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <span class="label">Valor Total</span>
        </div>
        <div class="metric-card">
          <span class="value">${successRate}%</span>
          <span class="label">Taxa de Sucesso</span>
        </div>
        <div class="metric-card">
          <span class="value">${pending}</span>
          <span class="label">Pendentes</span>
        </div>
      </div>
      
      <h2 class="section-title">Últimas Transações</h2>
      <div class="card">
        <div class="card-body">
          ${recentTransactionsHtml}
        </div>
      </div>
    </div>
    
    <!-- TRANSACTIONS TAB -->
    <div id="tab-transactions" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h3>Transações</h3>
          <div class="filters">
            <input type="text" class="filter-input" id="txn-search" placeholder="Buscar cliente..." oninput="loadTransactions()">
            <select class="filter-select" id="txn-status" onchange="loadTransactions()">
              <option value="all">Todos status</option>
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmado</option>
              <option value="received">Recebido</option>
              <option value="overdue">Vencido</option>
              <option value="refunded">Reembolsado</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <select class="filter-select" id="txn-method" onchange="loadTransactions()">
              <option value="all">Todos métodos</option>
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="credit_card">Cartão</option>
            </select>
          </div>
        </div>
        <div class="card-body" id="txn-table">
          <div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>
        </div>
      </div>
    </div>
    
    <!-- SUBSCRIPTIONS TAB -->
    <div id="tab-subscriptions" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h3>Assinaturas</h3>
          <div class="filters">
            <select class="filter-select" id="sub-status" onchange="loadSubscriptions()">
              <option value="all">Todos status</option>
              <option value="active">Ativa</option>
              <option value="canceled">Cancelada</option>
              <option value="expired">Expirada</option>
            </select>
          </div>
        </div>
        <div class="card-body" id="sub-table">
          <div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>
        </div>
      </div>
    </div>
    
    
    <!-- INVOICES TAB -->
    <div id="tab-invoices" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h3>Notas Fiscais</h3>
          <button class="btn btn-primary" onclick="openModal('invoice-modal')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Nota Fiscal
          </button>
        </div>
        <div class="card-body" id="invoice-table">
          <div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>
        </div>
      </div>
    </div>
    
    <!-- INTEGRATIONS TAB -->
    <div id="tab-integrations" class="tab-content">
      <div id="integrations-content">
        <div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>
      </div>
    </div>
    
    <!-- SETTINGS TAB -->
    <div id="tab-settings" class="tab-content">
      <div id="settings-content">
        <div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>
      </div>
      <div class="card" style="margin-top:24px;">
        <div class="card-header">
          <h3>Split de Pagamento</h3>
          <button class="btn btn-primary" onclick="openModal('split-modal')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Split
          </button>
        </div>
        <div class="card-body" id="split-table">
          <div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- SPLIT MODAL -->
  <div class="modal-overlay" id="split-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>Novo Split de Pagamento</h3>
        <button class="modal-close" onclick="closeModal('split-modal')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="split-name" placeholder="Ex: Comissão Parceiro">
        </div>
        <div class="form-group">
          <label>Wallet ID</label>
          <input type="text" id="split-wallet" placeholder="ID da carteira Asaas">
        </div>
        <div class="form-group">
          <label>Nome da Wallet (opcional)</label>
          <input type="text" id="split-wallet-name" placeholder="Nome para identificação">
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="split-type">
            <option value="percentage">Porcentagem</option>
            <option value="fixed">Valor Fixo</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor</label>
          <input type="number" id="split-value" step="0.01" placeholder="0.00">
          <small>Porcentagem (0-100) ou valor fixo em R$</small>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('split-modal')">Cancelar</button>
        <button class="btn btn-primary" onclick="createSplit()">Criar Split</button>
      </div>
    </div>
  </div>
  
  <!-- INVOICE MODAL -->
  <div class="modal-overlay" id="invoice-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>Nova Nota Fiscal</h3>
        <button class="modal-close" onclick="closeModal('invoice-modal')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Valor (R$)</label>
          <input type="number" id="inv-value" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Descrição do Serviço</label>
          <textarea id="inv-description" rows="3" placeholder="Descreva o serviço prestado"></textarea>
        </div>
        <div class="form-group">
          <label>Observações (opcional)</label>
          <textarea id="inv-observations" rows="2" placeholder="Observações adicionais"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('invoice-modal')">Cancelar</button>
        <button class="btn btn-primary" onclick="createInvoice()">Emitir Nota</button>
      </div>
    </div>
  </div>
  
  <!-- TOAST -->
  <div class="toast" id="toast"></div>
  
  <script>
    const API_URL = '${SUPABASE_URL}/functions/v1/bitrix-payment-iframe';
    const MEMBER_ID = '${memberId}';
    
    const STATUS_LABELS = ${JSON.stringify(statusLabels)};
    const STATUS_COLORS = ${JSON.stringify(statusColors)};
    
    const CYCLE_LABELS = {
      WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal',
      BIMONTHLY: 'Bimestral', QUARTERLY: 'Trimestral',
      SEMIANNUALLY: 'Semestral', YEARLY: 'Anual'
    };
    const SUB_STATUS = {
      active: { label: 'Ativa', color: '#10b981' },
      canceled: { label: 'Cancelada', color: '#ef4444' },
      expired: { label: 'Expirada', color: '#6b7280' },
      pending: { label: 'Pendente', color: '#f59e0b' },
    };
    const INV_STATUS = {
      scheduled: { label: 'Agendada', color: '#f59e0b' },
      synchronized: { label: 'Sincronizada', color: '#3b82f6' },
      authorized: { label: 'Autorizada', color: '#10b981' },
      canceled: { label: 'Cancelada', color: '#6b7280' },
      error: { label: 'Erro', color: '#ef4444' },
    };
    
    // Tab loaded flags
    const tabLoaded = {};
    
    function switchTab(tab) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.dock-tab').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + tab).classList.add('active');
      document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
      
      // Load data on first visit
      if (!tabLoaded[tab]) {
        tabLoaded[tab] = true;
        switch(tab) {
          case 'transactions': loadTransactions(); break;
          case 'subscriptions': loadSubscriptions(); break;
          case 'invoices': loadInvoices(); break;
          case 'integrations': loadIntegrations(); break;
          case 'settings': loadSettings(); loadSplits(); break;
        }
      }
      
      if (typeof BX24 !== 'undefined') { try { BX24.fitWindow(); } catch(e){} }
    }
    
    async function apiCall(action, extra = {}) {
      try {
        const resp = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, memberId: MEMBER_ID, ...extra }),
        });
        const text = await resp.text();
        try { return JSON.parse(text); }
        catch(e) { return { success: false, error: 'Resposta inválida do servidor' }; }
      } catch(e) {
        return { success: false, error: 'Erro de conexão' };
      }
    }
    
    function showToast(msg, type = 'success') {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type + ' show';
      setTimeout(() => t.classList.remove('show'), 3000);
    }
    
    function openModal(id) { document.getElementById(id).classList.add('show'); }
    function closeModal(id) { document.getElementById(id).classList.remove('show'); }
    
    function formatCurrency(v) {
      return 'R$ ' + parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }
    function formatDate(d) {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('pt-BR');
    }
    function methodLabel(m) {
      return m === 'pix' ? 'PIX' : m === 'boleto' ? 'Boleto' : m === 'credit_card' ? 'Cartão' : m;
    }
    
    // ===== TRANSACTIONS =====
    async function loadTransactions() {
      const search = document.getElementById('txn-search')?.value || '';
      const status = document.getElementById('txn-status')?.value || 'all';
      const method = document.getElementById('txn-method')?.value || 'all';
      
      document.getElementById('txn-table').innerHTML = '<div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>';
      
      const result = await apiCall('get_transactions', { filters: { search, status, method } });
      const txns = result.transactions || [];
      
      if (txns.length === 0) {
        document.getElementById('txn-table').innerHTML = '<div class="empty-state"><p>Nenhuma transação encontrada</p></div>';
        return;
      }
      
      let html = '<table><thead><tr><th>Cliente</th><th>Valor</th><th>Método</th><th>Status</th><th>Vencimento</th><th>Data</th></tr></thead><tbody>';
      txns.forEach(t => {
        const sc = STATUS_COLORS[t.status] || '#6b7280';
        html += '<tr>';
        html += '<td>' + (t.customer_name || 'N/A') + '</td>';
        html += '<td>' + formatCurrency(t.amount) + '</td>';
        html += '<td>' + methodLabel(t.payment_method) + '</td>';
        html += '<td><span class="status-badge" style="background:' + sc + '20;color:' + sc + '">' + (STATUS_LABELS[t.status] || t.status) + '</span></td>';
        html += '<td>' + formatDate(t.due_date) + '</td>';
        html += '<td>' + formatDate(t.created_at) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById('txn-table').innerHTML = html;
    }
    
    // ===== SUBSCRIPTIONS =====
    async function loadSubscriptions() {
      const status = document.getElementById('sub-status')?.value || 'all';
      document.getElementById('sub-table').innerHTML = '<div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>';
      
      const result = await apiCall('get_subscriptions', { filters: { status } });
      const subs = result.subscriptions || [];
      
      if (subs.length === 0) {
        document.getElementById('sub-table').innerHTML = '<div class="empty-state"><p>Nenhuma assinatura encontrada</p></div>';
        return;
      }
      
      let html = '<table><thead><tr><th>Cliente</th><th>Valor</th><th>Ciclo</th><th>Próx. Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
      subs.forEach(s => {
        const st = SUB_STATUS[s.status] || { label: s.status, color: '#6b7280' };
        html += '<tr>';
        html += '<td>' + (s.customer_name || 'N/A') + '</td>';
        html += '<td>' + formatCurrency(s.value) + '</td>';
        html += '<td>' + (CYCLE_LABELS[s.cycle] || s.cycle) + '</td>';
        html += '<td>' + formatDate(s.next_due_date) + '</td>';
        html += '<td><span class="status-badge" style="background:' + st.color + '20;color:' + st.color + '">' + st.label + '</span></td>';
        html += '<td>';
        if (s.status === 'active') {
          html += '<button class="btn btn-danger btn-sm" onclick="cancelSubscription(\\'' + s.id + '\\')">Cancelar</button>';
        }
        html += '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById('sub-table').innerHTML = html;
    }
    
    async function cancelSubscription(id) {
      if (!confirm('Deseja realmente cancelar esta assinatura?')) return;
      const result = await apiCall('cancel_subscription', { subscriptionId: id });
      if (result.success) {
        showToast(result.message);
        tabLoaded['subscriptions'] = false;
        loadSubscriptions();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }
    
    // ===== SPLITS =====
    async function loadSplits() {
      document.getElementById('split-table').innerHTML = '<div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>';
      
      const result = await apiCall('get_splits');
      if (!result || !result.success) {
        document.getElementById('split-table').innerHTML = '<div class="empty-state"><p>' + (result?.error || 'Erro ao carregar splits') + '</p></div>';
        return;
      }
      const splits = result.splits || [];
      
      if (splits.length === 0) {
        document.getElementById('split-table').innerHTML = '<div class="empty-state"><p>Nenhuma regra de split configurada</p><p style="font-size:12px;margin-top:4px;">Clique em "Novo Split" para criar uma regra</p></div>';
        return;
      }
      
      let html = '<table><thead><tr><th>Nome</th><th>Wallet</th><th>Tipo</th><th>Valor</th><th>Ativo</th><th>Ações</th></tr></thead><tbody>';
      splits.forEach(s => {
        const val = s.split_type === 'percentage' ? s.split_value + '%' : formatCurrency(s.split_value);
        html += '<tr>';
        html += '<td>' + s.name + '</td>';
        html += '<td>' + (s.wallet_name || s.wallet_id) + '</td>';
        html += '<td>' + (s.split_type === 'percentage' ? 'Porcentagem' : 'Fixo') + '</td>';
        html += '<td>' + val + '</td>';
        html += '<td><button class="toggle ' + (s.is_active ? 'on' : '') + '" onclick="toggleSplit(\\'' + s.id + '\\')"></button></td>';
        html += '<td><button class="btn btn-danger btn-sm" onclick="deleteSplit(\\'' + s.id + '\\')">Excluir</button></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById('split-table').innerHTML = html;
    }
    
    async function createSplit() {
      const data = {
        name: document.getElementById('split-name').value,
        wallet_id: document.getElementById('split-wallet').value,
        wallet_name: document.getElementById('split-wallet-name').value,
        split_type: document.getElementById('split-type').value,
        split_value: parseFloat(document.getElementById('split-value').value),
      };
      
      if (!data.name || !data.wallet_id || !data.split_value) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
      }
      
      const result = await apiCall('create_split', { data });
      if (result.success) {
        showToast(result.message);
        closeModal('split-modal');
        document.getElementById('split-name').value = '';
        document.getElementById('split-wallet').value = '';
        document.getElementById('split-wallet-name').value = '';
        document.getElementById('split-value').value = '';
        loadSplits();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }
    
    async function toggleSplit(id) {
      const result = await apiCall('toggle_split', { splitId: id });
      if (result.success) { showToast(result.message); loadSplits(); }
      else { showToast(result.error || 'Erro', 'error'); }
    }
    
    async function deleteSplit(id) {
      if (!confirm('Excluir esta regra de split?')) return;
      const result = await apiCall('delete_split', { splitId: id });
      if (result.success) { showToast(result.message); loadSplits(); }
      else { showToast(result.error || 'Erro', 'error'); }
    }
    
    // ===== INVOICES =====
    async function loadInvoices() {
      document.getElementById('invoice-table').innerHTML = '<div class="loading-overlay"><div class="spinner-sm"></div> Carregando...</div>';
      
      const result = await apiCall('get_invoices');
      const invoices = result.invoices || [];
      
      if (invoices.length === 0) {
        document.getElementById('invoice-table').innerHTML = '<div class="empty-state"><p>Nenhuma nota fiscal encontrada</p></div>';
        return;
      }
      
      let html = '<table><thead><tr><th>Data</th><th>Nº</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
      invoices.forEach(inv => {
        const st = INV_STATUS[inv.status] || { label: inv.status, color: '#6b7280' };
        html += '<tr>';
        html += '<td>' + formatDate(inv.created_at) + '</td>';
        html += '<td>' + (inv.invoice_number || '-') + '</td>';
        html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + inv.service_description + '</td>';
        html += '<td>' + formatCurrency(inv.value) + '</td>';
        html += '<td><span class="status-badge" style="background:' + st.color + '20;color:' + st.color + '">' + st.label + '</span></td>';
        html += '<td style="display:flex;gap:4px;">';
        if (inv.invoice_url) {
          html += '<a href="' + inv.invoice_url + '" target="_blank" class="btn btn-outline btn-sm">Ver</a>';
        }
        if (inv.status === 'scheduled' && inv.asaas_invoice_id) {
          html += '<button class="btn btn-success btn-sm" onclick="authorizeInvoice(\\'' + inv.id + '\\')">Autorizar</button>';
        }
        if (['scheduled', 'synchronized'].includes(inv.status) && inv.asaas_invoice_id) {
          html += '<button class="btn btn-danger btn-sm" onclick="cancelInvoice(\\'' + inv.id + '\\')">Cancelar</button>';
        }
        html += '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById('invoice-table').innerHTML = html;
    }
    
    async function createInvoice() {
      const data = {
        value: parseFloat(document.getElementById('inv-value').value),
        service_description: document.getElementById('inv-description').value,
        observations: document.getElementById('inv-observations').value,
      };
      
      if (!data.value || !data.service_description) {
        showToast('Preencha valor e descrição', 'error');
        return;
      }
      
      const result = await apiCall('create_invoice', { data });
      if (result.success) {
        showToast(result.message);
        closeModal('invoice-modal');
        document.getElementById('inv-value').value = '';
        document.getElementById('inv-description').value = '';
        document.getElementById('inv-observations').value = '';
        loadInvoices();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }
    
    async function authorizeInvoice(id) {
      if (!confirm('Autorizar esta nota fiscal?')) return;
      const result = await apiCall('authorize_invoice', { invoiceId: id });
      if (result.success) { showToast(result.message); loadInvoices(); }
      else { showToast(result.error || 'Erro', 'error'); }
    }
    
    async function cancelInvoice(id) {
      if (!confirm('Cancelar esta nota fiscal?')) return;
      const result = await apiCall('cancel_invoice', { invoiceId: id });
      if (result.success) { showToast(result.message); loadInvoices(); }
      else { showToast(result.error || 'Erro', 'error'); }
    }
    
    // ===== INTEGRATIONS =====
    async function loadIntegrations() {
      const result = await apiCall('get_integrations_status');
      
      let html = '<h2 class="section-title">Status das Integrações</h2>';
      html += '<div class="connection-grid">';
      
      // Bitrix
      html += '<div class="card" style="padding:20px;">';
      html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
      html += '<div class="connection-icon bitrix"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>';
      html += '<div><div style="font-weight:600;">Bitrix24</div><span class="connection-status">Conectado</span></div>';
      html += '</div>';
      if (result.bitrix?.domain) {
        html += '<p style="font-size:13px;color:#6b7280;">Domínio: ' + result.bitrix.domain + '</p>';
      }
      html += '</div>';
      
      // Asaas
      html += '<div class="card" style="padding:20px;">';
      html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
      html += '<div class="connection-icon asaas"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>';
      html += '<div><div style="font-weight:600;">Asaas</div>';
      if (result.asaas?.connected) {
        html += '<span class="connection-status">Ativo <span class="env-badge ' + result.asaas.environment + '" style="margin-left:6px;">' + (result.asaas.environment === 'production' ? 'Produção' : 'Sandbox') + '</span></span>';
      } else {
        html += '<span style="font-size:12px;color:#ef4444;">Não configurado</span>';
      }
      html += '</div></div>';
      if (result.asaas?.webhook_configured) {
        html += '<p style="font-size:13px;color:#10b981;">✓ Webhook configurado</p>';
      } else if (result.asaas?.connected) {
        html += '<p style="font-size:13px;color:#f59e0b;">⚠ Webhook não configurado</p>';
        html += '<button class="btn btn-warning btn-sm" style="margin-top:8px;" onclick="repairWebhook()">Reparar Webhook</button>';
      }
      html += '<button class="btn btn-primary btn-sm" style="margin-top:8px;margin-left:8px;" onclick="repairIntegration()">Reparar Integração Bitrix</button>';
      html += '</div>';
      
      html += '</div>';
      document.getElementById('integrations-content').innerHTML = html;
    }
    
    async function repairWebhook() {
      showToast('Reparando webhook...');
      const result = await apiCall('repair_webhook');
      if (result.success) {
        showToast(result.message);
        tabLoaded['integrations'] = false;
        loadIntegrations();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }

    async function repairIntegration() {
      showToast('Marcando integração para reparo...');
      const result = await apiCall('repair_integration');
      if (result.success) {
        showToast(result.message || 'Integração marcada para reparo. Reabra o app no Bitrix24.');
        tabLoaded['integrations'] = false;
        loadIntegrations();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }
    
    // ===== SETTINGS =====
    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    
    function renderWebhookBlock(webhook, environment) {
      if (!webhook) return '';
      const configured = !!webhook.configured;
      const url = webhook.url || '';
      const secret = webhook.secret || '';
      const events = webhook.events || [];
      const envLabel = environment === 'production' ? 'Produção' : (environment === 'sandbox' ? 'Sandbox' : '—');
      let html = '<div class="card" style="margin-bottom:24px;">';
      html += '<div class="card-header"><h3>Webhook Asaas</h3></div>';
      html += '<div style="padding:20px;">';
      
      // Badges API version + ambiente
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">';
      html += '<span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">API Asaas v3</span>';
      html += '<span style="background:#e0f2fe;color:#075985;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">Ambiente: ' + envLabel + '</span>';
      html += '<span style="background:' + (configured ? '#dcfce7' : '#fef3c7') + ';color:' + (configured ? '#166534' : '#92400e') + ';padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">' + (configured ? '✓ Registrado automaticamente' : '⚠ Registrar manualmente') + '</span>';
      html += '</div>';
      
      html += '<div class="form-group"><label>URL do Webhook</label>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<input type="text" id="wh-url" readonly value="' + escapeHtml(url) + '" style="flex:1;font-family:monospace;font-size:12px;">';
      html += '<button class="btn btn-secondary btn-sm" onclick="copyToClipboard(\\'wh-url\\', this)">Copiar</button>';
      html += '</div></div>';
      
      html += '<div class="form-group"><label>Token salvo (header <code>asaas-access-token</code>)</label>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<input type="text" id="wh-secret" readonly value="' + escapeHtml(secret || '— não configurado —') + '" style="flex:1;font-family:monospace;font-size:12px;">';
      if (secret) html += '<button class="btn btn-secondary btn-sm" onclick="copyToClipboard(\\'wh-secret\\', this)">Copiar</button>';
      html += '</div></div>';

      // Manual override — caso o usuário tenha cadastrado o webhook no Asaas e queira usar o token gerado lá
      html += '<div class="form-group" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">';
      html += '<label style="font-weight:600;">Colar token gerado pelo Asaas</label>';
      html += '<p style="margin:4px 0 8px;font-size:12px;color:#64748b;">Se você cadastrou o webhook manualmente no painel do Asaas e definiu um token próprio, cole-o aqui para que possamos validar as chamadas.</p>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<input type="text" id="wh-manual-secret" placeholder="Cole o token do Asaas aqui" style="flex:1;font-family:monospace;font-size:12px;">';
      html += '<button class="btn btn-primary btn-sm" onclick="saveManualWebhookSecret()">Salvar token</button>';
      html += '</div></div>';
      
      html += '<div class="form-group"><label>Eventos a habilitar</label>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      events.forEach((ev) => {
        html += '<span style="background:#f3f4f6;padding:4px 8px;border-radius:6px;font-size:11px;font-family:monospace;">' + escapeHtml(ev) + '</span>';
      });
      html += '</div></div>';
      
      // Passo a passo (visível)
      html += '<div style="margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">';
      html += '<h4 style="margin:0 0 12px;font-size:14px;color:#0f172a;">📘 Como configurar o webhook no painel Asaas (passo a passo)</h4>';
      html += '<ol style="font-size:13px;color:#334155;margin:0;padding-left:22px;line-height:1.7;">';
      html += '<li>Acesse <a href="https://www.asaas.com/login" target="_blank" rel="noopener" style="color:#0369a1;">https://www.asaas.com/login</a> e entre na sua conta.</li>';
      html += '<li>No menu lateral, vá em <strong>Integrações</strong> → aba <strong>Webhooks</strong> (em contas antigas: <em>Configurações → Notificações via Webhook</em>).</li>';
      html += '<li>Clique em <strong>+ Novo Webhook</strong>.</li>';
      html += '<li>Em <strong>Nome</strong>, digite algo como <em>"Bitrix24 Asaas Connector"</em>.</li>';
      html += '<li>No campo <strong>URL</strong>, cole a URL acima (botão Copiar).</li>';
      html += '<li>No campo <strong>Token de autenticação</strong> (header <code>asaas-access-token</code>), cole o Token acima (botão Copiar).</li>';
      html += '<li>Preencha as configurações obrigatórias:';
      html += '<ul style="margin:4px 0;padding-left:18px;">';
      html += '<li><strong>E-mail para notificação de falhas</strong>: o mesmo cadastrado em "Dados da Empresa" acima.</li>';
      html += '<li><strong>Versão da API</strong>: <strong>v3</strong> (obrigatório — o conector só envia compatível com v3).</li>';
      html += '<li><strong>Envio</strong>: <strong>Sequencial</strong> (recomendado).</li>';
      html += '<li><strong>Status</strong>: <strong>Ativo / Habilitado</strong>.</li>';
      html += '</ul></li>';
      html += '<li>Em <strong>Eventos</strong>, marque <strong>todos</strong> os eventos listados acima (pagamentos, assinaturas e notas fiscais).</li>';
      html += '<li>Clique em <strong>Salvar</strong>.</li>';
      html += '</ol>';
      html += '<p style="margin:12px 0 0;font-size:12px;color:#64748b;">📖 Documentação oficial: <a href="https://docs.asaas.com/docs/webhooks" target="_blank" rel="noopener" style="color:#0369a1;">docs.asaas.com/docs/webhooks</a></p>';
      html += '<p style="margin:6px 0 0;font-size:12px;color:#64748b;">💡 Após salvar, gere uma cobrança de teste para validar a entrega. O status aparece na aba <strong>Integrações</strong>.</p>';
      html += '</div>';
      
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">';
      html += '<button class="btn btn-warning" onclick="repairWebhookFromSettings()">Tentar registrar automaticamente novamente</button>';
      html += '<button class="btn btn-primary" onclick="repairIntegrationFromSettings()">Reparar Integração Bitrix (robôs + campos)</button>';
      html += '</div>';
      html += '</div></div>';
      return html;
    }
    
    function copyToClipboard(id, btn) {
      const el = document.getElementById(id);
      if (!el) return;
      el.select();
      try {
        navigator.clipboard.writeText(el.value);
      } catch (e) {
        document.execCommand('copy');
      }
      const orig = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
    
    async function loadSettings() {
      const result = await apiCall('get_config');
      
      if (!result || !result.success) {
        document.getElementById('settings-content').innerHTML = '<div class="empty-state"><p>' + (result?.error || 'Erro ao carregar configurações') + '</p></div>';
        return;
      }
      
      let html = '';
      
      // Empresa (usado para registro do webhook e cobranças)
      const p = result.profile || {};
      html += '<div class="card" style="margin-bottom:24px;">';
      html += '<div class="card-header"><h3>Dados da Empresa</h3></div>';
      html += '<div style="padding:20px;">';
      html += '<p style="margin:0 0 16px;color:#64748b;font-size:13px;">Esses dados são usados no registro do webhook no Asaas e nas notificações de cobrança. Um e-mail real é obrigatório.</p>';
      html += '<div class="form-group"><label>Nome da Empresa *</label><input type="text" id="cfg-company" value="' + (p.company_name || '').replace(/"/g, '&quot;') + '" placeholder="Minha Empresa LTDA"></div>';
      html += '<div class="form-group"><label>E-mail *</label><input type="email" id="cfg-email" value="' + (p.email || '').replace(/"/g, '&quot;') + '" placeholder="contato@minhaempresa.com"></div>';
      html += '<div class="form-group"><label>Telefone</label><input type="text" id="cfg-phone" value="' + (p.phone || '').replace(/"/g, '&quot;') + '" placeholder="(11) 99999-9999"></div>';
      html += '<button class="btn btn-primary" onclick="saveProfile()">Salvar Empresa</button>';
      html += '</div></div>';
      
      // Asaas Config
      html += '<div class="card" style="margin-bottom:24px;">';
      html += '<div class="card-header"><h3>Configuração Asaas</h3></div>';
      html += '<div style="padding:20px;">';
      
      html += '<div class="form-group">';
      html += '<label>Ambiente</label>';
      html += '<select class="filter-select" id="cfg-environment" style="width:100%;">';
      html += '<option value="sandbox"' + (result.asaas?.environment === 'sandbox' ? ' selected' : '') + '>Sandbox (Testes)</option>';
      html += '<option value="production"' + (result.asaas?.environment === 'production' ? ' selected' : '') + '>Produção</option>';
      html += '</select></div>';
      
      html += '<div class="form-group">';
      html += '<label>Chave API</label>';
      html += '<input type="password" id="cfg-apikey" placeholder="' + (result.asaas?.api_key_masked || 'Insira a chave API') + '">';
      html += '<small>Deixe em branco para manter a atual</small></div>';
      
      html += '<button class="btn btn-primary" onclick="saveAsaasConfig()">Salvar Configuração</button>';
      html += '</div></div>';
      
      // Webhook block (always rendered)
      html += renderWebhookBlock(result.webhook, result.asaas?.environment);
      
      // Teste de Integração Asaas
      html += '<div class="card" style="margin-bottom:24px;">';
      html += '<div class="card-header"><h3>⚡ Teste de Integração Asaas</h3></div>';
      html += '<div style="padding:20px;">';
      html += '<p style="margin:0 0 16px;color:#64748b;font-size:13px;">Valida sua API key e cria uma cobrança real de R$ 5,00 no Asaas. Use o ambiente Sandbox para testes.</p>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">';
      html += '<label style="margin:0;font-size:13px;color:#334155;">Tipo:</label>';
      html += '<select id="test-billing-type" class="filter-select" style="width:auto;"><option value="PIX">PIX</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option></select>';
      html += '<button class="btn btn-primary" id="test-charge-btn" onclick="runTestCharge()">Executar teste</button>';
      html += '</div>';
      html += '<div id="test-charge-result"></div>';
      html += '</div></div>';
      
      // Fiscal Config
      html += '<div class="card">';
      html += '<div class="card-header"><h3>Configuração Fiscal</h3></div>';
      html += '<div style="padding:20px;">';
      
      const fsid = (result.fiscal?.municipal_service_id || '').replace(/"/g, '&quot;');
      const fscode = (result.fiscal?.municipal_service_code || '').replace(/"/g, '&quot;');
      const fsname = (result.fiscal?.municipal_service_name || '').replace(/"/g, '&quot;');
      html += '<input type="hidden" id="cfg-service-id" value="' + fsid + '">';
      html += '<input type="hidden" id="cfg-service-code" value="' + fscode + '">';
      html += '<input type="hidden" id="cfg-service-name" value="' + fsname + '">';
      
      html += '<div class="form-group" style="position:relative;">';
      html += '<label>Serviço Municipal</label>';
      html += '<input type="text" id="cfg-service-search" placeholder="Buscar serviço (mín. 3 caracteres)" oninput="onServiceSearch()" autocomplete="off">';
      html += '<div id="cfg-service-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;max-height:240px;overflow-y:auto;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.08);margin-top:4px;"></div>';
      html += '<div id="cfg-service-selected" style="margin-top:8px;padding:10px;background:#f1f5f9;border-radius:6px;font-size:13px;' + (fscode ? '' : 'display:none;') + '"><strong>Selecionado:</strong> <span id="cfg-service-label">' + (fscode ? fscode + ' - ' + fsname : '') + '</span></div>';
      html += '</div>';
      
      html += '<div class="form-group">';
      html += '<label>ISS (%)</label>';
      html += '<input type="number" id="cfg-iss" step="0.01" value="' + (result.fiscal?.default_iss || 0) + '"></div>';
      
      html += '<div class="form-group">';
      html += '<label>Template de Observações</label>';
      html += '<textarea id="cfg-observations" rows="3" placeholder="Template para observações das notas">' + (result.fiscal?.observations_template || '') + '</textarea></div>';
      
      html += '<div class="form-group" style="display:flex;align-items:center;gap:12px;">';
      html += '<button class="toggle ' + (result.fiscal?.auto_emit_on_payment ? 'on' : '') + '" id="cfg-auto-emit" onclick="this.classList.toggle(\\'on\\')"></button>';
      html += '<label style="margin:0;">Emitir NF automaticamente ao receber pagamento</label></div>';
      
      html += '<button class="btn btn-primary" style="margin-top:16px;" onclick="saveFiscalConfig()">Salvar Config Fiscal</button>';
      
      html += '</div></div>';
      
      document.getElementById('settings-content').innerHTML = html;
    }
    
    async function saveProfile() {
      const company_name = document.getElementById('cfg-company').value.trim();
      const email = document.getElementById('cfg-email').value.trim();
      const phone = document.getElementById('cfg-phone').value.trim();
      
      if (!company_name) { showToast('Informe o nome da empresa', 'error'); return; }
      if (!email) { showToast('Informe um e-mail válido', 'error'); return; }
      
      const result = await apiCall('save_profile', { data: { company_name, email, phone } });
      if (result.success) {
        showToast(result.message);
        tabLoaded['settings'] = false;
        loadSettings();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }
    
    async function saveAsaasConfig() {
      const apiKey = document.getElementById('cfg-apikey').value;
      const environment = document.getElementById('cfg-environment').value;
      
      if (!apiKey) {
        showToast('Insira a chave API', 'error');
        return;
      }
      
      const result = await apiCall('save_config', { data: { apiKey, environment } });
      if (result.success) {
        showToast(result.message);
        tabLoaded['settings'] = false;
        loadSettings();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }
    
    async function repairWebhookFromSettings() {
      showToast('Reparando webhook...');
      const result = await apiCall('repair_webhook');
      if (result.success) {
        showToast(result.message);
        tabLoaded['settings'] = false;
        loadSettings();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }

    async function repairIntegrationFromSettings() {
      showToast('Marcando integração para reparo...');
      const result = await apiCall('repair_integration');
      if (result.success) {
        showToast(result.message || 'Integração marcada para reparo. Reabra o app no Bitrix24.');
        tabLoaded['settings'] = false;
        loadSettings();
      } else {
        showToast(result.error || 'Erro', 'error');
      }
    }

    async function saveManualWebhookSecret() {
      const el = document.getElementById('wh-manual-secret');
      const secret = (el && el.value || '').trim();
      if (!secret) { showToast('Cole o token primeiro', 'error'); return; }
      showToast('Salvando token...');
      const r = await apiCall('save_webhook_secret', { data: { secret } });
      if (r && r.success) {
        showToast('Token salvo!');
        tabLoaded['settings'] = false;
        loadSettings();
      } else {
        showToast((r && r.error) || 'Erro ao salvar', 'error');
      }
    }
    
    
    async function runTestCharge() {
      const billing_type = document.getElementById('test-billing-type').value;
      const btn = document.getElementById('test-charge-btn');
      const out = document.getElementById('test-charge-result');
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Testando...';
      out.innerHTML = '';
      try {
        const r = await apiCall('test_charge', { data: { billing_type } });
        if (r.success) {
          showToast('Cobrança de teste criada!');
          const p = r.payment || {};
          let html = '<div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:14px;margin-top:8px;">';
          html += '<div style="font-weight:600;color:#166534;margin-bottom:8px;">✓ Teste concluído com sucesso</div>';
          if (Array.isArray(r.log)) {
            html += '<pre style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-size:11px;white-space:pre-wrap;margin:0 0 10px;">' + escapeHtml(r.log.join('\\n')) + '</pre>';
          }
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;color:#334155;">';
          html += '<div><span style="color:#64748b;">Ambiente:</span> <code>' + escapeHtml(r.environment || '') + '</code></div>';
          html += '<div><span style="color:#64748b;">Conta:</span> ' + escapeHtml((r.account && (r.account.name || r.account.email)) || '') + '</div>';
          html += '<div><span style="color:#64748b;">Cobrança:</span> <code>' + escapeHtml(p.id || '') + '</code></div>';
          html += '<div><span style="color:#64748b;">Status:</span> ' + escapeHtml(p.status || '') + '</div>';
          html += '<div><span style="color:#64748b;">Valor:</span> R$ ' + Number(p.value || 0).toFixed(2) + '</div>';
          html += '<div><span style="color:#64748b;">Vencimento:</span> ' + escapeHtml(p.dueDate || '') + '</div>';
          if (p.invoiceUrl) {
            html += '<div style="grid-column:1/-1;"><a href="' + escapeHtml(p.invoiceUrl) + '" target="_blank" rel="noopener" style="color:#0369a1;">Abrir cobrança no Asaas ↗</a></div>';
          }
          html += '</div></div>';
          out.innerHTML = html;
        } else {
          showToast(r.error || 'Falha no teste', 'error');
          let html = '<div style="border:1px solid #fecaca;background:#fef2f2;border-radius:10px;padding:14px;margin-top:8px;">';
          html += '<div style="font-weight:600;color:#991b1b;margin-bottom:8px;">✗ Falha no teste</div>';
          html += '<div style="font-size:13px;color:#991b1b;">' + escapeHtml(r.error || 'Erro desconhecido') + '</div>';
          if (Array.isArray(r.log) && r.log.length) {
            html += '<pre style="background:#fff;border:1px solid #fecaca;border-radius:6px;padding:10px;font-size:11px;white-space:pre-wrap;margin:10px 0 0;">' + escapeHtml(r.log.join('\\n')) + '</pre>';
          }
          html += '</div>';
          out.innerHTML = html;
        }
      } catch (e) {
        showToast('Erro ao executar teste', 'error');
        out.innerHTML = '<div style="color:#991b1b;font-size:13px;margin-top:8px;">' + escapeHtml(String(e && e.message || e)) + '</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    }
    
    let serviceSearchTimer = null;
    async function onServiceSearch() {
      const q = document.getElementById('cfg-service-search').value.trim();
      const dd = document.getElementById('cfg-service-dropdown');
      if (q.length < 3) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
      clearTimeout(serviceSearchTimer);
      serviceSearchTimer = setTimeout(async () => {
        const r = await apiCall('search_municipal_services', { data: { query: q } });
        if (!r.success) { dd.style.display = 'none'; return; }
        const items = r.services || [];
        if (items.length === 0) {
          dd.innerHTML = '<div style="padding:10px;color:#64748b;font-size:13px;">Nenhum serviço encontrado</div>';
        } else {
          dd.innerHTML = items.map(s =>
            '<div style="padding:10px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;" onmouseover="this.style.background=\\'#f8fafc\\'" onmouseout="this.style.background=\\'\\'" onclick="selectService(\\'' + (s.id || '') + '\\',\\'' + (s.code || '').replace(/'/g,"\\\\'") + '\\',\\'' + (s.description || '').replace(/'/g,"\\\\'") + '\\')"><strong>' + (s.code || '') + '</strong> ' + (s.description || '') + '</div>'
          ).join('');
        }
        dd.style.display = 'block';
      }, 350);
    }
    
    function selectService(id, code, name) {
      document.getElementById('cfg-service-id').value = id;
      document.getElementById('cfg-service-code').value = code;
      document.getElementById('cfg-service-name').value = name;
      document.getElementById('cfg-service-label').textContent = code + ' - ' + name;
      document.getElementById('cfg-service-selected').style.display = 'block';
      document.getElementById('cfg-service-search').value = '';
      document.getElementById('cfg-service-dropdown').style.display = 'none';
    }
    
    async function saveFiscalConfig() {
      const data = {
        municipal_service_id: document.getElementById('cfg-service-id').value,
        municipal_service_code: document.getElementById('cfg-service-code').value,
        municipal_service_name: document.getElementById('cfg-service-name').value,
        default_iss: parseFloat(document.getElementById('cfg-iss').value) || 0,
        observations_template: document.getElementById('cfg-observations').value,
        auto_emit_on_payment: document.getElementById('cfg-auto-emit').classList.contains('on'),
      };
      
      const result = await apiCall('save_fiscal_config', { data });
      if (result.success) { showToast(result.message); }
      else { showToast(result.error || 'Erro', 'error'); }
    }
    
    
    // BX24 init
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() { BX24.fitWindow(); });
    }
  </script>
</body>
</html>`;
}

// Generate payment page (original functionality)
function generatePaymentPage(data: PaymentData, asaasConfig: { apiKey: string; environment: string }): string {
  const methodLabels: Record<string, string> = {
    pix: 'PIX',
    boleto: 'Boleto Bancário',
    credit_card: 'Cartão de Crédito',
  };

  const methodIcons: Record<string, string> = {
    pix: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    boleto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="2" height="16"/><rect x="6" y="4" width="1" height="16"/><rect x="9" y="4" width="2" height="16"/><rect x="13" y="4" width="1" height="16"/><rect x="16" y="4" width="2" height="16"/><rect x="20" y="4" width="2" height="16"/></svg>`,
    credit_card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento - Asaas</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.5;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      padding: 24px;
    }
    .payment-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .payment-header {
      background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
      color: white;
      padding: 20px 24px;
    }
    .payment-method {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .method-icon { width: 32px; height: 32px; opacity: 0.9; }
    .method-name { font-size: 18px; font-weight: 600; }
    .payment-amount { font-size: 32px; font-weight: 700; }
    .payment-body { padding: 24px; }
    .customer-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .customer-info h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
    }
    .customer-info p { margin: 4px 0; font-size: 14px; }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #333;
    }
    .form-group input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    .form-group input:focus { outline: none; border-color: #0066cc; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary { background: #0066cc; color: white; }
    .btn-primary:hover { background: #0052a3; }
    .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
    .loading { display: none; text-align: center; padding: 40px; }
    .loading.show { display: block; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #0066cc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .result { display: none; text-align: center; padding: 40px 24px; }
    .result.show { display: block; }
    .qr-code { max-width: 200px; margin: 20px auto; }
    .qr-code img { width: 100%; border-radius: 8px; }
    .pix-code {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin: 16px 0;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
    }
    .copy-btn { background: #28a745; margin-top: 12px; }
    .copy-btn:hover { background: #218838; }
    .boleto-info {
      text-align: left;
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .boleto-line {
      font-family: monospace;
      word-break: break-all;
      margin: 8px 0;
      padding: 8px;
      background: white;
      border-radius: 4px;
    }
    .error-message {
      background: #fee;
      color: #c00;
      padding: 12px 16px;
      border-radius: 8px;
      margin: 16px 0;
      display: none;
    }
    .error-message.show { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="payment-card">
      <div class="payment-header">
        <div class="payment-method">
          <div class="method-icon">${methodIcons[data.paymentMethod] || methodIcons.pix}</div>
          <span class="method-name">${methodLabels[data.paymentMethod] || 'Pagamento'}</span>
        </div>
        <div class="payment-amount">R$ ${parseFloat(data.amount || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      </div>
      
      <div class="payment-body">
        <div class="customer-info">
          <h3>Dados do Cliente</h3>
          <p><strong>Nome:</strong> ${data.customerName || 'Não informado'}</p>
          <p><strong>Email:</strong> ${data.customerEmail || 'Não informado'}</p>
          <p><strong>CPF/CNPJ:</strong> ${data.customerDocument || 'Não informado'}</p>
        </div>
        
        <div id="form-section">
          ${!data.customerDocument ? `
            <div class="form-group">
              <label for="document">CPF ou CNPJ *</label>
              <input type="text" id="document" placeholder="000.000.000-00" required>
            </div>
          ` : ''}
          
          ${data.paymentMethod === 'credit_card' ? `
            <div class="form-group">
              <label for="cardNumber">Número do Cartão</label>
              <input type="text" id="cardNumber" placeholder="0000 0000 0000 0000">
            </div>
            <div style="display: flex; gap: 12px;">
              <div class="form-group" style="flex: 1;">
                <label for="cardExpiry">Validade</label>
                <input type="text" id="cardExpiry" placeholder="MM/AA">
              </div>
              <div class="form-group" style="flex: 1;">
                <label for="cardCvv">CVV</label>
                <input type="text" id="cardCvv" placeholder="000">
              </div>
            </div>
            <div class="form-group">
              <label for="cardName">Nome no Cartão</label>
              <input type="text" id="cardName" placeholder="NOME COMO NO CARTÃO">
            </div>
          ` : ''}
          
          <button type="button" class="btn btn-primary" id="processBtn" onclick="processPayment()">
            ${data.paymentMethod === 'pix' ? 'Gerar QR Code PIX' : 
              data.paymentMethod === 'boleto' ? 'Gerar Boleto' : 'Pagar com Cartão'}
          </button>
        </div>
        
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p>Processando pagamento...</p>
        </div>
        
        <div class="error-message" id="errorMessage"></div>
        <div class="result" id="result"></div>
      </div>
    </div>
  </div>
  
  <script>
    const paymentData = ${JSON.stringify(data)};
    const asaasConfig = ${JSON.stringify(asaasConfig)};
    
    function showLoading() {
      document.getElementById('form-section').style.display = 'none';
      document.getElementById('loading').classList.add('show');
      document.getElementById('errorMessage').classList.remove('show');
    }
    
    function hideLoading() {
      document.getElementById('loading').classList.remove('show');
    }
    
    function showError(message) {
      hideLoading();
      document.getElementById('form-section').style.display = 'block';
      const errorEl = document.getElementById('errorMessage');
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
    
    function showResult(html) {
      hideLoading();
      const resultEl = document.getElementById('result');
      resultEl.innerHTML = html;
      resultEl.classList.add('show');
    }
    
    async function processPayment() {
      showLoading();
      
      try {
        const docInput = document.getElementById('document');
        const customerDoc = paymentData.customerDocument || 
          (docInput?.value || '').replace(/\\D/g, '');
        
        if (!customerDoc || (customerDoc.length !== 11 && customerDoc.length !== 14)) {
          throw new Error('CPF ou CNPJ inválido');
        }
        
        const requestBody = {
          ...paymentData,
          customerDocument: customerDoc,
          asaasApiKey: asaasConfig?.apiKey,
          asaasEnvironment: asaasConfig?.environment || 'sandbox',
        };
        
        if (paymentData.paymentMethod === 'credit_card') {
          requestBody.cardNumber = document.getElementById('cardNumber')?.value?.replace(/\\s/g, '');
          requestBody.cardExpiry = document.getElementById('cardExpiry')?.value;
          requestBody.cardCvv = document.getElementById('cardCvv')?.value;
          requestBody.cardName = document.getElementById('cardName')?.value;
        }
        
        const response = await fetch('${SUPABASE_URL}/functions/v1/bitrix-payment-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao processar pagamento');
        }
        
        if (paymentData.paymentMethod === 'pix') {
          showResult(
            '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>PIX Gerado com Sucesso!</h3>' +
            '<div class="qr-code"><img src="' + result.qrCodeImage + '" alt="QR Code PIX"></div>' +
            '<p>Escaneie o QR Code ou copie o código abaixo:</p>' +
            '<div class="pix-code" id="pixCode">' + result.pixCode + '</div>' +
            '<button class="btn btn-primary copy-btn" onclick="copyPixCode()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar Código PIX</button>' +
            '<p style="margin-top:16px;font-size:14px;color:#666;">O pagamento será confirmado automaticamente após a transação.</p>'
          );
        } else if (paymentData.paymentMethod === 'boleto') {
          showResult(
            '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Boleto Gerado com Sucesso!</h3>' +
            '<div class="boleto-info"><p><strong>Linha Digitável:</strong></p>' +
            '<div class="boleto-line" id="boletoLine">' + result.boletoDigitableLine + '</div>' +
            '<p><strong>Vencimento:</strong> ' + result.dueDate + '</p></div>' +
            '<button class="btn btn-primary" onclick="window.open(\'' + result.boletoUrl + '\', \'_blank\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Visualizar Boleto</button>' +
            '<button class="btn btn-primary copy-btn" onclick="copyBoletoLine()" style="background:#28a745;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar Linha Digitável</button>'
          );
        } else {
          showResult(
            '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Pagamento Processado!</h3>' +
            '<p>Seu pagamento com cartão foi processado com sucesso.</p>' +
            '<p style="margin-top:16px;font-size:14px;color:#666;">ID da Transação: ' + result.transactionId + '</p>'
          );
        }
        
        if (typeof BX24 !== 'undefined') { BX24.fitWindow(); }
        
      } catch (error) {
        showError(error.message);
      }
    }
    
    function copyPixCode() {
      const code = document.getElementById('pixCode').textContent;
      navigator.clipboard.writeText(code).then(() => alert('Código PIX copiado!'));
    }
    
    function copyBoletoLine() {
      const line = document.getElementById('boletoLine').textContent;
      navigator.clipboard.writeText(line).then(() => alert('Linha digitável copiada!'));
    }
    
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() { BX24.fitWindow(); });
    }
  </script>
</body>
</html>`;
}

// ============= CRM TAB (DEAL/LEAD DETAIL) =============

function generateCrmPaymentTabPage(data: PaymentData, entityType: 'deal' | 'lead', entityId: string): string {
  const safeMember = (data.memberId || '').replace(/"/g, '');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagamentos Asaas</title>
<script src="//api.bitrix24.com/api/v1/"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  body{background:#f7f9fb;color:#1f2937;padding:18px;font-size:14px;}
  h2{font-size:18px;font-weight:600;color:#0c4a6e;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin-bottom:18px;box-shadow:0 1px 2px rgba(0,0,0,.04);}
  .row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px;}
  .row.two{grid-template-columns:1fr 1fr 1fr;}
  .row.one{grid-template-columns:1fr;}
  label{display:block;font-size:12px;color:#475569;font-weight:500;margin-bottom:4px;}
  input,select,textarea{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;outline:none;transition:border .15s;}
  input:focus,select:focus,textarea:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.15);}
  .btn{padding:9px 16px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s;}
  .btn:disabled{opacity:.5;cursor:not-allowed;}
  .btn-primary{background:#00A868;color:#fff;}
  .btn-primary:hover:not(:disabled){background:#008f59;}
  .btn-danger{background:#fff;color:#dc2626;border:1px solid #fecaca;padding:4px 8px;font-size:12px;}
  .btn-danger:hover{background:#fef2f2;}
  .btn-link{background:transparent;color:#0ea5e9;text-decoration:underline;padding:0;}
  .summary{display:flex;gap:18px;font-size:13px;color:#334155;margin:8px 0 14px;padding:10px 14px;background:#f0f9ff;border-radius:6px;border-left:3px solid #0ea5e9;}
  .summary strong{color:#0c4a6e;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{text-align:left;padding:10px 8px;background:#f8fafc;color:#475569;font-weight:600;font-size:12px;text-transform:uppercase;border-bottom:2px solid #e5e7eb;}
  td{padding:10px 8px;border-bottom:1px solid #f1f5f9;}
  tr:hover td{background:#fafbfc;}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;}
  .badge-pending{background:#fef3c7;color:#92400e;}
  .badge-paid{background:#dcfce7;color:#166534;}
  .badge-overdue{background:#fee2e2;color:#991b1b;}
  .badge-cancelled{background:#e5e7eb;color:#4b5563;}
  .badge-active{background:#dbeafe;color:#1e40af;}
  .empty{text-align:center;padding:40px 20px;color:#94a3b8;font-style:italic;}
  .loader{text-align:center;padding:30px;color:#64748b;}
  .alert{padding:10px 14px;border-radius:6px;margin-bottom:12px;font-size:13px;}
  .alert-error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;}
  .alert-success{background:#dcfce7;color:#166534;border:1px solid #86efac;}
  .hidden{display:none !important;}
  .field-row{display:flex;gap:12px;align-items:flex-end;margin-bottom:12px;}
  .actions{display:flex;gap:6px;}
  @media (max-width:768px){.row,.row.two{grid-template-columns:1fr 1fr;}}
</style>
</head>
<body>

<div id="alertBox"></div>

<div class="card">
  <h2>💳 Pagamento do Contrato</h2>
  <div class="row">
    <div>
      <label>Tipo Pagamento</label>
      <select id="fType" onchange="updateForm()">
        <option value="ONCE">À vista</option>
        <option value="INSTALLMENT" selected>Parcelado</option>
        <option value="SUBSCRIPTION">Recorrente (Assinatura)</option>
      </select>
    </div>
    <div>
      <label>Período</label>
      <select id="fPeriod" onchange="recalc()">
        <option value="WEEKLY" selected>Semanal</option>
        <option value="BIWEEKLY">Quinzenal</option>
        <option value="MONTHLY">Mensal</option>
        <option value="QUARTERLY">Trimestral</option>
        <option value="SEMIANNUALLY">Semestral</option>
        <option value="YEARLY">Anual</option>
      </select>
    </div>
    <div>
      <label>Forma Pagamento <span style="color:#dc2626;">*</span></label>
      <select id="fBilling" required>
        <option value="BOLETO" selected>Boleto Bancário</option>
        <option value="PIX">PIX</option>
        <option value="CREDIT_CARD">Cartão de Crédito</option>
        <option value="UNDEFINED">Não definido (cliente escolhe)</option>
      </select>
    </div>
    <div>
      <label>Início (1º Vencimento) <span style="color:#dc2626;">*</span></label>
      <input type="date" id="fStart" required onchange="recalc()">
    </div>
    <div>
      <label>Fim (recorrente) <span id="fEndStar" style="color:#dc2626;display:none;">*</span></label>
      <input type="date" id="fEnd" onchange="recalc()">
    </div>
  </div>
  <div class="row">
    <div><label>Valor Total (R$) <span style="color:#dc2626;">*</span></label><input type="number" step="0.01" min="0.01" id="fTotal" required placeholder="0,00" onchange="recalc()"></div>
    <div><label>Entrada (R$)</label><input type="number" step="0.01" id="fEntry" placeholder="0,00" onchange="recalc()"></div>
    <div><label>Nº de Parcelas <span id="fInstStar" style="color:#dc2626;display:none;">*</span></label><select id="fInstallments" onchange="recalc()">${[1,2,3,4,5,6,7,8,9,10,11,12,15,18,24,36,48,60].map(n => `<option value="${n}"${n===1?' selected':''}>${n}x</option>`).join('')}</select></div>
    <div style="grid-column:span 2;"><label>Descrição</label><input type="text" id="fDesc" placeholder="Ex.: Assinatura Plano Pró"></div>
  </div>
  <div id="contactWarn" class="alert alert-error hidden" style="margin-top:4px;"></div>
  <div id="entryInstallmentsBlock" class="hidden" style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:12px;margin-bottom:12px;">
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#334155;font-weight:600;margin:0;">
        <input type="checkbox" id="fSplitEntry" onchange="recalc()" style="width:auto;"> Parcelar entrada
      </label>
      <div id="entryNWrap" class="hidden" style="display:flex;align-items:center;gap:8px;">
        <label style="margin:0;">Nº parcelas da entrada</label>
        <select id="fEntryN" onchange="recalc()" style="width:auto;">${[1,2,3,4,5,6,7,8,9,10,12,18,24].map(n => `<option value="${n}"${n===2?' selected':''}>${n}x</option>`).join('')}</select>
      </div>
    </div>
    <table id="entryTable" class="hidden" style="margin-top:6px;">
      <thead><tr><th style="width:40px;">#</th><th>Valor</th><th style="width:180px;">Vencimento</th></tr></thead>
      <tbody id="entryTbody"></tbody>
    </table>
  </div>
  <div class="summary" id="summary">Preencha os campos acima para visualizar o resumo.</div>
  <div style="text-align:right;">
    <button class="btn btn-primary" id="btnCreate" onclick="createPayment()">+ Gerar Cobranças</button>
  </div>
</div>

<div class="card">
  <h2>📋 Cobranças do Cliente</h2>
  <div id="chargesArea"><div class="loader">Carregando...</div></div>
</div>

<script>
const ENTITY_TYPE = ${JSON.stringify(entityType)};
const ENTITY_ID = ${JSON.stringify(entityId)};
const MEMBER_ID = ${JSON.stringify(safeMember)};
const API_URL = window.location.origin + window.location.pathname;

let state = { customer: null, customerData: null, dealValue: 0 };

function showAlert(type, msg, timeout) {
  const box = document.getElementById('alertBox');
  box.innerHTML = '<div class="alert alert-' + type + '">' + msg + '</div>';
  if (timeout) setTimeout(() => { box.innerHTML = ''; }, timeout);
}

async function apiCall(action, payload) {
  const body = Object.assign({ action: action, memberId: MEMBER_ID, entityType: ENTITY_TYPE, entityId: ENTITY_ID }, payload || {});
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error('Resposta inválida: ' + text.substring(0, 200)); }
  if (json.error) throw new Error(json.error);
  return json;
}

function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function statusBadge(s) {
  const map = {
    PENDING: ['badge-pending', 'Pendente'],
    AWAITING_RISK_ANALYSIS: ['badge-pending', 'Em análise'],
    CONFIRMED: ['badge-paid', 'Confirmado'],
    RECEIVED: ['badge-paid', 'Pago'],
    RECEIVED_IN_CASH: ['badge-paid', 'Pago (dinheiro)'],
    OVERDUE: ['badge-overdue', 'Vencido'],
    REFUNDED: ['badge-cancelled', 'Reembolsado'],
    REFUND_REQUESTED: ['badge-pending', 'Reembolso solic.'],
    CHARGEBACK_REQUESTED: ['badge-overdue', 'Chargeback'],
    CHARGEBACK_DISPUTE: ['badge-overdue', 'Disputa'],
    DELETED: ['badge-cancelled', 'Excluído'],
    ACTIVE: ['badge-active', 'Ativa'],
    EXPIRED: ['badge-cancelled', 'Expirada'],
  };
  const [cls, label] = map[s] || ['badge-pending', s || '-'];
  return '<span class="badge ' + cls + '">' + label + '</span>';
}
function billingLabel(b) {
  return ({ PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: 'A definir' })[b] || b;
}
function periodDays(p) {
  return ({ WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30, QUARTERLY: 90, SEMIANNUALLY: 180, YEARLY: 365 })[p] || 30;
}
function periodLabel(p) {
  return ({ WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal', QUARTERLY: 'Trimestral', SEMIANNUALLY: 'Semestral', YEARLY: 'Anual' })[p] || p;
}

function updateForm() {
  const t = document.getElementById('fType').value;
  document.getElementById('fInstallments').disabled = (t === 'ONCE' || t === 'SUBSCRIPTION');
  document.getElementById('fEnd').disabled = (t === 'ONCE');
  document.getElementById('fPeriod').disabled = (t === 'ONCE');
  if (t === 'ONCE') document.getElementById('fInstallments').value = 1;
  // Toggle required asterisks based on type
  document.getElementById('fInstStar').style.display = (t === 'INSTALLMENT') ? 'inline' : 'none';
  document.getElementById('fEndStar').style.display = (t === 'SUBSCRIPTION') ? 'inline' : 'none';
  recalc();
}

function recalc() {
  const t = document.getElementById('fType').value;
  const total = parseFloat(document.getElementById('fTotal').value) || 0;
  const entry = parseFloat(document.getElementById('fEntry').value) || 0;
  const start = document.getElementById('fStart').value;
  const end = document.getElementById('fEnd').value;
  const period = document.getElementById('fPeriod').value;
  let nInst = parseInt(document.getElementById('fInstallments').value) || 1;

  // Auto-calc N installments when end date is set
  if (start && end && t !== 'ONCE') {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms > 0) {
      nInst = Math.max(1, Math.floor(ms / (periodDays(period) * 86400000)) + 1);
      document.getElementById('fInstallments').value = nInst;
    }
  }

  const saldo = Math.max(0, total - entry);
  let summary = '';
  if (t === 'ONCE') {
    summary = '<span>1 cobrança no valor de <strong>' + fmtBRL(total) + '</strong></span>';
  } else if (t === 'INSTALLMENT') {
    const vP = nInst > 0 ? saldo / nInst : 0;
    summary = '<span>Saldo: <strong>' + fmtBRL(saldo) + '</strong></span>'
            + '<span>' + nInst + 'x de <strong>' + fmtBRL(vP) + '</strong> (' + periodLabel(period) + ')</span>'
            + (entry > 0 ? '<span>+ Entrada: <strong>' + fmtBRL(entry) + '</strong></span>' : '');
  } else {
    summary = '<span>Assinatura <strong>' + periodLabel(period) + '</strong> de <strong>' + fmtBRL(saldo || total) + '</strong></span>'
            + (entry > 0 ? '<span>+ Entrada: <strong>' + fmtBRL(entry) + '</strong></span>' : '')
            + (end ? '<span>Encerra em <strong>' + fmtDate(end) + '</strong></span>' : '');
  }
  document.getElementById('summary').innerHTML = summary;
  renderEntryInstallments(entry, start);
}

function splitEntryValues(total, n) {
  if (n <= 0 || total <= 0) return [];
  const base = Math.floor((total * 100) / n) / 100;
  const arr = Array(n).fill(base);
  const diff = Math.round((total - base * n) * 100) / 100;
  arr[n - 1] = Math.round((base + diff) * 100) / 100;
  return arr;
}

function addMonthsISO(iso, months) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().split('T')[0];
}

// Stores user-edited dates so that recalc doesn't trample them
let entryDateOverrides = {};
function renderEntryInstallments(entry, start) {
  const block = document.getElementById('entryInstallmentsBlock');
  const split = document.getElementById('fSplitEntry');
  const nWrap = document.getElementById('entryNWrap');
  const table = document.getElementById('entryTable');
  const tbody = document.getElementById('entryTbody');
  if (!(entry > 0)) {
    block.classList.add('hidden');
    split.checked = false;
    nWrap.classList.add('hidden');
    table.classList.add('hidden');
    tbody.innerHTML = '';
    return;
  }
  block.classList.remove('hidden');
  if (!split.checked) {
    nWrap.classList.add('hidden');
    table.classList.add('hidden');
    tbody.innerHTML = '';
    return;
  }
  nWrap.classList.remove('hidden');
  const n = Math.max(1, Math.min(24, parseInt(document.getElementById('fEntryN').value) || 1));
  const values = splitEntryValues(entry, n);
  let html = '';
  for (let i = 0; i < n; i++) {
    const defaultDate = addMonthsISO(start, i);
    const date = entryDateOverrides[i] || defaultDate;
    html += '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td><strong>' + fmtBRL(values[i]) + '</strong></td>'
      + '<td><input type="date" data-eidx="' + i + '" value="' + date + '" onchange="onEntryDateChange(event)"></td>'
      + '</tr>';
  }
  tbody.innerHTML = html;
  table.classList.remove('hidden');
}
function onEntryDateChange(e) {
  const idx = parseInt(e.target.getAttribute('data-eidx'));
  entryDateOverrides[idx] = e.target.value;
}
function collectEntryInstallments() {
  const split = document.getElementById('fSplitEntry');
  const entry = parseFloat(document.getElementById('fEntry').value) || 0;
  const start = document.getElementById('fStart').value;
  if (!(entry > 0)) return [];
  if (!split.checked) return [{ value: entry, dueDate: start }];
  const n = Math.max(1, Math.min(24, parseInt(document.getElementById('fEntryN').value) || 1));
  const values = splitEntryValues(entry, n);
  const out = [];
  for (let i = 0; i < n; i++) {
    const inp = document.querySelector('[data-eidx="' + i + '"]');
    out.push({ value: values[i], dueDate: (inp && inp.value) || entryDateOverrides[i] || addMonthsISO(start, i) });
  }
  return out;
}

async function loadCharges() {
  try {
    const r = await apiCall('crm_tab_load');
    state.customer = r.customer;
    state.customerData = r.customerData || null;
    state.dealValue = r.dealValue || 0;
    if (state.dealValue && !document.getElementById('fTotal').value) {
      document.getElementById('fTotal').value = state.dealValue;
    }
    // Validate contact has CPF/CNPJ + email or phone (Asaas requirements)
    const warn = document.getElementById('contactWarn');
    const cd = state.customerData || {};
    const probs = [];
    if (!cd.cpfCnpj || String(cd.cpfCnpj).length < 11) probs.push('CPF/CNPJ do contato');
    if (!cd.email && !cd.phone) probs.push('E-mail ou telefone do contato');
    if (probs.length > 0) {
      warn.innerHTML = '<strong>⚠️ Dados obrigatórios do contato faltando:</strong><br>' + probs.map(p => '• ' + p).join('<br>') + '<br><small>Preencha no Contato/Lead antes de gerar a cobrança.</small>';
      warn.classList.remove('hidden');
    } else {
      warn.classList.add('hidden');
    }
    // Prefill saved contract fields from Bitrix
    const sf = r.savedFields || {};
    if (sf.contractStart) document.getElementById('fStart').value = String(sf.contractStart).split('T')[0];
    if (sf.contractEnd) document.getElementById('fEnd').value = String(sf.contractEnd).split('T')[0];
    if (sf.cycle) {
      const pSel = document.getElementById('fPeriod');
      if ([...pSel.options].some(o => o.value === sf.cycle)) pSel.value = sf.cycle;
    }
    const recN = parseInt(sf.recurringInstallments);
    if (recN > 1) {
      const iSel = document.getElementById('fInstallments');
      if ([...iSel.options].some(o => parseInt(o.value) === recN)) iSel.value = String(recN);
    }
    const entN = parseInt(sf.entryInstallments);
    if (entN > 1) {
      document.getElementById('fSplitEntry').checked = true;
      const eSel = document.getElementById('fEntryN');
      if ([...eSel.options].some(o => parseInt(o.value) === entN)) eSel.value = String(entN);
    }
    renderCharges(r.charges || [], r.subscriptions || []);
    recalc();
  } catch (e) {
    document.getElementById('chargesArea').innerHTML = '<div class="alert alert-error">Erro ao carregar: ' + e.message + '</div>';
  }
}

function renderCharges(charges, subs) {
  const area = document.getElementById('chargesArea');
  let html = '';
  if (subs.length > 0) {
    html += '<h3 style="font-size:14px;color:#475569;margin-bottom:8px;">Assinaturas</h3>';
    html += '<table><thead><tr><th>ID</th><th>Tipo</th><th>Ciclo</th><th>Valor</th><th>Próx. Venc.</th><th>Status</th><th></th></tr></thead><tbody>';
    subs.forEach(s => {
      html += '<tr>'
        + '<td>' + (s.id || '').substring(0, 12) + '...</td>'
        + '<td>' + billingLabel(s.billingType) + '</td>'
        + '<td>' + periodLabel(s.cycle) + '</td>'
        + '<td>' + fmtBRL(s.value) + '</td>'
        + '<td>' + fmtDate(s.nextDueDate) + '</td>'
        + '<td>' + statusBadge(s.status) + '</td>'
        + '<td class="actions"><button class="btn btn-danger" onclick="cancelSub(\\''+s.id+'\\')">Cancelar</button></td>'
        + '</tr>';
    });
    html += '</tbody></table>';
  }
  if (charges.length > 0) {
    html += '<h3 style="font-size:14px;color:#475569;margin:14px 0 8px;">Cobranças</h3>';
    html += '<table><thead><tr><th>#</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Link</th><th></th></tr></thead><tbody>';
    charges.forEach((c, i) => {
      const canCancel = !['RECEIVED','CONFIRMED','REFUNDED','DELETED'].includes(c.status);
      html += '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + billingLabel(c.billingType) + '</td>'
        + '<td>' + fmtDate(c.dueDate) + '</td>'
        + '<td>' + fmtBRL(c.value) + '</td>'
        + '<td>' + statusBadge(c.status) + '</td>'
        + '<td>' + (c.invoiceUrl ? '<a href="' + c.invoiceUrl + '" target="_blank">Abrir ↗</a>' : '-') + '</td>'
        + '<td class="actions">' + (canCancel ? '<button class="btn btn-danger" onclick="cancelCharge(\\''+c.id+'\\')">✕</button>' : '') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
  }
  if (!html) html = '<div class="empty">Nenhuma cobrança encontrada para este cliente.</div>';
  if (state.customer) {
    html = '<div style="font-size:12px;color:#64748b;margin-bottom:10px;">Cliente Asaas: <strong>' + (state.customer.name || '-') + '</strong> · ' + (state.customer.cpfCnpj || '-') + '</div>' + html;
  }
  area.innerHTML = html;
}

async function createPayment() {
  const btn = document.getElementById('btnCreate');
  btn.disabled = true;
  btn.textContent = 'Processando...';
  try {
    const payload = {
      type: document.getElementById('fType').value,
      billingType: document.getElementById('fBilling').value,
      period: document.getElementById('fPeriod').value,
      startDate: document.getElementById('fStart').value,
      endDate: document.getElementById('fEnd').value,
      total: parseFloat(document.getElementById('fTotal').value) || 0,
      entryValue: parseFloat(document.getElementById('fEntry').value) || 0,
      entryInstallments: collectEntryInstallments(),
      installments: parseInt(document.getElementById('fInstallments').value) || 1,
      description: document.getElementById('fDesc').value,
    };
    // Client-side required validation
    const missing = [];
    const cd = state.customerData || {};
    if (!cd.cpfCnpj || String(cd.cpfCnpj).length < 11) missing.push('CPF/CNPJ do contato');
    if (!cd.email && !cd.phone) missing.push('E-mail ou telefone do contato');
    if (!payload.total || payload.total <= 0) missing.push('Valor total');
    if (!payload.billingType) missing.push('Forma de pagamento');
    if (!payload.startDate) missing.push('Data de início');
    if (payload.type === 'SUBSCRIPTION' && !payload.endDate) missing.push('Data de fim (recorrente)');
    if (payload.type === 'INSTALLMENT' && !(payload.installments > 0)) missing.push('Nº de parcelas');
    if (payload.entryValue > 0 && document.getElementById('fSplitEntry').checked) {
      const ei = payload.entryInstallments || [];
      if (ei.some(it => !it.dueDate)) missing.push('Vencimento de cada parcela da entrada');
    }
    if (missing.length > 0) {
      throw new Error('Campos obrigatórios faltando:\\n- ' + missing.join('\\n- '));
    }
    const r = await apiCall('crm_tab_create', { payload: payload });
    if (r.errorCount && r.errorCount > 0) {
      showAlert('error', '⚠️ ' + (r.successCount || 0) + ' cobrança(s) criada(s), ' + r.errorCount + ' com erro. Veja o timeline do registro.', 8000);
    } else {
      showAlert('success', '✅ Cobranças geradas com sucesso! ' + (r.created || 0) + ' item(ns) criado(s).', 4000);
    }
    await loadCharges();
  } catch (e) {
    showAlert('error', String(e.message).replace(/\\n/g, '<br>'), 8000);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Gerar Cobranças';
  }
}

async function cancelCharge(id) {
  if (!confirm('Cancelar esta cobrança?')) return;
  try {
    await apiCall('crm_tab_cancel_charge', { chargeId: id });
    showAlert('success', 'Cobrança cancelada.', 3000);
    await loadCharges();
  } catch (e) {
    showAlert('error', 'Erro: ' + e.message, 6000);
  }
}
async function cancelSub(id) {
  if (!confirm('Cancelar esta assinatura?')) return;
  try {
    await apiCall('crm_tab_cancel_subscription', { subscriptionId: id });
    showAlert('success', 'Assinatura cancelada.', 3000);
    await loadCharges();
  } catch (e) {
    showAlert('error', 'Erro: ' + e.message, 6000);
  }
}

// Default start date = today
document.getElementById('fStart').value = new Date().toISOString().split('T')[0];
updateForm();
loadCharges();
if (typeof BX24 !== 'undefined') { BX24.init(function(){ BX24.fitWindow(); }); }
</script>
</body>
</html>`;
}

// ============= END CRM TAB =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Payment Iframe Handler called');
    console.log('Method:', req.method);
    
    let paymentData: PaymentData;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      
      const hasPaymentParams = url.searchParams.has('paymentId') || 
                               url.searchParams.has('settings') ||
                               url.searchParams.has('amount') ||
                               url.searchParams.has('memberId') ||
                               url.searchParams.has('member_id') ||
                               url.searchParams.has('DOMAIN');
      
      if (!hasPaymentParams) {
        console.log('GET validation request - returning OK');
        return new Response('<html><body>OK</body></html>', {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }
      
      paymentData = {
        paymentId: url.searchParams.get('paymentId') || '',
        orderId: url.searchParams.get('orderId') || '',
        amount: url.searchParams.get('amount') || '0',
        currency: url.searchParams.get('currency') || 'BRL',
        customerName: url.searchParams.get('customerName') || '',
        customerEmail: url.searchParams.get('customerEmail') || '',
        customerDocument: url.searchParams.get('customerDocument') || '',
        paymentMethod: url.searchParams.get('paymentMethod') || 'pix',
        domain: url.searchParams.get('domain') || url.searchParams.get('DOMAIN') || '',
        memberId: url.searchParams.get('memberId') || url.searchParams.get('member_id') || '',
      };
    } else {
      const bodyText = await req.text();
      console.log('Body length:', bodyText.length);
      
      if (!bodyText || bodyText.trim() === '') {
        console.log('Empty POST body - returning validation OK');
        return new Response('<html><body>OK</body></html>', {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }
      
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(bodyText);
        
        // Log all params for debugging
        const allParams = Object.fromEntries(params.entries());
        console.log('All POST params:', JSON.stringify(allParams));
        
        // Extract memberId and domain with multiple fallback names (Bitrix24 uses different conventions)
        let memberId = params.get('memberId') || params.get('member_id') || params.get('MEMBER_ID') || '';
        let domain = params.get('domain') || params.get('DOMAIN') || '';
        let accessToken = params.get('AUTH_ID') || params.get('auth[access_token]') || '';
        let serverEndpoint = params.get('SERVER_ENDPOINT') || params.get('server_endpoint') || 'https://oauth.bitrix.info/rest/';
        
        // Try to extract from PLACEMENT_OPTIONS (JSON data from Bitrix24 placement)
        const placementOptionsRaw = params.get('PLACEMENT_OPTIONS');
        let parsedPlacementOptions: any = null;
        if (placementOptionsRaw) {
          try {
            const options = JSON.parse(placementOptionsRaw);
            parsedPlacementOptions = options;
            memberId = memberId || options.member_id || options.memberId || '';
            domain = domain || options.DOMAIN || options.domain || '';
            console.log('Parsed PLACEMENT_OPTIONS:', options);
          } catch (e) {
            console.log('Failed to parse PLACEMENT_OPTIONS:', placementOptionsRaw);
          }
        }
        const placement = params.get('PLACEMENT') || params.get('placement') || '';
        
        // Try to extract from auth params (sent during app loading)
        const authMemberId = params.get('AUTH_MEMBER_ID') || params.get('auth[member_id]');
        const authDomain = params.get('AUTH_DOMAIN') || params.get('auth[domain]');
        memberId = memberId || authMemberId || '';
        domain = domain || authDomain || '';
        
        console.log('Extracted - Domain:', domain, 'MemberId:', memberId, 'Placement:', placement, 'AccessToken:', accessToken ? '***exists***' : 'MISSING');
        console.log('Server endpoint:', serverEndpoint);
        
        paymentData = {
          paymentId: params.get('paymentId') || params.get('PAYMENT_ID') || '',
          orderId: params.get('orderId') || params.get('ORDER_ID') || '',
          amount: params.get('amount') || params.get('AMOUNT') || '0',
          currency: params.get('currency') || params.get('CURRENCY') || 'BRL',
          customerName: params.get('customerName') || params.get('CUSTOMER_NAME') || '',
          customerEmail: params.get('customerEmail') || params.get('CUSTOMER_EMAIL') || '',
          customerDocument: params.get('customerDocument') || params.get('CUSTOMER_DOCUMENT') || '',
          paymentMethod: params.get('paymentMethod') || params.get('PAYMENT_METHOD') || 'pix',
          domain: domain,
          memberId: memberId,
          accessToken: accessToken,
          serverEndpoint: serverEndpoint,
          placement: placement,
          placementOptions: parsedPlacementOptions,
        };
      } else {
        // JSON body - check if it's a dashboard action
        const jsonBody = JSON.parse(bodyText);
        
        if (jsonBody.action && jsonBody.memberId) {
          console.log('Dashboard action request:', jsonBody.action);
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          return await handleDashboardAction(jsonBody, supabase);
        }
        
        paymentData = jsonBody;
      }
    }
    
    console.log('Payment data:', JSON.stringify(paymentData));

    // Determine which page to show based on installation state
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let installation = null;
    let asaasConfig = null;
    
    if (paymentData.memberId) {
      // Find installation by member_id - include pay_systems_registered and robots_registered flags
      const { data: inst, error: instError } = await supabase
        .from('bitrix_installations')
        .select('id, tenant_id, domain, pay_systems_registered, robots_registered, placements_registered, badges_registered, deal_fields_registered, access_token')
        .eq('member_id', paymentData.memberId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (instError) {
        console.error('Error finding installation:', instError);
      }
      
      installation = inst;
      console.log('Installation found:', { 
        id: installation?.id,
        tenant_id: installation?.tenant_id, 
        domain: installation?.domain,
        pay_systems_registered: installation?.pay_systems_registered,
        robots_registered: installation?.robots_registered
      });
      
      // Lazy registration: pay systems, logos, and robots
      if (installation) {
        // Use access_token from POST params or from installation record
        const tokenForRegistration = paymentData.accessToken || installation.access_token;
        // Get server endpoint from POST params (oauth.bitrix.info/rest/)
        const serverEndpoint = paymentData.serverEndpoint || 'https://oauth.bitrix.info/rest/';
        // Use domain from POST params or from installation record (may be invalid/empty)
        const domainHint = paymentData.domain || installation.domain;
        
        if (tokenForRegistration) {
          // Build client endpoint for direct API calls (needed for sale.* and bizproc.* methods)
          let clientEndpoint: string | null = null;
          let portalDomain = domainHint;
          
          // If we don't have a valid domain, try to get it from the API
          if (!portalDomain || portalDomain.length < 5 || !portalDomain.includes('.')) {
            console.log('Domain invalid, attempting to fetch from API...');
            const fetchedDomain = await getPortalDomainFromProfile(serverEndpoint, tokenForRegistration);
            if (fetchedDomain) {
              portalDomain = fetchedDomain;
              console.log('Fetched domain from API:', portalDomain);
            }
          }
          
          if (portalDomain && portalDomain.includes('.')) {
            clientEndpoint = `https://${portalDomain}/rest/`;
            console.log('Client endpoint for lazy registration:', clientEndpoint);
          }
          
          // 1. Lazy pay system registration
          if (!installation.pay_systems_registered) {
            console.log('Attempting lazy pay system registration...');
            const registrationResult = await registerPaySystemsLazy(
              domainHint,
              tokenForRegistration,
              serverEndpoint,
              installation.id,
              supabase
            );
            console.log('Lazy pay system registration result:', registrationResult);
            
            // Update portalDomain if registration succeeded
            if (registrationResult.domain) {
              portalDomain = registrationResult.domain;
              clientEndpoint = `https://${portalDomain}/rest/`;
            }
          } else {
            console.log('Pay systems already registered');
            
            // Still try to update logos if we have a valid client endpoint
            if (clientEndpoint) {
              console.log('Updating pay system logos...');
              await updatePaySystemsLogo(clientEndpoint, tokenForRegistration, installation.id, supabase);
            }
          }
          
          // 2. Self-healing robots registration
          // Check URL for repair parameter
          const requestUrl = new URL(req.url);
          const forceRepair = requestUrl.searchParams.get('repair') === 'true';
          
          if (clientEndpoint) {
            // Always use ensureAutomationRobots - it will check if robots exist and repair if needed
            console.log('Checking/ensuring automation robots...');
            const robotsResult = await ensureAutomationRobots(
              clientEndpoint, 
              tokenForRegistration, 
              installation.id, 
              supabase,
              forceRepair || !installation.robots_registered // Force repair if flag is set or robots not registered
            );
            
            console.log('Robots ensure result:', robotsResult);
            
            // 3. Lazy placements registration
            if (!installation.placements_registered) {
              console.log('Registering CRM placements...');
              const placementsResult = await registerPlacements(clientEndpoint, tokenForRegistration);
              console.log('Placements result:', placementsResult);
              
              if (placementsResult.success) {
                await supabase
                  .from('bitrix_installations')
                  .update({ placements_registered: true, updated_at: new Date().toISOString() })
                  .eq('id', installation.id);
              }
            }
            
            // 4. Lazy badges registration
            if (!installation.badges_registered) {
              console.log('Registering CRM badges...');
              const badgesResult = await registerBadges(clientEndpoint, tokenForRegistration);
              console.log('Badges result:', badgesResult);
              
              if (badgesResult.success) {
                await supabase
                  .from('bitrix_installations')
                  .update({ badges_registered: true, updated_at: new Date().toISOString() })
                  .eq('id', installation.id);
              }
            }

            // 5. Lazy Deal custom fields registration (UF_CRM_ASAAS_*)
            if (!installation.deal_fields_registered || forceRepair) {
              console.log('Ensuring Deal Asaas custom fields...');
              const dealFieldsResult = await ensureDealAsaasFields(clientEndpoint, tokenForRegistration);
              console.log('Deal fields result:', dealFieldsResult);
              if (dealFieldsResult.success) {
                await supabase
                  .from('bitrix_installations')
                  .update({ deal_fields_registered: true, updated_at: new Date().toISOString() })
                  .eq('id', installation.id);
              }
            }
            
            
            // Update domain if we got a valid one
            if (portalDomain && portalDomain.includes('.')) {
              await supabase
                .from('bitrix_installations')
                .update({ 
                  domain: portalDomain,
                  updated_at: new Date().toISOString()
                })
                .eq('id', installation.id);
            }
          } else {
            console.log('Cannot ensure robots - missing client endpoint');
          }
        } else {
          console.log('Cannot perform lazy registration - missing access_token');
        }
      }
      
      if (installation?.tenant_id) {
        const { data: config } = await supabase
          .from('asaas_configurations')
          .select('api_key, environment, is_active')
          .eq('tenant_id', installation.tenant_id)
          .eq('is_active', true)
          .single();
        
        if (config?.api_key) {
          asaasConfig = { apiKey: config.api_key, environment: config.environment };
        }
        console.log('Asaas config found:', !!asaasConfig);
      }
    }

    // Check URL params for settings=true
    const url = new URL(req.url);
    const showSettings = url.searchParams.get('settings') === 'true';

    // Preview mode - show dashboard with mock data
    if (paymentData.memberId === 'preview_mode') {
      console.log('Showing preview mode dashboard');
      const mockInstallation = { id: 'preview', tenant_id: 'preview', domain: 'preview.bitrix24.com' };
      const mockAsaasConfig = { apiKey: 'preview', environment: 'sandbox' };
      const html = await generateDashboardPage(mockInstallation, mockAsaasConfig, supabase);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Scenario 1: No tenant linked - show auth page
    if (!installation?.tenant_id) {
      console.log('Showing auth page - no tenant linked');
      const html = generateAuthPage(paymentData);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Scenario 2: Tenant linked but no Asaas config - show config page
    if (!asaasConfig) {
      console.log('Showing config page - no Asaas config');
      const html = generateConfigPage(paymentData);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Check if user wants to edit settings
    if (showSettings) {
      console.log('Showing config page - settings requested');
      const html = generateConfigPage(paymentData);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Detect context: payment checkout vs CRM tab vs normal app opening
    const isPaymentContext = paymentData.paymentId && parseFloat(paymentData.amount || '0') > 0;
    const isCrmTabContext = paymentData.placement === 'CRM_DEAL_DETAIL_TAB' || paymentData.placement === 'CRM_LEAD_DETAIL_TAB';

    // Scenario 3a: Payment context - show payment page
    if (isPaymentContext) {
      console.log('Showing payment page - checkout context');
      const html = generatePaymentPage(paymentData, asaasConfig);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Scenario 3b: CRM Detail Tab (Deal/Lead) - show payments tab
    if (isCrmTabContext) {
      console.log('Showing CRM payment tab for placement:', paymentData.placement);
      const entityType = paymentData.placement === 'CRM_DEAL_DETAIL_TAB' ? 'deal' : 'lead';
      const entityId = paymentData.placementOptions?.ID || '';
      const html = generateCrmPaymentTabPage(paymentData, entityType, entityId);
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Scenario 3b: Normal app context - show dashboard
    console.log('Showing dashboard - normal app context');
    const html = await generateDashboardPage(installation, asaasConfig, supabase);
    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-payment-iframe:', error);
    
    return new Response(
      `<html><body><h1>Erro</h1><p>${errorMessage}</p></body></html>`,
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      }
    );
  }
});
