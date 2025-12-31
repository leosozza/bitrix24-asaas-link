import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_DOMAIN = Deno.env.get('APP_DOMAIN') || 'https://asaas.thoth24.com';

interface BitrixInstallEvent {
  event: string;
  data: {
    VERSION: string;
    ACTIVE: string;
  };
  ts: string;
  auth: {
    access_token: string;
    expires: string;
    expires_in: string;
    scope: string;
    domain: string;
    server_endpoint: string;
    status: string;
    client_endpoint: string;
    member_id: string;
    user_id: string;
    refresh_token: string;
    application_token: string;
  };
}

async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string) {
  const url = `${endpoint}${method}`;
  console.log(`[Bitrix API] Calling: ${method}`);
  console.log(`[Bitrix API] URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        auth: accessToken,
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`[Bitrix API] Error in ${method}:`, data.error, data.error_description);
    } else {
      console.log(`[Bitrix API] Success in ${method}:`, JSON.stringify(data.result).substring(0, 300));
    }
    
    return data;
  } catch (error) {
    console.error(`[Bitrix API] Fetch error in ${method}:`, error);
    throw error;
  }
}

// Fetch portal info using app.info to get the real domain
async function getPortalInfo(serverEndpoint: string, accessToken: string): Promise<{ domain: string | null; clientEndpoint: string | null }> {
  console.log('[getPortalInfo] Fetching portal info from:', serverEndpoint);
  
  try {
    const result = await callBitrixApi(serverEndpoint, 'app.info', {}, accessToken);
    
    if (result.result) {
      const domain = result.result.DOMAIN || result.result.domain || null;
      const clientEndpoint = domain ? `https://${domain}/rest/` : null;
      
      console.log('[getPortalInfo] Extracted domain:', domain);
      console.log('[getPortalInfo] Constructed clientEndpoint:', clientEndpoint);
      
      return { domain, clientEndpoint };
    }
    
    console.log('[getPortalInfo] No result from app.info');
    return { domain: null, clientEndpoint: null };
  } catch (error) {
    console.error('[getPortalInfo] Error:', error);
    return { domain: null, clientEndpoint: null };
  }
}

async function registerPaySystemHandler(clientEndpoint: string, accessToken: string, appDomain: string) {
  console.log('Registering Pay System Handler at endpoint:', clientEndpoint);
  
  // First try to delete existing handler (in case of reinstall)
  const deleteResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.handler.delete', {
    CODE: 'asaas_payments',
  }, accessToken);
  console.log('Delete existing handler result:', JSON.stringify(deleteResult));
  
  // Now register the handler
  const handlerResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.handler.add', {
    NAME: 'Asaas Pagamentos',
    CODE: 'asaas_payments',
    SORT: 100,
    SETTINGS: {
      CURRENCY: ['BRL'],
      CLIENT_TYPE: 'b2c',
      IFRAME_DATA: {
        ACTION_URI: `${appDomain}/functions/v1/bitrix-payment-iframe`,
        FIELDS: {
          paymentId: { CODE: 'PAYMENT_ID' },
          orderId: { CODE: 'ORDER_ID' },
          amount: { CODE: 'PAYMENT_AMOUNT' },
          currency: { CODE: 'PAYMENT_CURRENCY' },
          customerName: { CODE: 'CUSTOMER_NAME' },
          customerEmail: { CODE: 'CUSTOMER_EMAIL' },
          customerDocument: { CODE: 'CUSTOMER_DOCUMENT' },
          paymentMethod: { CODE: 'PAYMENT_METHOD' },
        },
      },
      CODES: {
        PAYMENT_METHOD: {
          NAME: 'Método de Pagamento',
          SORT: 100,
          INPUT: {
            TYPE: 'ENUM',
            OPTIONS: {
              pix: 'PIX',
              boleto: 'Boleto Bancário',
              credit_card: 'Cartão de Crédito',
            },
          },
        },
        PAYMENT_ID: {
          NAME: 'ID do Pagamento',
          GROUP: 'PAYMENT',
          DEFAULT: { PROVIDER_KEY: 'PAYMENT', PROVIDER_VALUE: 'ID' },
        },
        ORDER_ID: {
          NAME: 'ID do Pedido',
          GROUP: 'ORDER',
          DEFAULT: { PROVIDER_KEY: 'ORDER', PROVIDER_VALUE: 'ID' },
        },
        PAYMENT_AMOUNT: {
          NAME: 'Valor do Pagamento',
          GROUP: 'PAYMENT',
          DEFAULT: { PROVIDER_KEY: 'PAYMENT', PROVIDER_VALUE: 'SUM' },
        },
        PAYMENT_CURRENCY: {
          NAME: 'Moeda',
          GROUP: 'PAYMENT',
          DEFAULT: { PROVIDER_KEY: 'PAYMENT', PROVIDER_VALUE: 'CURRENCY' },
        },
        CUSTOMER_NAME: {
          NAME: 'Nome do Cliente',
          GROUP: 'ORDER',
          DEFAULT: { PROVIDER_KEY: 'ORDER', PROVIDER_VALUE: 'USER_NAME' },
        },
        CUSTOMER_EMAIL: {
          NAME: 'Email do Cliente',
          GROUP: 'ORDER',
          DEFAULT: { PROVIDER_KEY: 'ORDER', PROVIDER_VALUE: 'USER_EMAIL' },
        },
        CUSTOMER_DOCUMENT: {
          NAME: 'CPF/CNPJ do Cliente',
          GROUP: 'PROPERTY',
        },
      },
    },
  }, accessToken);

  if (handlerResult.error) {
    console.error('Failed to register handler:', handlerResult.error, handlerResult.error_description);
  } else {
    console.log('Handler registered successfully:', JSON.stringify(handlerResult.result));
  }
  
  return handlerResult;
}

