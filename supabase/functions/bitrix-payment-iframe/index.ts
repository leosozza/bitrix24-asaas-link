import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_DOMAIN = Deno.env.get('APP_DOMAIN') || 'https://asaas.thoth24.com';

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
}

function generatePaymentPage(data: PaymentData, asaasConfig: { apiKey: string; environment: string } | null): string {
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

  const needsConfig = !asaasConfig?.apiKey;

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
    
    .method-icon {
      width: 32px;
      height: 32px;
      opacity: 0.9;
    }
    
    .method-name {
      font-size: 18px;
      font-weight: 600;
    }
    
    .payment-amount {
      font-size: 32px;
      font-weight: 700;
    }
    
    .payment-body {
      padding: 24px;
    }
    
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
    
    .customer-info p {
      margin: 4px 0;
      font-size: 14px;
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
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
    
    .btn-primary:hover {
      background: #0052a3;
    }
    
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .loading {
      display: none;
      text-align: center;
      padding: 40px;
    }
    
    .loading.show {
      display: block;
    }
    
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
    
    .result {
      display: none;
      text-align: center;
      padding: 40px 24px;
    }
    
    .result.show {
      display: block;
    }
    
    .qr-code {
      max-width: 200px;
      margin: 20px auto;
    }
    
    .qr-code img {
      width: 100%;
      border-radius: 8px;
    }
    
    .pix-code {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin: 16px 0;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
    }
    
    .copy-btn {
      background: #28a745;
      margin-top: 12px;
    }
    
    .copy-btn:hover {
      background: #218838;
    }
    
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
    
    .error-message.show {
      display: block;
    }
    
    .config-warning {
      background: #fff3cd;
      color: #856404;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
      text-align: center;
    }
    
    .config-warning h3 {
      margin-bottom: 8px;
    }
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
        ${needsConfig ? `
          <div class="config-warning">
            <h3>⚠️ Configuração Necessária</h3>
            <p>Configure sua Chave API do Asaas nas configurações do sistema de pagamento para processar cobranças.</p>
          </div>
        ` : `
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
          
          <div class="result" id="result">
            <!-- Will be populated by JavaScript -->
          </div>
        `}
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
        const document = paymentData.customerDocument || 
          (document.getElementById('document')?.value || '').replace(/\\D/g, '');
        
        if (!document || (document.length !== 11 && document.length !== 14)) {
          throw new Error('CPF ou CNPJ inválido');
        }
        
        const requestBody = {
          ...paymentData,
          customerDocument: document,
          asaasApiKey: asaasConfig?.apiKey,
          asaasEnvironment: asaasConfig?.environment || 'sandbox',
        };
        
        // Add card data if credit card payment
        if (paymentData.paymentMethod === 'credit_card') {
          requestBody.cardNumber = document.getElementById('cardNumber')?.value?.replace(/\\s/g, '');
          requestBody.cardExpiry = document.getElementById('cardExpiry')?.value;
          requestBody.cardCvv = document.getElementById('cardCvv')?.value;
          requestBody.cardName = document.getElementById('cardName')?.value;
        }
        
        const response = await fetch('${APP_DOMAIN}/functions/v1/bitrix-payment-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao processar pagamento');
        }
        
        // Show appropriate result based on payment method
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
        
        // Notify Bitrix24 of success
        if (typeof BX24 !== 'undefined') {
          BX24.fitWindow();
        }
        
      } catch (error) {
        showError(error.message);
      }
    }
    
    function copyPixCode() {
      const code = document.getElementById('pixCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        alert('Código PIX copiado!');
      });
    }
    
    function copyBoletoLine() {
      const line = document.getElementById('boletoLine').textContent;
      navigator.clipboard.writeText(line).then(() => {
        alert('Linha digitável copiada!');
      });
    }
    
    // Initialize BX24
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() {
        BX24.fitWindow();
      });
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
    
    // Get payment data from query params or POST body
    let paymentData: PaymentData;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
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
      const body = await req.json();
      paymentData = body;
    }
    
    console.log('Payment data:', JSON.stringify(paymentData));

    // Get Asaas configuration from database if domain is provided
    let asaasConfig = null;
    
    if (paymentData.domain && paymentData.memberId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Find installation and get tenant's Asaas config
      const { data: installation } = await supabase
        .from('bitrix_installations')
        .select('tenant_id')
        .eq('domain', paymentData.domain)
        .eq('member_id', paymentData.memberId)
        .single();
      
      if (installation?.tenant_id) {
        const { data: config } = await supabase
          .from('asaas_configurations')
          .select('api_key, environment')
          .eq('tenant_id', installation.tenant_id)
          .eq('is_active', true)
          .single();
        
        if (config) {
          asaasConfig = { apiKey: config.api_key || '', environment: config.environment };
        }
      }
    }

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
