import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    
    if (handlerResult.error) {
      return { success: false, message: `Handler registration failed: ${handlerResult.error_description || handlerResult.error}` };
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
    } else {
      return { success: false, message: 'No pay systems were created' };
    }
  } catch (error) {
    console.error('Error during lazy pay system registration:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============= END BITRIX API FUNCTIONS =============

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
      <h1>🔐 Ativar Integração Asaas</h1>
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
      <h1>⚙️ Configurar Asaas</h1>
      <p>Insira sua chave API para processar pagamentos</p>
    </div>
    
    <div class="config-body">
      <div class="error-message" id="errorMessage"></div>
      <div class="success-message" id="successMessage"></div>
      
      <div id="config-form">
        <div class="form-group">
          <label for="environment">Ambiente</label>
          <select id="environment">
            <option value="sandbox">🧪 Sandbox (Testes)</option>
            <option value="production">🚀 Produção</option>
          </select>
          <small>Use Sandbox para testes e Produção para cobranças reais</small>
        </div>
        <div class="form-group">
          <label for="apiKey">Chave API do Asaas</label>
          <input type="password" id="apiKey" placeholder="$aact_xxxxxxxxxxxxxxxx...">
          <small>Encontre em: Asaas → Configurações → Integrações → API</small>
        </div>
        <button class="btn btn-success" onclick="saveConfig()">✅ Ativar Pagamentos</button>
      </div>
      
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Validando configuração...</p>
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

// Generate payment page (original functionality)
function generatePaymentPage(data: PaymentData, asaasConfig: { apiKey: string; environment: string }): string {
  const methodLabels: Record<string, string> = {
    pix: 'PIX',
    boleto: 'Boleto Bancário',
    credit_card: 'Cartão de Crédito',
  };

  const methodIcons: Record<string, string> = {
    pix: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.68 1.07 5.11 2.81 6.89l-1.69 1.69c-.63.63-.18 1.71.71 1.71h6.91c.55 0 1-.45 1-1v-1.5c0-.55-.45-1-1-1H6.8l.9-.9c1.41 1.13 3.19 1.81 5.14 1.81 4.35 0 7.91-3.37 8.22-7.64.04-.54-.38-.97-.92-.97h-1.5c-.49 0-.9.36-.98.85-.28 1.89-1.89 3.36-3.82 3.36-2.12 0-3.85-1.73-3.85-3.85s1.73-3.85 3.85-3.85c.95 0 1.81.35 2.48.92l-1.06 1.06c-.39.39-.11 1.06.45 1.06h4.24c.41 0 .75-.34.75-.75V6.3c0-.56-.67-.84-1.06-.45l-.99.99C16.65 5.11 14.46 4 12.04 4V2z"/></svg>`,
    boleto: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 4h2v16H2V4zm4 0h1v16H6V4zm3 0h2v16H9V4zm4 0h1v16h-1V4zm3 0h2v16h-2V4zm4 0h2v16h-2V4z"/></svg>`,
    credit_card: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>`,
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
          showResult(\`
            <h3>✅ PIX Gerado com Sucesso!</h3>
            <div class="qr-code">
              <img src="\${result.qrCodeImage}" alt="QR Code PIX">
            </div>
            <p>Escaneie o QR Code ou copie o código abaixo:</p>
            <div class="pix-code" id="pixCode">\${result.pixCode}</div>
            <button class="btn btn-primary copy-btn" onclick="copyPixCode()">📋 Copiar Código PIX</button>
            <p style="margin-top: 16px; font-size: 14px; color: #666;">
              O pagamento será confirmado automaticamente após a transação.
            </p>
          \`);
        } else if (paymentData.paymentMethod === 'boleto') {
          showResult(\`
            <h3>✅ Boleto Gerado com Sucesso!</h3>
            <div class="boleto-info">
              <p><strong>Linha Digitável:</strong></p>
              <div class="boleto-line" id="boletoLine">\${result.boletoDigitableLine}</div>
              <p><strong>Vencimento:</strong> \${result.dueDate}</p>
            </div>
            <button class="btn btn-primary" onclick="window.open('\${result.boletoUrl}', '_blank')">📄 Visualizar Boleto</button>
            <button class="btn btn-primary copy-btn" onclick="copyBoletoLine()" style="background: #28a745;">📋 Copiar Linha Digitável</button>
          \`);
        } else {
          showResult(\`
            <h3>✅ Pagamento Processado!</h3>
            <p>Seu pagamento com cartão foi processado com sucesso.</p>
            <p style="margin-top: 16px; font-size: 14px; color: #666;">
              ID da Transação: \${result.transactionId}
            </p>
          \`);
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
                               url.searchParams.has('memberId');
      
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
        domain: url.searchParams.get('domain') || '',
        memberId: url.searchParams.get('memberId') || '',
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
        const placementOptions = params.get('PLACEMENT_OPTIONS');
        if (placementOptions) {
          try {
            const options = JSON.parse(placementOptions);
            memberId = memberId || options.member_id || options.memberId || '';
            domain = domain || options.DOMAIN || options.domain || '';
            console.log('Parsed PLACEMENT_OPTIONS:', options);
          } catch (e) {
            console.log('Failed to parse PLACEMENT_OPTIONS:', placementOptions);
          }
        }
        
        // Try to extract from auth params (sent during app loading)
        const authMemberId = params.get('AUTH_MEMBER_ID') || params.get('auth[member_id]');
        const authDomain = params.get('AUTH_DOMAIN') || params.get('auth[domain]');
        memberId = memberId || authMemberId || '';
        domain = domain || authDomain || '';
        
        console.log('Extracted - Domain:', domain, 'MemberId:', memberId, 'AccessToken:', accessToken ? '***exists***' : 'MISSING');
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
        };
      } else {
        paymentData = JSON.parse(bodyText);
      }
    }
    
    console.log('Payment data:', JSON.stringify(paymentData));

    // Determine which page to show based on installation state
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let installation = null;
    let asaasConfig = null;
    
    if (paymentData.memberId) {
      // Find installation by member_id - include pay_systems_registered flag
      const { data: inst, error: instError } = await supabase
        .from('bitrix_installations')
        .select('id, tenant_id, domain, pay_systems_registered, access_token')
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
        pay_systems_registered: installation?.pay_systems_registered 
      });
      
      // Try lazy pay system registration if we have access_token
      if (installation && !installation.pay_systems_registered) {
        // Use access_token from POST params or from installation record
        const tokenForRegistration = paymentData.accessToken || installation.access_token;
        // Get server endpoint from POST params (oauth.bitrix.info/rest/)
        const serverEndpoint = paymentData.serverEndpoint || 'https://oauth.bitrix.info/rest/';
        // Use domain from POST params or from installation record (may be invalid/empty)
        const domainHint = paymentData.domain || installation.domain;
        
        if (tokenForRegistration) {
          console.log('Attempting lazy pay system registration...');
          console.log('Domain hint:', domainHint);
          console.log('Server endpoint:', serverEndpoint);
          
          const registrationResult = await registerPaySystemsLazy(
            domainHint,
            tokenForRegistration,
            serverEndpoint,
            installation.id,
            supabase
          );
          
          console.log('Lazy registration result:', registrationResult);
        } else {
          console.log('Cannot register pay systems - missing access_token');
        }
      } else if (installation?.pay_systems_registered) {
        console.log('Pay systems already registered for this installation');
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

    // Scenario 3: Everything configured - show payment page
    console.log('Showing payment page - fully configured');
    const html = generatePaymentPage(paymentData, asaasConfig);
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