async function createPaySystems(
  clientEndpoint: string, 
  accessToken: string, 
  installationId: string,
  supabase: any
) {
  console.log('Creating Pay Systems at endpoint:', clientEndpoint);
  
  const payMethods = [
    { code: 'pix', name: 'Asaas - PIX', description: 'Pagamento instantâneo via PIX' },
    { code: 'boleto', name: 'Asaas - Boleto', description: 'Pagamento via Boleto Bancário' },
    { code: 'credit_card', name: 'Asaas - Cartão', description: 'Pagamento via Cartão de Crédito' },
  ];

  // Get person types first
  const personTypesResult = await callBitrixApi(clientEndpoint, 'sale.persontype.list', {}, accessToken);
  console.log('Person types result:', JSON.stringify(personTypesResult));
  
  const personTypes = personTypesResult.result || [];
  
  if (personTypes.length === 0) {
    console.log('No person types found, creating pay systems without person type filter');
    // Create at least one pay system per method without person type
    for (const method of payMethods) {
      const paySystemResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.add', {
        NAME: method.name,
        DESCRIPTION: method.description,
        PSA_NAME: method.name,
        BX_REST_HANDLER: 'asaas_payments',
        ACTIVE: 'Y',
        ENTITY_REGISTRY_TYPE: 'ORDER',
        NEW_WINDOW: 'N',
        SETTINGS: {
          PAYMENT_METHOD: { TYPE: 'VALUE', VALUE: method.code },
        },
      }, accessToken);

      if (paySystemResult.result) {
        console.log(`Created pay system: ${method.name} (ID: ${paySystemResult.result})`);
        
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
    return;
  }
  
  for (const method of payMethods) {
    for (const personType of personTypes) {
      const paySystemResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.add', {
        NAME: method.name,
        DESCRIPTION: method.description,
        PSA_NAME: method.name,
        PERSON_TYPE_ID: personType.ID,
        BX_REST_HANDLER: 'asaas_payments',
        ACTIVE: 'Y',
        ENTITY_REGISTRY_TYPE: 'ORDER',
        NEW_WINDOW: 'N',
        SETTINGS: {
          PAYMENT_METHOD: { TYPE: 'VALUE', VALUE: method.code },
        },
      }, accessToken);

      if (paySystemResult.result) {
        console.log(`Created pay system: ${method.name} for person type ${personType.ID} (ID: ${paySystemResult.result})`);
        
        // Save to database
        await supabase.from('bitrix_pay_systems').insert({
          installation_id: installationId,
          pay_system_id: String(paySystemResult.result),
          payment_method: method.code,
          entity_type: personType.NAME || 'ORDER',
          is_active: true,
        });
      } else if (paySystemResult.error) {
        console.error(`Failed to create pay system ${method.name}:`, paySystemResult.error, paySystemResult.error_description);
      }
    }
  }
}

