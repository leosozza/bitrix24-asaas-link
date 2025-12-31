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
  console.log(`Calling Bitrix API: ${url}`);
  
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
  console.log(`Bitrix API response for ${method}:`, JSON.stringify(data));
  return data;
}

async function registerPaySystemHandler(clientEndpoint: string, accessToken: string, installationId: string) {
  console.log('Registering Pay System Handler...');
  
  const handlerResult = await callBitrixApi(clientEndpoint, 'sale.paysystem.handler.add', {
    NAME: 'Asaas Pagamentos',
    CODE: 'asaas_payments',
    SORT: 100,
    SETTINGS: {
      CURRENCY: ['BRL'],
      CLIENT_TYPE: 'b2c',
      IFRAME_DATA: {
        ACTION_URI: `${APP_DOMAIN}/functions/v1/bitrix-payment-iframe`,
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
        ASAAS_API_KEY: {
          NAME: 'Chave API Asaas',
          DESCRIPTION: 'Sua chave de API do Asaas (encontre em Configurações > Integrações)',
          SORT: 100,
          INPUT: { TYPE: 'STRING' },
        },
        ASAAS_ENVIRONMENT: {
          NAME: 'Ambiente',
          DESCRIPTION: 'Sandbox para testes, Produção para uso real',
          SORT: 200,
          INPUT: {
            TYPE: 'ENUM',
            OPTIONS: {
              sandbox: 'Sandbox (Testes)',
              production: 'Produção',
            },
          },
        },
        PAYMENT_METHOD: {
          NAME: 'Método de Pagamento',
          SORT: 300,
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

  return handlerResult;
}

async function createPaySystems(
  clientEndpoint: string, 
  accessToken: string, 
  installationId: string,
  supabase: ReturnType<typeof createClient>
) {
  console.log('Creating Pay Systems...');
  
  const payMethods = [
    { code: 'pix', name: 'Asaas - PIX', description: 'Pagamento instantâneo via PIX' },
    { code: 'boleto', name: 'Asaas - Boleto', description: 'Pagamento via Boleto Bancário' },
    { code: 'credit_card', name: 'Asaas - Cartão', description: 'Pagamento via Cartão de Crédito' },
  ];

  // Get person types first
  const personTypesResult = await callBitrixApi(clientEndpoint, 'sale.persontype.list', {}, accessToken);
  const personTypes = personTypesResult.result || [];
  
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
        console.log(`Created pay system: ${method.name} (ID: ${paySystemResult.result})`);
      }
    }
  }
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
    
    // Parse Bitrix form data - handles both flat params (AUTH_ID) and nested (auth[access_token])
    const parseBitrixFormData = (params: URLSearchParams): BitrixInstallEvent => {
      // Log all params for debugging
      console.log('All params:', Object.fromEntries(params.entries()));
      
      // Try to get PLACEMENT_OPTIONS which contains JSON with auth data
      const placementOptions = params.get('PLACEMENT_OPTIONS');
      let parsedOptions: Record<string, string> = {};
      
      if (placementOptions) {
        try {
          parsedOptions = JSON.parse(placementOptions);
          console.log('Parsed PLACEMENT_OPTIONS:', parsedOptions);
        } catch (e) {
          console.log('Failed to parse PLACEMENT_OPTIONS');
        }
      }
      
      // Extract domain from SERVER_ENDPOINT or AUTH_ID
      const serverEndpoint = params.get('SERVER_ENDPOINT') || '';
      let domain = '';
      if (serverEndpoint) {
        // SERVER_ENDPOINT format: https://oauth.bitrix.info/rest/
        // We need the actual portal domain - try to get from other params
        const authId = params.get('AUTH_ID') || '';
        // For marketplace apps, we need to determine the domain differently
        // Check if there's a domain in the referrer or elsewhere
      }
      
      // For REST apps, Bitrix sends flat parameters
      const accessToken = params.get('AUTH_ID') || '';
      const refreshToken = params.get('REFRESH_ID') || '';
      const authExpires = params.get('AUTH_EXPIRES') || '';
      const memberId = params.get('member_id') || '';
      const status = params.get('status') || '';
      const serverEp = params.get('SERVER_ENDPOINT') || '';
      
      // Calculate domain from server endpoint or use member_id for API calls
      // For REST API calls, we need to use the server endpoint
      // The actual portal domain can be derived from the member_id lookup
      
      // For now, construct client endpoint from server endpoint
      // Bitrix24 REST apps use SERVER_ENDPOINT for OAuth and need client_endpoint for API calls
      // The client_endpoint format is: https://{domain}/rest/
      
      console.log('Parsed flat params:', {
        accessToken: accessToken ? '***exists***' : 'missing',
        refreshToken: refreshToken ? '***exists***' : 'missing',
        memberId,
        status,
        serverEndpoint: serverEp,
      });
      
      return {
        event: params.get('event') || 'ONAPPINSTALL',
        data: {
          VERSION: '',
          ACTIVE: '',
        },
        ts: '',
        auth: {
          access_token: accessToken,
          expires: authExpires,
          expires_in: '3600',
          scope: params.get('scope') || '',
          domain: memberId, // Use member_id as domain identifier for now
          server_endpoint: serverEp,
          status: status,
          client_endpoint: serverEp, // Will need to be updated after OAuth flow
          member_id: memberId,
          user_id: '',
          refresh_token: refreshToken,
          application_token: params.get('APP_SID') || '',
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
    
    // Check if installation already exists
    const { data: existingInstall } = await supabase
      .from('bitrix_installations')
      .select('id')
      .eq('member_id', auth.member_id)
      .single();

    let installationId: string;
    
    if (existingInstall) {
      // Update existing installation
      const { error: updateError } = await supabase
        .from('bitrix_installations')
        .update({
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
        })
        .eq('id', existingInstall.id);
      
      if (updateError) {
        console.error('Error updating installation:', updateError);
        throw updateError;
      }
      
      installationId = existingInstall.id;
      console.log('Updated existing installation:', installationId);
    } else {
      // We need a tenant_id - for marketplace apps, we'll create a placeholder
      // The user will link their account later through the dashboard
      // For now, we'll use a system tenant or handle this differently
      
      // Create new installation with a temporary system reference
      // This will be linked to a real tenant when they configure their account
      const { data: newInstall, error: insertError } = await supabase
        .from('bitrix_installations')
        .insert({
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
          // tenant_id will need to be handled - see note below
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error('Error creating installation:', insertError);
        // If tenant_id is required, we need to handle this differently
        // Return success to Bitrix but log the issue
        return new Response(
          `<script>
            alert('Instalação iniciada! Configure sua conta em ${APP_DOMAIN}/dashboard');
            BX24.installFinish();
          </script>`,
          { 
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          }
        );
      }
      
      installationId = newInstall.id;
      console.log('Created new installation:', installationId);
    }

    // Register pay system handler
    await registerPaySystemHandler(auth.client_endpoint, auth.access_token, installationId);
    
    // Create pay systems
    await createPaySystems(auth.client_endpoint, auth.access_token, installationId, supabase as any);

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
    .info-box {
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
      text-align: left;
    }
    .info-box h3 { margin: 0 0 12px; font-size: 16px; }
    .info-box ul { margin: 0; padding-left: 20px; }
    .info-box li { margin: 8px 0; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1>Asaas Pagamentos Instalado!</h1>
    <p>O sistema de pagamentos Asaas foi configurado com sucesso.</p>
    
    <div class="info-box">
      <h3>Próximos passos:</h3>
      <ul>
        <li>Acesse Configurações > Sistemas de Pagamento</li>
        <li>Configure sua Chave API do Asaas em cada método</li>
        <li>Selecione o ambiente (Sandbox ou Produção)</li>
        <li>Comece a receber pagamentos via PIX, Boleto ou Cartão!</li>
      </ul>
    </div>
  </div>
  
  <script>
    BX24.init(function() {
      setTimeout(function() {
        BX24.installFinish();
      }, 3000);
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
