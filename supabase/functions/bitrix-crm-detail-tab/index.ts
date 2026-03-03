import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Helper to call Bitrix24 API
async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string) {
  const url = `${endpoint}${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken }),
  });
  return await response.json();
}

// Helper to create configurable activity with badge
async function createConfigurableActivity(
  clientEndpoint: string,
  accessToken: string,
  ownerTypeId: number,
  ownerId: string,
  amount: number,
  paymentMethod: string,
  asaasId: string,
  paymentUrl: string
): Promise<string | null> {
  const methodLabel: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão' };
  
  const result = await callBitrixApi(clientEndpoint, 'crm.activity.configurable.add', {
    ownerTypeId,
    ownerId: parseInt(ownerId),
    fields: {
      completed: false,
      badgeCode: 'asaas_charge_created',
    },
    layout: {
      icon: { code: 'dollar' },
      header: { title: `Cobrança Asaas - ${methodLabel[paymentMethod] || paymentMethod}` },
      body: {
        blocks: {
          info: {
            type: 'lineOfBlocks',
            properties: {
              blocks: {
                value: { type: 'text', properties: { value: `R$ ${amount.toFixed(2).replace('.', ',')}` } },
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
            action: { type: 'copyToClipboard', value: paymentUrl || '' },
            type: 'secondary',
          },
        },
      },
    },
  }, accessToken);

  if (result.result?.id) {
    console.log('[Activity] Created configurable activity:', result.result.id);
    return String(result.result.id);
  }
  console.error('[Activity] Failed to create:', result.error);
  return null;
}

// Map placement to entity type info
function getEntityInfo(placement: string): { type: string; ownerTypeId: number } | null {
  if (placement === 'CRM_LEAD_DETAIL_TAB') return { type: 'lead', ownerTypeId: 1 };
  if (placement === 'CRM_DEAL_DETAIL_TAB') return { type: 'deal', ownerTypeId: 2 };
  // SPA/Dynamic entities have CRM_DYNAMIC_XXX_DETAIL_TAB format
  if (placement.startsWith('CRM_DYNAMIC_') && placement.endsWith('_DETAIL_TAB')) {
    const typeId = placement.replace('CRM_DYNAMIC_', '').replace('_DETAIL_TAB', '');
    return { type: 'deal', ownerTypeId: parseInt(typeId) || 2 };
  }
  return null;
}

function generateDetailTabHTML(
  entityType: string,
  entityId: string,
  ownerTypeId: number,
  transactions: any[],
  memberId: string,
  domain: string,
  accessToken: string
): string {
  // Calculate metrics
  const totalCharged = transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalReceived = transactions
    .filter((t: any) => t.status === 'confirmed' || t.status === 'received')
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalOpen = transactions
    .filter((t: any) => t.status === 'pending' || t.status === 'overdue')
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalCount = transactions.length;

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    received: 'Recebido',
    overdue: 'Vencido',
    refunded: 'Reembolsado',
    cancelled: 'Cancelado',
  };

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    received: '#10b981',
    overdue: '#ef4444',
    refunded: '#8b5cf6',
    cancelled: '#6b7280',
  };

  const methodLabels: Record<string, string> = {
    pix: 'PIX',
    boleto: 'Boleto',
    credit_card: 'Cartão',
  };

  const transactionRows = transactions.map((t: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
        ${t.customer_name || '-'}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;">
        R$ ${(t.amount || 0).toFixed(2).replace('.', ',')}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
        ${methodLabels[t.payment_method] || t.payment_method}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
        <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${statusColors[t.status] || '#6b7280'}20;color:${statusColors[t.status] || '#6b7280'}">
          ${statusLabels[t.status] || t.status}
        </span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
        ${t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
        ${t.payment_url ? `<a href="${t.payment_url}" target="_blank" style="color:#0066cc;text-decoration:none;">Ver</a>` : '-'}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamentos Asaas</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      padding: 16px;
      color: #1e293b;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .metric-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .metric-value { font-size: 22px; font-weight: 700; }
    .metric-value.received { color: #10b981; }
    .metric-value.open { color: #f59e0b; }
    .metric-value.total { color: #0066cc; }
    .metric-value.count { color: #6366f1; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0066cc, #0052a3);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .table-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
      margin-bottom: 20px;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      padding: 12px;
      background: #f8fafc;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
    }
    .form-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .form-overlay.active { display: flex; }
    .form-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      width: 90%;
      max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .form-card h3 { margin-bottom: 16px; font-size: 18px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #475569; }
    .form-group input, .form-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }
    .form-group input:focus, .form-group select:focus { border-color: #0066cc; box-shadow: 0 0 0 3px rgba(0,102,204,0.1); }
    .form-actions { display: flex; gap: 10px; margin-top: 16px; }
    .btn-cancel {
      background: #f1f5f9;
      color: #475569;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      flex: 1;
    }
    .result-box {
      display: none;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 14px;
      margin-top: 12px;
    }
    .result-box.error { background: #fef2f2; border-color: #fecaca; }
    .result-box .link-copy {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .result-box .link-copy input {
      flex: 1;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 12px;
    }
    .result-box .link-copy button {
      padding: 8px 12px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    @media (max-width: 600px) {
      .metrics { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="metrics">
    <div class="metric-card">
      <div class="metric-label">Total Cobrado</div>
      <div class="metric-value total">R$ ${totalCharged.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Recebido</div>
      <div class="metric-value received">R$ ${totalReceived.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Em Aberto</div>
      <div class="metric-value open">R$ ${totalOpen.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Cobranças</div>
      <div class="metric-value count">${totalCount}</div>
    </div>
  </div>

  <div class="section-title">
    <span>Cobranças Vinculadas</span>
    <button class="btn-primary" onclick="showForm()">+ Gerar Cobrança</button>
  </div>

  <div class="table-container">
    ${totalCount > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Valor</th>
          <th>Método</th>
          <th>Status</th>
          <th>Vencimento</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        ${transactionRows}
      </tbody>
    </table>
    ` : `
    <div class="empty-state">
      <p style="font-size:32px;margin-bottom:8px;">💰</p>
      <p style="font-weight:600;margin-bottom:4px;">Nenhuma cobrança vinculada</p>
      <p style="font-size:13px;">Clique em "Gerar Cobrança" para criar uma nova.</p>
    </div>
    `}
  </div>

  <!-- Charge creation form overlay -->
  <div class="form-overlay" id="chargeForm">
    <div class="form-card">
      <h3>Nova Cobrança</h3>
      <div class="form-group">
        <label>Valor (R$)</label>
        <input type="number" id="chargeAmount" step="0.01" min="0.01" placeholder="0,00" />
      </div>
      <div class="form-group">
        <label>Método de Pagamento</label>
        <select id="chargeMethod">
          <option value="pix">PIX</option>
          <option value="boleto">Boleto</option>
          <option value="credit_card">Cartão de Crédito</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nome do Cliente</label>
        <input type="text" id="chargeName" placeholder="Nome completo" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="chargeEmail" placeholder="email@exemplo.com" />
      </div>
      <div class="form-group">
        <label>CPF/CNPJ</label>
        <input type="text" id="chargeDocument" placeholder="000.000.000-00" />
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick="hideForm()">Cancelar</button>
        <button class="btn-primary" id="btnCreateCharge" onclick="createCharge()" style="flex:1;">Gerar Cobrança</button>
      </div>
      <div class="result-box" id="chargeResult">
        <p id="resultText"></p>
        <div class="link-copy" id="linkCopy" style="display:none;">
          <input type="text" id="paymentLink" readonly />
          <button onclick="copyLink()">Copiar</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    var entityType = '${entityType}';
    var entityId = '${entityId}';
    var ownerTypeId = ${ownerTypeId};
    var memberId = '${memberId}';
    var domain = '${domain}';
    var accessToken = '${accessToken}';
    var supabaseUrl = '${SUPABASE_URL}';

    function showForm() { document.getElementById('chargeForm').classList.add('active'); }
    function hideForm() {
      document.getElementById('chargeForm').classList.remove('active');
      document.getElementById('chargeResult').style.display = 'none';
    }

    async function createCharge() {
      var btn = document.getElementById('btnCreateCharge');
      btn.disabled = true;
      btn.textContent = 'Criando...';

      var resultBox = document.getElementById('chargeResult');
      resultBox.style.display = 'none';

      try {
        var payload = {
          entityType: entityType,
          entityId: entityId,
          ownerTypeId: ownerTypeId,
          memberId: memberId,
          domain: domain,
          accessToken: accessToken,
          amount: document.getElementById('chargeAmount').value,
          paymentMethod: document.getElementById('chargeMethod').value,
          customerName: document.getElementById('chargeName').value,
          customerEmail: document.getElementById('chargeEmail').value,
          customerDocument: document.getElementById('chargeDocument').value,
        };

        var resp = await fetch(supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_charge', ...payload }),
        });

        var data = await resp.json();

        resultBox.style.display = 'block';
        if (data.success) {
          resultBox.className = 'result-box';
          document.getElementById('resultText').textContent = 'Cobrança criada com sucesso!';
          if (data.paymentUrl) {
            document.getElementById('linkCopy').style.display = 'flex';
            document.getElementById('paymentLink').value = data.paymentUrl;
          }
        } else {
          resultBox.className = 'result-box error';
          document.getElementById('resultText').textContent = 'Erro: ' + (data.error || 'Erro desconhecido');
          document.getElementById('linkCopy').style.display = 'none';
        }
      } catch (e) {
        resultBox.style.display = 'block';
        resultBox.className = 'result-box error';
        document.getElementById('resultText').textContent = 'Erro: ' + e.message;
        document.getElementById('linkCopy').style.display = 'none';
      }

      btn.disabled = false;
      btn.textContent = 'Gerar Cobrança';
    }

    function copyLink() {
      var input = document.getElementById('paymentLink');
      input.select();
      document.execCommand('copy');
      alert('Link copiado!');
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
    // Handle GET for marketplace validation
    if (req.method === 'GET') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();

    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a JSON action request (from the form inside the tab)
    if (contentType.includes('application/json')) {
      const jsonData = JSON.parse(bodyText);

      if (jsonData.action === 'create_charge') {
        console.log('[CRM Detail Tab] Creating charge:', jsonData);

        // Find installation
        const { data: installation } = await supabase
          .from('bitrix_installations')
          .select('id, tenant_id, client_endpoint, domain')
          .eq('member_id', jsonData.memberId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!installation?.tenant_id) {
          return new Response(JSON.stringify({ success: false, error: 'Instalação não encontrada' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get Asaas config
        const { data: asaasConfig } = await supabase
          .from('asaas_configurations')
          .select('api_key, environment')
          .eq('tenant_id', installation.tenant_id)
          .eq('is_active', true)
          .maybeSingle();

        if (!asaasConfig?.api_key) {
          return new Response(JSON.stringify({ success: false, error: 'Asaas não configurado' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const baseUrl = asaasConfig.environment === 'production'
          ? 'https://api.asaas.com/v3'
          : 'https://sandbox.asaas.com/api/v3';

        const amount = parseFloat(jsonData.amount);
        if (!amount || amount <= 0) {
          return new Response(JSON.stringify({ success: false, error: 'Valor inválido' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const cpfCnpj = (jsonData.customerDocument || '').replace(/\D/g, '');
        if (!cpfCnpj) {
          return new Response(JSON.stringify({ success: false, error: 'CPF/CNPJ obrigatório' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Find or create customer
        const searchResp = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfCnpj}`, {
          headers: { 'access_token': asaasConfig.api_key },
        });
        const searchResult = await searchResp.json();

        let customerId: string;
        if (searchResult.data?.length > 0) {
          customerId = searchResult.data[0].id;
        } else {
          const createResp = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers: { 'access_token': asaasConfig.api_key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: jsonData.customerName || 'Cliente',
              email: jsonData.customerEmail || '',
              cpfCnpj,
            }),
          });
          const customer = await createResp.json();
          if (customer.errors) {
            return new Response(JSON.stringify({ success: false, error: customer.errors[0]?.description }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          customerId = customer.id;
        }

        // Create payment
        const billingTypeMap: Record<string, string> = { pix: 'PIX', boleto: 'BOLETO', credit_card: 'CREDIT_CARD' };
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);

        const paymentResp = await fetch(`${baseUrl}/payments`, {
          method: 'POST',
          headers: { 'access_token': asaasConfig.api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: customerId,
            billingType: billingTypeMap[jsonData.paymentMethod] || 'PIX',
            value: amount,
            dueDate: dueDate.toISOString().split('T')[0],
            externalReference: `bitrix_${jsonData.entityType}_${jsonData.entityId}`,
            description: `Cobrança ${jsonData.entityType} #${jsonData.entityId}`,
          }),
        });

        const payment = await paymentResp.json();
        if (payment.errors) {
          return new Response(JSON.stringify({ success: false, error: payment.errors[0]?.description }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Store transaction
        const { data: insertedTx } = await supabase.from('transactions').insert({
          tenant_id: installation.tenant_id,
          asaas_id: payment.id,
          amount,
          payment_method: jsonData.paymentMethod || 'pix',
          status: 'pending',
          customer_name: jsonData.customerName,
          customer_email: jsonData.customerEmail,
          customer_document: jsonData.customerDocument,
          due_date: payment.dueDate,
          payment_url: payment.invoiceUrl,
          bitrix_entity_type: jsonData.entityType === 'lead' ? 'lead' : 'deal',
          bitrix_entity_id: jsonData.entityId,
        }).select('id').single();

        // Create configurable activity with badge
        const clientEndpoint = installation.client_endpoint || (installation.domain ? `https://${installation.domain}/rest/` : null);
        if (clientEndpoint && jsonData.accessToken) {
          const activityId = await createConfigurableActivity(
            clientEndpoint,
            jsonData.accessToken,
            jsonData.ownerTypeId || 2,
            jsonData.entityId,
            amount,
            jsonData.paymentMethod || 'pix',
            payment.id,
            payment.invoiceUrl || ''
          );

          if (activityId && insertedTx?.id) {
            await supabase.from('transactions')
              .update({ bitrix_activity_id: activityId })
              .eq('id', insertedTx.id);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          transactionId: payment.id,
          paymentUrl: payment.invoiceUrl || '',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Form-urlencoded POST from Bitrix24 placement
    const params = new URLSearchParams(bodyText);
    const allParams = Object.fromEntries(params.entries());
    console.log('[CRM Detail Tab] Params:', JSON.stringify(allParams));

    const placement = params.get('PLACEMENT') || '';
    const memberId = params.get('member_id') || params.get('MEMBER_ID') || params.get('auth[member_id]') || '';
    const domain = params.get('DOMAIN') || params.get('domain') || params.get('auth[domain]') || '';
    const accessToken = params.get('AUTH_ID') || params.get('auth[access_token]') || '';

    // Parse entity ID from PLACEMENT_OPTIONS
    let entityId = '';
    const placementOptions = params.get('PLACEMENT_OPTIONS');
    if (placementOptions) {
      try {
        const opts = JSON.parse(placementOptions);
        entityId = opts.ID || opts.id || '';
        console.log('[CRM Detail Tab] Entity ID from PLACEMENT_OPTIONS:', entityId);
      } catch (e) {
        console.log('[CRM Detail Tab] Failed to parse PLACEMENT_OPTIONS');
      }
    }

    const entityInfo = getEntityInfo(placement);
    if (!entityInfo) {
      console.log('[CRM Detail Tab] Unknown placement:', placement);
      return new Response('<html><body>Placement não reconhecido</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    console.log('[CRM Detail Tab] Entity:', entityInfo.type, entityId, 'Member:', memberId);

    // Find installation
    const { data: installation } = await supabase
      .from('bitrix_installations')
      .select('id, tenant_id')
      .eq('member_id', memberId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!installation?.tenant_id) {
      return new Response(generateDetailTabHTML(entityInfo.type, entityId, entityInfo.ownerTypeId, [], memberId, domain, accessToken), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Fetch transactions for this entity
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', installation.tenant_id)
      .eq('bitrix_entity_type', entityInfo.type)
      .eq('bitrix_entity_id', entityId)
      .order('created_at', { ascending: false });

    const html = generateDetailTabHTML(
      entityInfo.type,
      entityId,
      entityInfo.ownerTypeId,
      transactions || [],
      memberId,
      domain,
      accessToken
    );

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRM Detail Tab] Error:', error);
    return new Response(`<html><body><h1>Erro</h1><p>${msg}</p></body></html>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});