async function registerAutomationRobots(clientEndpoint: string, accessToken: string, appDomain: string) {
  console.log('[Robots] Registering automation robots...');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const handlerUrl = `${supabaseUrl}/functions/v1/bitrix-robot-handler`;
  
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
        amount: {
          Name: 'Valor (R$)',
          Type: 'double',
          Required: 'Y',
        },
        customer_name: {
          Name: 'Nome do Cliente',
          Type: 'string',
          Required: 'Y',
        },
        customer_email: {
          Name: 'Email do Cliente',
          Type: 'string',
          Required: 'N',
        },
        customer_document: {
          Name: 'CPF/CNPJ',
          Type: 'string',
          Required: 'Y',
        },
        due_days: {
          Name: 'Dias para Vencimento',
          Type: 'int',
          Default: 3,
        },
      },
      RETURN_PROPERTIES: {
        charge_id: {
          Name: 'ID da Cobrança',
          Type: 'string',
        },
        charge_status: {
          Name: 'Status',
          Type: 'string',
        },
        payment_url: {
          Name: 'Link de Pagamento',
          Type: 'string',
        },
        pix_code: {
          Name: 'Código PIX Copia-Cola',
          Type: 'string',
        },
        boleto_url: {
          Name: 'URL do Boleto',
          Type: 'string',
        },
        error: {
          Name: 'Mensagem de Erro',
          Type: 'string',
        },
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
      },
      RETURN_PROPERTIES: {
        status: {
          Name: 'Status do Pagamento',
          Type: 'string',
        },
        paid_at: {
          Name: 'Data do Pagamento',
          Type: 'string',
        },
        paid_value: {
          Name: 'Valor Pago',
          Type: 'double',
        },
        error: {
          Name: 'Mensagem de Erro',
          Type: 'string',
        },
      },
    },
  ];

  for (const robot of robots) {
    // Try to delete existing robot first (in case of reinstall)
    const deleteResult = await callBitrixApi(clientEndpoint, 'bizproc.robot.delete', {
      CODE: robot.CODE,
    }, accessToken);
    console.log(`[Robots] Delete ${robot.CODE}:`, deleteResult.result || deleteResult.error);

    // Register the robot
    const addResult = await callBitrixApi(clientEndpoint, 'bizproc.robot.add', robot, accessToken);
    
    if (addResult.error) {
      console.error(`[Robots] Failed to register ${robot.CODE}:`, addResult.error, addResult.error_description);
    } else {
      console.log(`[Robots] Registered ${robot.CODE}:`, addResult.result);
    }
  }
  
  console.log('[Robots] Automation robots registration complete');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Install Handler called');
    console.log('Method:', req.method);
    
    // Handle GET requests (marketplace validation)
    if (req.method === 'GET') {
      console.log('GET request - returning validation OK');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Parse the incoming request body
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    console.log('Content-Type:', contentType);
    console.log('Body length:', bodyText.length);
    
    // Handle empty body (marketplace validation POST)
    if (!bodyText || bodyText.trim() === '') {
      console.log('Empty body - returning validation OK');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    let eventData: BitrixInstallEvent;
    
    // Helper to extract nested params like auth[domain] or flat params like DOMAIN
    const extractParam = (params: URLSearchParams, nested: string, flat: string): string => {
      return params.get(nested) || params.get(flat) || params.get(flat.toLowerCase()) || '';
    };

    // Parse Bitrix form data - handles both flat params (AUTH_ID) and nested (auth[access_token])
    const parseBitrixFormData = (params: URLSearchParams): BitrixInstallEvent => {
      // Log all params for debugging
      const allParams = Object.fromEntries(params.entries());
      console.log('All params:', JSON.stringify(allParams));
      
      // Extract nested auth params (auth[domain], auth[access_token], etc.)
      const nestedDomain = extractParam(params, 'auth[domain]', 'DOMAIN');
      const nestedAccessToken = extractParam(params, 'auth[access_token]', 'AUTH_ID');
      const nestedRefreshToken = extractParam(params, 'auth[refresh_token]', 'REFRESH_ID');
      const nestedMemberId = extractParam(params, 'auth[member_id]', 'member_id');
      const nestedClientEndpoint = extractParam(params, 'auth[client_endpoint]', 'CLIENT_ENDPOINT');
      const nestedServerEndpoint = extractParam(params, 'auth[server_endpoint]', 'SERVER_ENDPOINT');
      const nestedApplicationToken = extractParam(params, 'auth[application_token]', 'APP_SID');
      const nestedUserId = extractParam(params, 'auth[user_id]', 'USER_ID');
      const nestedExpires = extractParam(params, 'auth[expires]', 'AUTH_EXPIRES');
      const nestedExpiresIn = extractParam(params, 'auth[expires_in]', 'AUTH_EXPIRES_IN') || '3600';
      const nestedScope = extractParam(params, 'auth[scope]', 'scope');
      const nestedStatus = extractParam(params, 'auth[status]', 'status');
      
      // Determine actual portal domain
      let portalDomain = nestedDomain;
      
      // If client_endpoint exists but domain doesn't, extract from client_endpoint
      if (!portalDomain && nestedClientEndpoint) {
        const match = nestedClientEndpoint.match(/https?:\/\/([^\/]+)/);
        if (match) portalDomain = match[1];
      }
      
      // Construct client_endpoint from domain if not provided
      let clientEndpoint = nestedClientEndpoint;
      if (!clientEndpoint && portalDomain) {
        clientEndpoint = `https://${portalDomain}/rest/`;
      }
      
      // For marketplace apps, use server_endpoint if no client_endpoint
      // The oauth.bitrix.info server acts as a proxy for API calls
      let apiEndpoint = clientEndpoint || nestedServerEndpoint;
      
      console.log('Parsed install params:', {
        domain: portalDomain,
        memberId: nestedMemberId,
        accessToken: nestedAccessToken ? '***exists***' : 'missing',
        refreshToken: nestedRefreshToken ? '***exists***' : 'missing',
        clientEndpoint,
        serverEndpoint: nestedServerEndpoint,
        apiEndpoint,
      });
      
      return {
        event: params.get('event') || 'ONAPPINSTALL',
        data: {
          VERSION: '',
          ACTIVE: '',
        },
        ts: '',
        auth: {
          access_token: nestedAccessToken,
          expires: nestedExpires,
          expires_in: nestedExpiresIn,
          scope: nestedScope,
          domain: portalDomain,
          server_endpoint: nestedServerEndpoint,
          status: nestedStatus,
          client_endpoint: clientEndpoint,
          member_id: nestedMemberId,
          user_id: nestedUserId,
          refresh_token: nestedRefreshToken,
          application_token: nestedApplicationToken,
        },
      };
    };
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyText);
      console.log('Raw params count:', Array.from(params.entries()).length);
      eventData = parseBitrixFormData(params);
    } else {
      eventData = JSON.parse(bodyText);
    }
    
    console.log('Event data:', JSON.stringify(eventData));
    
    const { auth } = eventData;
    
    if (!auth?.access_token || !auth?.member_id) {
      console.error('Missing required auth data - access_token or member_id');
      return new Response(
        `<script>BX24.installFinish();</script>`,
        { 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Use member_id as the primary identifier for installations
    const domainValue = auth.domain || auth.member_id;
    
    // Upsert installation - create or update based on member_id
    const { data: upsertedInstall, error: upsertError } = await supabase
      .from('bitrix_installations')
      .upsert({
        domain: domainValue,
        member_id: auth.member_id,
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_at: new Date(Date.now() + parseInt(auth.expires_in) * 1000).toISOString(),
        scope: auth.scope,
        bitrix_user_id: auth.user_id,
        application_token: auth.application_token,
        server_endpoint: auth.server_endpoint,
        client_endpoint: auth.client_endpoint,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'member_id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    let installationId: string;
      
    if (upsertError || !upsertedInstall) {
      console.error('Error upserting installation:', upsertError);
      const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; }
    .container { text-align: center; padding: 40px; }
    .error-icon { color: #ef4444; font-size: 48px; margin-bottom: 16px; }
    h1 { margin: 0 0 16px; }
    p { opacity: 0.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">⚠️</div>
    <h1>Erro na Instalação</h1>
    <p>Ocorreu um erro ao registrar a instalação. Por favor, tente novamente.</p>
    <p style="font-size: 12px; margin-top: 20px;">Erro: ${upsertError?.message || 'Unknown error'}</p>
  </div>
  <script>
    BX24.init(function() {
      setTimeout(function() {
        BX24.installFinish();
      }, 5000);
    });
  </script>
</body>
</html>`;
      return new Response(errorHtml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    
    installationId = upsertedInstall.id;
    console.log('Upserted installation:', installationId);

    // Fetch the real portal domain via app.info
    let portalClientEndpoint = auth.client_endpoint;
    let portalDomain = auth.domain;
    
    if (auth.server_endpoint && auth.access_token) {
      console.log('Fetching portal info via app.info...');
      const portalInfo = await getPortalInfo(auth.server_endpoint, auth.access_token);
      
      if (portalInfo.domain && portalInfo.clientEndpoint) {
        portalDomain = portalInfo.domain;
        portalClientEndpoint = portalInfo.clientEndpoint;
        
        // Update installation with real domain and client_endpoint
        await supabase
          .from('bitrix_installations')
          .update({
            domain: portalDomain,
            client_endpoint: portalClientEndpoint,
            updated_at: new Date().toISOString(),
          })
          .eq('id', installationId);
        
        console.log('Updated installation with portal domain:', portalDomain);
      }
    }
    
    // NOTE: Pay system registration is deferred to bitrix-payment-iframe
    // This is because oauth.bitrix.info proxy doesn't support sale.* methods
    // We need the actual portal domain which is only available when the user opens the app
    console.log('Installation complete - pay systems will be registered when user opens the app');
    console.log('Portal domain available:', !!portalDomain);
    console.log('Client endpoint available:', !!portalClientEndpoint);
    
    // Register automation robots (bizproc.robot.add works via oauth proxy)
    if (auth.server_endpoint && auth.access_token) {
      console.log('Registering automation robots...');
      try {
        await registerAutomationRobots(auth.server_endpoint, auth.access_token, APP_DOMAIN);
        console.log('Automation robots registered successfully');
      } catch (robotError) {
        console.error('Failed to register automation robots:', robotError);
        // Don't fail the installation if robots fail - they can be registered later
      }
    }

    // Build auth URL with member_id and domain params for automatic linking
    const authUrl = `${APP_DOMAIN}/auth?member_id=${encodeURIComponent(auth.member_id)}&domain=${encodeURIComponent(domainValue)}`;
    
    // Return success response with BX24.installFinish()
    const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Asaas Pagamentos - Instalação</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 500px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .success-icon svg {
      width: 40px;
      height: 40px;
      fill: white;
    }
    h1 { margin: 0 0 16px; font-size: 24px; }
    p { margin: 0 0 24px; opacity: 0.8; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }
    .info-box {
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 20px;
      margin-top: 24px;
      text-align: left;
    }
    .info-box h3 { margin: 0 0 12px; font-size: 16px; }
    .info-box ul { margin: 0; padding-left: 20px; }
    .info-box li { margin: 8px 0; opacity: 0.9; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1>Asaas Pagamentos Instalado!</h1>
    <p>O sistema de pagamentos foi configurado com sucesso no seu Bitrix24.</p>
    
    <a href="${authUrl}" target="_blank" class="btn">
      Ativar Integração
    </a>
    
    <div class="info-box">
      <h3>Próximos passos:</h3>
      <ul>
        <li>Clique em "Ativar Integração" para criar sua conta</li>
        <li>Configure sua Chave API do Asaas no painel</li>
        <li>Comece a receber pagamentos via PIX, Boleto ou Cartão!</li>
      </ul>
    </div>
  </div>
  
  <script>
    BX24.init(function() {
      setTimeout(function() {
        BX24.installFinish();
      }, 2000);
    });
  </script>
</body>
</html>`;

    return new Response(successHtml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-install:', error);
    
    return new Response(
      `<script>
        console.error('Installation error: ${errorMessage}');
        BX24.installFinish();
      </script>`,
      { 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      }
    );
  }
});
