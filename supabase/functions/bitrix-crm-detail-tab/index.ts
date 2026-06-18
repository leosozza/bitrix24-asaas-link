import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============ Bitrix helpers ============
async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string) {
  const url = `${endpoint}${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken }),
  });
  return await response.json();
}

async function addTimelineComment(clientEndpoint: string, token: string, entityType: string, entityId: string, comment: string) {
  try {
    await callBitrixApi(clientEndpoint, 'crm.timeline.comment.add', {
      fields: { ENTITY_ID: parseInt(entityId), ENTITY_TYPE: entityType.toUpperCase(), COMMENT: comment },
    }, token);
  } catch (e) {
    console.error('[Timeline] error', e);
  }
}

// Ensure UF_CRM_ASAAS_* custom fields exist on Deal
async function ensureCustomFields(supabase: any, installationId: string, clientEndpoint: string, token: string) {
  const { data: inst } = await supabase.from('bitrix_installations').select('custom_fields_created').eq('id', installationId).maybeSingle();
  if (inst?.custom_fields_created) return;

  const fields = [
    { FIELD_NAME: 'UF_CRM_ASAAS_CONTRACT_START', USER_TYPE_ID: 'date', EDIT_FORM_LABEL: { br: 'Início do Contrato' }, LIST_COLUMN_LABEL: { br: 'Início do Contrato' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_CONTRACT_END', USER_TYPE_ID: 'date', EDIT_FORM_LABEL: { br: 'Fim do Contrato' }, LIST_COLUMN_LABEL: { br: 'Fim do Contrato' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_ENTRY_VALUE', USER_TYPE_ID: 'double', EDIT_FORM_LABEL: { br: 'Valor da Entrada' }, LIST_COLUMN_LABEL: { br: 'Valor da Entrada' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_ENTRY_INSTALLMENTS', USER_TYPE_ID: 'integer', EDIT_FORM_LABEL: { br: 'Parcelas da Entrada' }, LIST_COLUMN_LABEL: { br: 'Parcelas da Entrada' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_RECURRING_VALUE', USER_TYPE_ID: 'double', EDIT_FORM_LABEL: { br: 'Valor Recorrente' }, LIST_COLUMN_LABEL: { br: 'Valor Recorrente' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_CYCLE', USER_TYPE_ID: 'string', EDIT_FORM_LABEL: { br: 'Ciclo (WEEKLY/BIWEEKLY/MONTHLY)' }, LIST_COLUMN_LABEL: { br: 'Ciclo' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_WEEKDAY', USER_TYPE_ID: 'integer', EDIT_FORM_LABEL: { br: 'Dia da Semana (0=Dom)' }, LIST_COLUMN_LABEL: { br: 'Dia da Semana' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_PAYMENT_METHOD', USER_TYPE_ID: 'string', EDIT_FORM_LABEL: { br: 'Forma de Pagamento' }, LIST_COLUMN_LABEL: { br: 'Forma de Pagamento' } },
  ];

  for (const f of fields) {
    try {
      await callBitrixApi(clientEndpoint, 'crm.deal.userfield.add', { fields: f }, token);
    } catch (e) {
      console.log('[Custom fields] skip', f.FIELD_NAME, e);
    }
  }

  await supabase.from('bitrix_installations').update({ custom_fields_created: true }).eq('id', installationId);
}

async function getDealFields(clientEndpoint: string, token: string, entityType: string, entityId: string): Promise<any> {
  if (entityType !== 'deal') return {};
  try {
    const r = await callBitrixApi(clientEndpoint, 'crm.deal.get', { id: parseInt(entityId) }, token);
    return r.result || {};
  } catch { return {}; }
}

async function getCrmCustomer(clientEndpoint: string, token: string, entityType: string, entityId: string): Promise<any> {
  try {
    if (entityType === 'lead') {
      const r = await callBitrixApi(clientEndpoint, 'crm.lead.get', { id: parseInt(entityId) }, token);
      const l = r.result || {};
      return {
        name: [l.NAME, l.LAST_NAME].filter(Boolean).join(' ').trim() || l.TITLE || '',
        email: l.EMAIL?.[0]?.VALUE || '',
        phone: l.PHONE?.[0]?.VALUE || '',
        document: '',
      };
    }
    const dr = await callBitrixApi(clientEndpoint, 'crm.deal.get', { id: parseInt(entityId) }, token);
    const deal = dr.result || {};
    if (deal.CONTACT_ID) {
      const cr = await callBitrixApi(clientEndpoint, 'crm.contact.get', { id: deal.CONTACT_ID }, token);
      const c = cr.result || {};
      return {
        name: [c.NAME, c.LAST_NAME].filter(Boolean).join(' ').trim(),
        email: c.EMAIL?.[0]?.VALUE || '',
        phone: c.PHONE?.[0]?.VALUE || '',
        document: '',
      };
    }
  } catch (e) { console.error('[CrmCustomer]', e); }
  return { name: '', email: '', phone: '', document: '' };
}

// ============ Asaas helpers ============
function asaasBase(env: string) {
  return env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
}

async function findOrCreateAsaasCustomer(base: string, key: string, name: string, email: string, doc: string, phone?: string): Promise<string> {
  const cpfCnpj = (doc || '').replace(/\D/g, '');
  if (!cpfCnpj) throw new Error('CPF/CNPJ obrigatório');
  const r = await fetch(`${base}/customers?cpfCnpj=${cpfCnpj}`, { headers: { 'access_token': key } });
  const s = await r.json();
  if (s.data?.length > 0) return s.data[0].id;
  const cr = await fetch(`${base}/customers`, {
    method: 'POST',
    headers: { 'access_token': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || 'Cliente', email: email || '', cpfCnpj, phone: (phone || '').replace(/\D/g, '') || undefined }),
  });
  const c = await cr.json();
  if (c.errors) throw new Error(c.errors[0]?.description || 'Falha ao criar cliente');
  return c.id;
}

// ============ Installment date calc ============
function addDaysISO(date: Date, days: number): string {
  const d = new Date(date); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calcInstallments(start: string, end: string, cycle: string, weekday: number, monthday: number) {
  const startD = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  const dates: string[] = [];
  if (cycle === 'WEEKLY' || cycle === 'BIWEEKLY') {
    const step = cycle === 'WEEKLY' ? 7 : 14;
    const cur = new Date(startD);
    // Advance to next matching weekday
    while (cur.getDay() !== weekday) cur.setDate(cur.getDate() + 1);
    while (cur <= endD) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + step);
    }
  } else if (cycle === 'MONTHLY') {
    const cur = new Date(startD);
    cur.setDate(monthday || startD.getDate());
    if (cur < startD) cur.setMonth(cur.getMonth() + 1);
    while (cur <= endD) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return dates;
}

// ============ Placement / entity ============
function getEntityInfo(placement: string): { type: string; ownerTypeId: number } | null {
  if (placement === 'CRM_LEAD_DETAIL_TAB') return { type: 'lead', ownerTypeId: 1 };
  if (placement === 'CRM_DEAL_DETAIL_TAB') return { type: 'deal', ownerTypeId: 2 };
  if (placement.startsWith('CRM_DYNAMIC_') && placement.endsWith('_DETAIL_TAB')) {
    const typeId = placement.replace('CRM_DYNAMIC_', '').replace('_DETAIL_TAB', '');
    return { type: 'deal', ownerTypeId: parseInt(typeId) || 2 };
  }
  return null;
}

// ============ HTML helpers ============
function escHtml(v: any): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(v: any): string {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}
// JSON safe for inline <script>: escape '<' and line separators that break parsing
function safeJson(v: any): string {
  return JSON.stringify(v ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ============ HTML ============
function html(ctx: {
  entityType: string; entityId: string; ownerTypeId: number;
  transactions: any[]; subscriptions: any[]; invoices: any[]; splits: any[]; contractPlan: any | null;
  memberId: string; domain: string; accessToken: string;
  customer: any; dealFields: any;
}): string {
  const { transactions, subscriptions, invoices, splits, contractPlan, customer, dealFields } = ctx;
  const totalCharged = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalReceived = transactions.filter(t => ['confirmed', 'received'].includes(t.status)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalOpen = transactions.filter(t => ['pending', 'overdue'].includes(t.status)).reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const statusColors: Record<string, string> = { pending: '#f59e0b', confirmed: '#3b82f6', received: '#10b981', overdue: '#ef4444', refunded: '#8b5cf6', cancelled: '#6b7280' };
  const statusLabels: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', received: 'Recebido', overdue: 'Vencido', refunded: 'Reembolsado', cancelled: 'Cancelado', active: 'Ativa', inactive: 'Inativa', expired: 'Expirada' };
  const methodLabels: Record<string, string> = { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão', PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão' };

  const ICONS = {
    link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    refund: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    invoice: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  };

  const txRows = transactions.map(t => `
    <tr>
      <td>${escHtml(t.customer_name || '-')}</td>
      <td><b>R$ ${(Number(t.amount) || 0).toFixed(2).replace('.', ',')}</b></td>
      <td>${methodLabels[t.payment_method] || t.payment_method}</td>
      <td><span class="badge" style="background:${statusColors[t.status] || '#6b7280'}20;color:${statusColors[t.status] || '#6b7280'}">${statusLabels[t.status] || t.status}</span></td>
      <td>${t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}</td>
      <td class="actions">
        ${t.payment_url ? `<button class="ico" title="Copiar link" onclick="copyText('${escAttr(t.payment_url)}')">${ICONS.link}</button>` : ''}
        <button class="ico" title="Reenviar" onclick="rowAction('resend_notification','${escAttr(t.asaas_id)}')">${ICONS.mail}</button>
        <button class="ico" title="Cancelar" onclick="rowAction('cancel_charge','${escAttr(t.asaas_id)}')">${ICONS.x}</button>
        ${t.status === 'received' || t.status === 'confirmed' ? `<button class="ico" title="Reembolsar" onclick="rowAction('refund_charge','${escAttr(t.asaas_id)}')">${ICONS.refund}</button>` : ''}
        ${t.status === 'received' || t.status === 'confirmed' ? `<button class="ico" title="Emitir NFSe" onclick="rowAction('issue_invoice','${escAttr(t.id)}')">${ICONS.invoice}</button>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">Nenhuma cobrança vinculada.</td></tr>`;

  const subRows = subscriptions.map(s => `
    <tr>
      <td>${escHtml(s.customer_name || '-')}</td>
      <td><b>R$ ${(Number(s.value) || 0).toFixed(2).replace('.', ',')}</b></td>
      <td>${s.cycle || '-'}</td>
      <td>${s.next_due_date ? new Date(s.next_due_date).toLocaleDateString('pt-BR') : '-'}</td>
      <td><span class="badge">${statusLabels[s.status] || s.status}</span></td>
      <td class="actions">
        <button class="ico" title="Cancelar" onclick="rowAction('cancel_subscription','${escAttr(s.asaas_id)}')">${ICONS.x}</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">Nenhuma assinatura.</td></tr>`;

  const invRows = invoices.map(i => `
    <tr>
      <td>${escHtml(i.invoice_number || '-')}</td>
      <td>${escHtml(i.customer_name || '-')}</td>
      <td>R$ ${(Number(i.value) || 0).toFixed(2).replace('.', ',')}</td>
      <td><span class="badge">${i.status}</span></td>
      <td class="actions">
        ${i.invoice_url ? `<a class="ico" target="_blank" href="${escAttr(i.invoice_url)}">${ICONS.download}</a>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhuma NFSe.</td></tr>`;

  const splitRows = splits.map(s => `
    <tr>
      <td>${escHtml(s.name)}</td>
      <td>${escHtml(s.wallet_id)}</td>
      <td>${s.split_type === 'percentage' ? s.split_value + '%' : 'R$ ' + Number(s.split_value).toFixed(2)}</td>
      <td>${s.is_active ? ICONS.check : ICONS.pause}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">Nenhum split configurado.</td></tr>`;

  const planSummary = contractPlan ? `
    <div class="info-banner">
      <b>Plano atual:</b> Entrada R$ ${Number(contractPlan.entry_value).toFixed(2)} em ${contractPlan.entry_installments}x +
      recorrência ${contractPlan.cycle} de R$ ${Number(contractPlan.recurring_value).toFixed(2)}
      (${new Date(contractPlan.contract_start).toLocaleDateString('pt-BR')} → ${new Date(contractPlan.contract_end).toLocaleDateString('pt-BR')}).
      <span class="badge">${contractPlan.status}</span>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Asaas — CRM</title>
<script src="//api.bitrix24.com/api/v1/"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:16px;color:#1e293b;font-size:13px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.metric{background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.metric .lbl{font-size:11px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px}
.metric .val{font-size:20px;font-weight:700}
.tabs{display:flex;gap:4px;background:#fff;border-radius:10px;padding:4px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow-x:auto}
.tab{flex:1;min-width:110px;padding:10px 12px;border:0;background:transparent;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;color:#64748b;white-space:nowrap}
.tab.active{background:linear-gradient(135deg,#2FC6F6,#0066cc);color:#fff}
.panel{display:none;background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.panel.active{display:block}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px;background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.4px}
td{padding:10px;border-bottom:1px solid #f1f5f9}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#e2e8f0;color:#475569}
.empty{text-align:center;color:#94a3b8;padding:24px}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.head h3{font-size:15px}
.btn{background:linear-gradient(135deg,#2FC6F6,#0066cc);color:#fff;border:0;padding:9px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-sec{background:#f1f5f9;color:#475569;border:0;padding:9px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
.ico{background:transparent;border:0;cursor:pointer;font-size:14px;padding:2px 6px;text-decoration:none}
.actions{white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.fg{margin-bottom:10px}
.fg label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px}
.fg label .req{color:#ef4444}
.fg input,.fg select,.fg textarea{width:100%;padding:9px 11px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;font-family:inherit}
.fg input:focus,.fg select:focus{border-color:#0066cc;box-shadow:0 0 0 3px rgba(0,102,204,.1)}
.section{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px}
.section h4{font-size:13px;margin-bottom:10px;color:#0f172a;display:flex;align-items:center;gap:6px}
.info-banner{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:12px}
.msg{margin-top:10px;padding:10px;border-radius:8px;font-size:12px;display:none}
.msg.ok{display:block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.msg.err{display:block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;white-space:pre-wrap}
.preview-table th,.preview-table td{padding:6px 8px;font-size:12px}
@media(max-width:700px){.metrics{grid-template-columns:repeat(2,1fr)}.grid,.grid-3{grid-template-columns:1fr}}
</style></head>
<body>
<div class="metrics">
  <div class="metric"><div class="lbl">Cobrado</div><div class="val">R$ ${totalCharged.toFixed(2).replace('.', ',')}</div></div>
  <div class="metric"><div class="lbl">Recebido</div><div class="val" style="color:#10b981">R$ ${totalReceived.toFixed(2).replace('.', ',')}</div></div>
  <div class="metric"><div class="lbl">Em Aberto</div><div class="val" style="color:#f59e0b">R$ ${totalOpen.toFixed(2).replace('.', ',')}</div></div>
  <div class="metric"><div class="lbl">Qtd Cobranças</div><div class="val" style="color:#6366f1">${transactions.length}</div></div>
</div>

<div class="tabs">
  <button class="tab active" data-tab="charges">Cobranças</button>
  <button class="tab" data-tab="plan">Planejamento</button>
  <button class="tab" data-tab="subs">Assinaturas</button>
  <button class="tab" data-tab="nfse">NFSe</button>
  <button class="tab" data-tab="split">Split</button>
</div>

<!-- COBRANÇAS -->
<div class="panel active" id="panel-charges">
  <div class="head"><h3>Cobranças</h3><button class="btn" onclick="openChargeModal()">+ Nova Cobrança</button></div>
  <table><thead><tr><th>Cliente</th><th>Valor</th><th>Método</th><th>Status</th><th>Venc.</th><th>Ações</th></tr></thead><tbody>${txRows}</tbody></table>
</div>

<!-- PLANEJAMENTO -->
<div class="panel" id="panel-plan">
  ${planSummary}
  <form id="planForm" onsubmit="event.preventDefault();submitPlan()">
    <div class="section">
      <h4>1. Cliente</h4>
      <div class="grid">
        <div class="fg"><label>Nome <span class="req">*</span></label><input id="pl_name" required></div>
        <div class="fg"><label>Email <span class="req">*</span></label><input id="pl_email" type="email" required></div>
        <div class="fg"><label>CPF/CNPJ <span class="req">*</span></label><input id="pl_doc" required></div>
        <div class="fg"><label>Telefone</label><input id="pl_phone"></div>
      </div>
    </div>

    <div class="section">
      <h4>2. Contrato</h4>
      <div class="grid-3">
        <div class="fg"><label>Início <span class="req">*</span></label><input id="pl_start" type="date" required onchange="recalc()"></div>
        <div class="fg"><label>Fim <span class="req">*</span></label><input id="pl_end" type="date" required onchange="recalc()"></div>
        <div class="fg"><label>Forma de Pagamento <span class="req">*</span></label>
          <select id="pl_method" required>
            <option value="BOLETO">Boleto</option>
            <option value="PIX">PIX</option>
            <option value="CREDIT_CARD">Cartão</option>
          </select>
        </div>
      </div>
      <div class="fg"><label>Observação das parcelas</label><input id="pl_note"></div>
    </div>

    <div class="section">
      <h4>3. Entrada parcelada (opcional)</h4>
      <div class="grid-3">
        <div class="fg"><label>Valor da entrada (R$)</label><input id="pl_entry" type="number" step="0.01" min="0" value="0" onchange="recalc()"></div>
        <div class="fg"><label>Nº de parcelas</label>
          <select id="pl_entryN" onchange="recalc()">
            ${Array.from({length: 12}, (_, i) => `<option value="${i + 1}">${i + 1}x</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>1º vencimento da entrada</label><input id="pl_entryDue" type="date" onchange="recalc()"></div>
      </div>
    </div>

    <div class="section">
      <h4>4. Recorrência (saldo)</h4>
      <div class="grid-3">
        <div class="fg"><label>Valor recorrente (R$) <span class="req">*</span></label><input id="pl_recVal" type="number" step="0.01" min="0" required onchange="recalc()"></div>
        <div class="fg"><label>Ciclo <span class="req">*</span></label>
          <select id="pl_cycle" required onchange="recalc()">
            <option value="WEEKLY" selected>Semanal</option>
            <option value="BIWEEKLY">Quinzenal</option>
            <option value="MONTHLY">Mensal</option>
          </select>
        </div>
        <div class="fg"><label>Dia da semana / mês</label>
          <select id="pl_weekday" onchange="recalc()">
            <option value="0">Domingo</option><option value="1">Segunda</option><option value="2">Terça</option>
            <option value="3" selected>Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option>
          </select>
        </div>
      </div>
    </div>

    <div class="section">
      <h4>5. Pré-visualização do cronograma</h4>
      <table class="preview-table"><thead><tr><th>#</th><th>Tipo</th><th>Forma</th><th>Vencimento</th><th>Valor</th></tr></thead>
      <tbody id="pl_preview"><tr><td colspan="5" class="empty">Preencha os dados para gerar o cronograma.</td></tr></tbody></table>
    </div>

    <button class="btn" type="submit" id="pl_submit" style="width:100%;padding:12px">Enviar ao Asaas e Atualizar Negócio</button>
    <div class="msg" id="pl_msg"></div>
  </form>
</div>

<!-- ASSINATURAS -->
<div class="panel" id="panel-subs">
  <div class="head"><h3>Assinaturas</h3></div>
  <table><thead><tr><th>Cliente</th><th>Valor</th><th>Ciclo</th><th>Próx. Venc.</th><th>Status</th><th>Ações</th></tr></thead><tbody>${subRows}</tbody></table>
</div>

<!-- NFSe -->
<div class="panel" id="panel-nfse">
  <div class="head"><h3>Notas Fiscais (NFSe)</h3></div>
  <table><thead><tr><th>Nº</th><th>Cliente</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>${invRows}</tbody></table>
</div>

<!-- SPLIT -->
<div class="panel" id="panel-split">
  <div class="head"><h3>Configurações de Split</h3></div>
  <table><thead><tr><th>Nome</th><th>Wallet ID</th><th>Valor</th><th>Ativo</th></tr></thead><tbody>${splitRows}</tbody></table>
</div>

<!-- MODAL: NOVA COBRANÇA -->
<div id="chargeModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:14px;padding:22px;width:92%;max-width:480px;max-height:90vh;overflow-y:auto">
    <h3 style="margin-bottom:14px">Nova Cobrança</h3>
    <div class="grid">
      <div class="fg"><label>Valor <span class="req">*</span></label><input id="ch_amount" type="number" step="0.01" min="0.01" required></div>
      <div class="fg"><label>Método</label><select id="ch_method"><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="credit_card">Cartão</option></select></div>
      <div class="fg"><label>Vencimento <span class="req">*</span></label><input id="ch_due" type="date" required></div>
      <div class="fg"><label>Descrição</label><input id="ch_desc"></div>
    </div>
    <div class="fg"><label>Cliente <span class="req">*</span></label><input id="ch_name" required></div>
    <div class="grid">
      <div class="fg"><label>Email <span class="req">*</span></label><input id="ch_email" type="email" required></div>
      <div class="fg"><label>CPF/CNPJ <span class="req">*</span></label><input id="ch_doc" required></div>
    </div>
    <div class="grid-3">
      <div class="fg"><label>Juros (% mês)</label><input id="ch_int" type="number" step="0.01" value="0"></div>
      <div class="fg"><label>Multa (%)</label><input id="ch_fine" type="number" step="0.01" value="0"></div>
      <div class="fg"><label>Desconto (R$)</label><input id="ch_disc" type="number" step="0.01" value="0"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-sec" style="flex:1" onclick="closeChargeModal()">Cancelar</button>
      <button class="btn" style="flex:1" id="ch_submit" onclick="submitCharge()">Criar</button>
    </div>
    <div class="msg" id="ch_msg"></div>
  </div>
</div>

<script>
var CTX = {
  entityType: ${safeJson(ctx.entityType)},
  entityId: ${safeJson(ctx.entityId)},
  ownerTypeId: ${Number(ctx.ownerTypeId) || 2},
  memberId: ${safeJson(ctx.memberId)},
  domain: ${safeJson(ctx.domain)},
  accessToken: ${safeJson(ctx.accessToken)},
  supabaseUrl: ${safeJson(SUPABASE_URL)},
  customer: ${safeJson(customer)},
  dealFields: ${safeJson(dealFields)},
  contractPlan: ${safeJson(contractPlan)},
};

// Tab navigation
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){
    document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
    document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active')});
    t.classList.add('active');
    document.getElementById('panel-' + t.dataset.tab).classList.add('active');
  });
});

// Prefill plan from customer + deal custom fields
function prefillPlan(){
  var c = CTX.customer || {}, d = CTX.dealFields || {}, p = CTX.contractPlan;
  document.getElementById('pl_name').value = (p && p.customer_name) || c.name || '';
  document.getElementById('pl_email').value = (p && p.customer_email) || c.email || '';
  document.getElementById('pl_doc').value = (p && p.customer_document) || c.document || '';
  document.getElementById('pl_phone').value = c.phone || '';
  document.getElementById('pl_start').value = (p && p.contract_start) || d.UF_CRM_ASAAS_CONTRACT_START || '';
  document.getElementById('pl_end').value = (p && p.contract_end) || d.UF_CRM_ASAAS_CONTRACT_END || '';
  if (p) {
    document.getElementById('pl_method').value = p.payment_method || 'BOLETO';
    document.getElementById('pl_entry').value = p.entry_value || 0;
    document.getElementById('pl_entryN').value = p.entry_installments || 1;
    document.getElementById('pl_entryDue').value = p.entry_first_due || '';
    document.getElementById('pl_recVal').value = p.recurring_value || 0;
    document.getElementById('pl_cycle').value = p.cycle || 'WEEKLY';
    if (p.weekday != null) document.getElementById('pl_weekday').value = p.weekday;
  } else if (d.UF_CRM_ASAAS_PAYMENT_METHOD) {
    document.getElementById('pl_method').value = d.UF_CRM_ASAAS_PAYMENT_METHOD;
    document.getElementById('pl_entry').value = d.UF_CRM_ASAAS_ENTRY_VALUE || 0;
    document.getElementById('pl_entryN').value = d.UF_CRM_ASAAS_ENTRY_INSTALLMENTS || 1;
    document.getElementById('pl_recVal').value = d.UF_CRM_ASAAS_RECURRING_VALUE || 0;
    if (d.UF_CRM_ASAAS_CYCLE) document.getElementById('pl_cycle').value = d.UF_CRM_ASAAS_CYCLE;
    if (d.UF_CRM_ASAAS_WEEKDAY != null) document.getElementById('pl_weekday').value = d.UF_CRM_ASAAS_WEEKDAY;
  }
  recalc();
}

function recalc(){
  var entry = parseFloat(document.getElementById('pl_entry').value) || 0;
  var entryN = parseInt(document.getElementById('pl_entryN').value) || 1;
  var entryDue = document.getElementById('pl_entryDue').value;
  var start = document.getElementById('pl_start').value;
  var end = document.getElementById('pl_end').value;
  var cycle = document.getElementById('pl_cycle').value;
  var weekday = parseInt(document.getElementById('pl_weekday').value);
  var recVal = parseFloat(document.getElementById('pl_recVal').value) || 0;
  var method = document.getElementById('pl_method').value;
  var rows = [];
  // Entry installments
  if (entry > 0 && entryN > 0 && entryDue) {
    var per = Math.round((entry / entryN) * 100) / 100;
    var d0 = new Date(entryDue + 'T12:00:00');
    for (var i = 0; i < entryN; i++) {
      var d = new Date(d0); d.setDate(d.getDate() + i * 30);
      var val = (i === entryN - 1) ? (entry - per * (entryN - 1)) : per;
      rows.push({n: i+1, type: 'Entrada', method: method, due: d.toISOString().split('T')[0], val: val});
    }
  }
  // Recurring
  if (recVal > 0 && start && end) {
    var dates = calcDates(start, end, cycle, weekday);
    for (var j = 0; j < dates.length; j++) {
      rows.push({n: (rows.length + 1), type: 'Recorrente', method: method, due: dates[j], val: recVal});
    }
  }
  var tbody = document.getElementById('pl_preview');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Preencha os dados para gerar o cronograma.</td></tr>'; return; }
  tbody.innerHTML = rows.map(function(r){
    return '<tr><td>'+r.n+'</td><td>'+r.type+'</td><td>'+r.method+'</td><td>'+new Date(r.due).toLocaleDateString('pt-BR')+'</td><td>R$ '+r.val.toFixed(2).replace('.',',')+'</td></tr>';
  }).join('');
}

function calcDates(start, end, cycle, weekday){
  var sD = new Date(start+'T12:00:00'), eD = new Date(end+'T12:00:00'), arr = [];
  if (cycle === 'WEEKLY' || cycle === 'BIWEEKLY') {
    var step = cycle === 'WEEKLY' ? 7 : 14;
    var c = new Date(sD); while (c.getDay() !== weekday) c.setDate(c.getDate()+1);
    while (c <= eD) { arr.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+step); }
  } else {
    var c = new Date(sD);
    while (c <= eD) { arr.push(c.toISOString().split('T')[0]); c.setMonth(c.getMonth()+1); }
  }
  return arr;
}

async function submitPlan(){
  var btn = document.getElementById('pl_submit'), msg = document.getElementById('pl_msg');
  msg.className = 'msg'; msg.textContent = '';
  btn.disabled = true; btn.textContent = 'Enviando ao Asaas...';
  try {
    var payload = ctxPayload({
      action: 'submit_contract_plan',
      name: val('pl_name'), email: val('pl_email'), doc: val('pl_doc'), phone: val('pl_phone'),
      start: val('pl_start'), end: val('pl_end'),
      method: val('pl_method'), note: val('pl_note'),
      entry: parseFloat(val('pl_entry')) || 0, entryN: parseInt(val('pl_entryN')) || 1, entryDue: val('pl_entryDue'),
      recVal: parseFloat(val('pl_recVal')) || 0, cycle: val('pl_cycle'), weekday: parseInt(val('pl_weekday')),
    });
    var r = await fetch(CTX.supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
    });
    var data = await r.json();
    if (data.success) {
      msg.className = 'msg ok'; msg.textContent = '✅ Planejamento enviado! ' + (data.summary || '');
      setTimeout(function(){ location.reload(); }, 1800);
    } else {
      msg.className = 'msg err'; msg.textContent = '❌ ' + (data.error || 'Falha ao enviar') + (data.detail ? '\n' + JSON.stringify(data.detail, null, 2) : '');
    }
  } catch (e) {
    msg.className = 'msg err'; msg.textContent = '❌ ' + e.message;
  }
  btn.disabled = false; btn.textContent = 'Enviar ao Asaas e Atualizar Negócio';
}

function val(id){ return document.getElementById(id).value; }
function ctxPayload(extra){ return Object.assign({}, {entityType: CTX.entityType, entityId: CTX.entityId, ownerTypeId: CTX.ownerTypeId, memberId: CTX.memberId, domain: CTX.domain, accessToken: CTX.accessToken}, extra); }

function openChargeModal(){
  document.getElementById('ch_name').value = CTX.customer.name || '';
  document.getElementById('ch_email').value = CTX.customer.email || '';
  document.getElementById('ch_doc').value = CTX.customer.document || '';
  var due = new Date(); due.setDate(due.getDate()+3);
  document.getElementById('ch_due').value = due.toISOString().split('T')[0];
  document.getElementById('chargeModal').style.display = 'flex';
}
function closeChargeModal(){ document.getElementById('chargeModal').style.display = 'none'; }

async function submitCharge(){
  var btn = document.getElementById('ch_submit'), msg = document.getElementById('ch_msg');
  msg.className='msg'; btn.disabled=true; btn.textContent='Criando...';
  try {
    var payload = ctxPayload({
      action: 'create_charge',
      amount: val('ch_amount'), paymentMethod: val('ch_method'), dueDate: val('ch_due'),
      description: val('ch_desc'),
      customerName: val('ch_name'), customerEmail: val('ch_email'), customerDocument: val('ch_doc'),
      interest: parseFloat(val('ch_int'))||0, fine: parseFloat(val('ch_fine'))||0, discount: parseFloat(val('ch_disc'))||0,
    });
    var r = await fetch(CTX.supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload),
    });
    var d = await r.json();
    if (d.success) { msg.className='msg ok'; msg.textContent='✅ Cobrança criada!'; setTimeout(function(){location.reload()}, 1200); }
    else { msg.className='msg err'; msg.textContent='❌ ' + (d.error||'Erro'); }
  } catch(e){ msg.className='msg err'; msg.textContent='❌ '+e.message; }
  btn.disabled=false; btn.textContent='Criar';
}

async function rowAction(action, id){
  if (!confirm('Confirmar ação: ' + action + '?')) return;
  try {
    var r = await fetch(CTX.supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(ctxPayload({action: action, targetId: id})),
    });
    var d = await r.json();
    if (d.success) location.reload(); else alert('Erro: ' + (d.error||'desconhecido'));
  } catch(e){ alert('Erro: ' + e.message); }
}

function copyText(t){ navigator.clipboard.writeText(t).then(function(){alert('Link copiado!')}); }

prefillPlan();
</script>
</body></html>`;
}

// ============ Server ============
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const memberId = url.searchParams.get('member_id') || '';
      if (memberId === 'preview_mode') {
        const domain = url.searchParams.get('DOMAIN') || 'preview.bitrix24.com';
        const placement = url.searchParams.get('PLACEMENT') || 'CRM_DEAL_DETAIL_TAB';
        const entityId = url.searchParams.get('entity_id') || '123';
        const ei = getEntityInfo(placement);
        const h = html({
          entityType: ei?.type || 'deal', entityId, ownerTypeId: ei?.ownerTypeId || 2,
          transactions: [], subscriptions: [], invoices: [], splits: [], contractPlan: null,
          memberId, domain, accessToken: 'preview_token',
          customer: { name: 'João Silva', email: 'joao@ex.com', document: '', phone: '' }, dealFields: {},
        });
        return new Response(h, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response('<html><body>OK</body></html>', { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }

    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ===== JSON actions =====
    if (contentType.includes('application/json')) {
      const j = JSON.parse(bodyText);
      const action = j.action;
      const { data: installation } = await supabase
        .from('bitrix_installations').select('id, tenant_id, client_endpoint, domain')
        .eq('member_id', j.memberId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (!installation?.tenant_id) return json({ success: false, error: 'Instalação não encontrada' });

      const { data: cfg } = await supabase.from('asaas_configurations').select('api_key, environment').eq('tenant_id', installation.tenant_id).eq('is_active', true).maybeSingle();
      if (!cfg?.api_key) return json({ success: false, error: 'Asaas não configurado' });
      const base = asaasBase(cfg.environment);
      const clientEndpoint = installation.client_endpoint || (installation.domain ? `https://${installation.domain}/rest/` : null);

      // -------- create_charge --------
      if (action === 'create_charge') {
        try {
          const amount = parseFloat(j.amount);
          if (!amount || amount <= 0) return json({ success: false, error: 'Valor inválido' });
          const customerId = await findOrCreateAsaasCustomer(base, cfg.api_key, j.customerName, j.customerEmail, j.customerDocument);
          const billingMap: Record<string, string> = { pix: 'PIX', boleto: 'BOLETO', credit_card: 'CREDIT_CARD' };
          const body: any = {
            customer: customerId,
            billingType: billingMap[j.paymentMethod] || 'PIX',
            value: amount,
            dueDate: j.dueDate || addDaysISO(new Date(), 3),
            description: j.description || `Cobrança ${j.entityType} #${j.entityId}`,
            externalReference: `bitrix_${j.entityType}_${j.entityId}`,
          };
          if (j.interest > 0) body.interest = { value: j.interest };
          if (j.fine > 0) body.fine = { value: j.fine };
          if (j.discount > 0) body.discount = { value: j.discount, dueDateLimitDays: 0 };
          const r = await fetch(`${base}/payments`, { method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const p = await r.json();
          if (p.errors) return json({ success: false, error: p.errors[0]?.description });

          await supabase.from('transactions').insert({
            tenant_id: installation.tenant_id, asaas_id: p.id, amount,
            payment_method: j.paymentMethod || 'pix', status: 'pending',
            customer_name: j.customerName, customer_email: j.customerEmail, customer_document: j.customerDocument,
            due_date: p.dueDate, payment_url: p.invoiceUrl,
            bitrix_entity_type: j.entityType === 'lead' ? 'lead' : 'deal', bitrix_entity_id: j.entityId,
          });
          if (clientEndpoint && j.accessToken) {
            await addTimelineComment(clientEndpoint, j.accessToken, j.entityType, j.entityId, `✅ Cobrança Asaas criada: R$ ${amount.toFixed(2)} — ${p.invoiceUrl || p.id}`);
          }
          return json({ success: true, paymentUrl: p.invoiceUrl });
        } catch (e: any) { return json({ success: false, error: e.message }); }
      }

      // -------- cancel/refund/resend/cancel_subscription --------
      if (action === 'cancel_charge') {
        const r = await fetch(`${base}/payments/${j.targetId}`, { method: 'DELETE', headers: { 'access_token': cfg.api_key } });
        const d = await r.json();
        if (d.deleted || d.id) { await supabase.from('transactions').update({ status: 'cancelled' }).eq('asaas_id', j.targetId); return json({ success: true }); }
        return json({ success: false, error: d.errors?.[0]?.description || 'Falha' });
      }
      if (action === 'refund_charge') {
        const r = await fetch(`${base}/payments/${j.targetId}/refund`, { method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' }, body: '{}' });
        const d = await r.json();
        if (d.id) { await supabase.from('transactions').update({ status: 'refunded' }).eq('asaas_id', j.targetId); return json({ success: true }); }
        return json({ success: false, error: d.errors?.[0]?.description || 'Falha' });
      }
      if (action === 'resend_notification') {
        const r = await fetch(`${base}/payments/${j.targetId}/notifications`, { headers: { 'access_token': cfg.api_key } });
        await r.json();
        return json({ success: true });
      }
      if (action === 'cancel_subscription') {
        const r = await fetch(`${base}/subscriptions/${j.targetId}`, { method: 'DELETE', headers: { 'access_token': cfg.api_key } });
        const d = await r.json();
        if (d.deleted || d.id) { await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('asaas_id', j.targetId); return json({ success: true }); }
        return json({ success: false, error: d.errors?.[0]?.description || 'Falha' });
      }

      // -------- issue_invoice (proxy) --------
      if (action === 'issue_invoice') {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/asaas-invoice-process`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ transaction_id: j.targetId, tenant_id: installation.tenant_id }),
          });
          const d = await r.json();
          return json({ success: r.ok, ...d });
        } catch (e: any) { return json({ success: false, error: e.message }); }
      }

      // -------- submit_contract_plan --------
      if (action === 'submit_contract_plan') {
        const errors: string[] = [];
        if (!j.name) errors.push('Nome do cliente');
        if (!j.email) errors.push('Email');
        if (!j.doc) errors.push('CPF/CNPJ');
        if (!j.start) errors.push('Data início');
        if (!j.end) errors.push('Data fim');
        if (!j.method) errors.push('Forma de pagamento');
        if (!j.recVal || j.recVal <= 0) errors.push('Valor recorrente');
        if (j.entry > 0 && !j.entryDue) errors.push('Vencimento da entrada');
        if (errors.length) return json({ success: false, error: 'Campos obrigatórios: ' + errors.join(', ') });

        // Ensure custom fields exist
        if (clientEndpoint && j.accessToken && j.entityType === 'deal') {
          await ensureCustomFields(supabase, installation.id, clientEndpoint, j.accessToken);
        }

        const createdCharges: string[] = [];
        const issuesArr: string[] = [];
        let subscriptionId: string | null = null;

        try {
          const customerId = await findOrCreateAsaasCustomer(base, cfg.api_key, j.name, j.email, j.doc, j.phone);
          const billingType = j.method;

          // Entry installments
          if (j.entry > 0 && j.entryN > 0 && j.entryDue) {
            const per = Math.round((j.entry / j.entryN) * 100) / 100;
            const d0 = new Date(j.entryDue + 'T12:00:00');
            for (let i = 0; i < j.entryN; i++) {
              const d = new Date(d0); d.setDate(d.getDate() + i * 30);
              const v = i === j.entryN - 1 ? Number((j.entry - per * (j.entryN - 1)).toFixed(2)) : per;
              const r = await fetch(`${base}/payments`, {
                method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer: customerId, billingType, value: v, dueDate: d.toISOString().split('T')[0],
                  description: `Entrada ${i + 1}/${j.entryN} — ${j.note || j.entityType + ' #' + j.entityId}`,
                  externalReference: `bitrix_${j.entityType}_${j.entityId}_entry_${i + 1}`,
                }),
              });
              const p = await r.json();
              if (p.errors) { issuesArr.push(`Entrada ${i + 1}: ${p.errors[0]?.description}`); continue; }
              createdCharges.push(p.id);
              await supabase.from('transactions').insert({
                tenant_id: installation.tenant_id, asaas_id: p.id, amount: v,
                payment_method: billingType.toLowerCase() === 'credit_card' ? 'credit_card' : billingType.toLowerCase(),
                status: 'pending', customer_name: j.name, customer_email: j.email, customer_document: j.doc,
                due_date: p.dueDate, payment_url: p.invoiceUrl,
                bitrix_entity_type: j.entityType === 'lead' ? 'lead' : 'deal', bitrix_entity_id: j.entityId,
              });
            }
          }

          // Recurring subscription
          if (j.recVal > 0) {
            const dates = calcInstallments(j.start, j.end, j.cycle, j.weekday, new Date(j.start).getDate());
            if (dates.length) {
              const r = await fetch(`${base}/subscriptions`, {
                method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer: customerId, billingType, value: j.recVal,
                  nextDueDate: dates[0], cycle: j.cycle, endDate: j.end,
                  description: `Recorrência ${j.cycle} — ${j.note || j.entityType + ' #' + j.entityId}`,
                  externalReference: `bitrix_${j.entityType}_${j.entityId}_sub`,
                }),
              });
              const s = await r.json();
              if (s.errors) issuesArr.push(`Recorrência: ${s.errors[0]?.description}`);
              else {
                subscriptionId = s.id;
                await supabase.from('subscriptions').insert({
                  tenant_id: installation.tenant_id, asaas_id: s.id, customer_id: customerId,
                  customer_name: j.name, customer_email: j.email, customer_document: j.doc,
                  value: j.recVal, billing_type: billingType.toLowerCase() === 'credit_card' ? 'credit_card' : billingType.toLowerCase(),
                  cycle: j.cycle.toLowerCase(), description: j.note || '', next_due_date: dates[0], status: 'active',
                  bitrix_entity_type: j.entityType === 'lead' ? 'lead' : 'deal', bitrix_entity_id: j.entityId,
                });
              }
            }
          }

          // Persist plan
          await supabase.from('contract_plans').insert({
            tenant_id: installation.tenant_id, bitrix_entity_type: j.entityType, bitrix_entity_id: j.entityId,
            customer_name: j.name, customer_email: j.email, customer_document: j.doc,
            contract_start: j.start, contract_end: j.end, payment_method: j.method,
            entry_value: j.entry || 0, entry_installments: j.entryN || 0, entry_first_due: j.entryDue || null,
            recurring_value: j.recVal, cycle: j.cycle, weekday: j.weekday,
            asaas_subscription_id: subscriptionId,
            status: issuesArr.length ? 'partial' : 'success',
            error_message: issuesArr.join('\n') || null,
          });

          // Update Deal custom fields
          if (clientEndpoint && j.accessToken && j.entityType === 'deal') {
            await callBitrixApi(clientEndpoint, 'crm.deal.update', {
              id: parseInt(j.entityId),
              fields: {
                UF_CRM_ASAAS_CONTRACT_START: j.start,
                UF_CRM_ASAAS_CONTRACT_END: j.end,
                UF_CRM_ASAAS_ENTRY_VALUE: j.entry || 0,
                UF_CRM_ASAAS_ENTRY_INSTALLMENTS: j.entryN || 0,
                UF_CRM_ASAAS_RECURRING_VALUE: j.recVal,
                UF_CRM_ASAAS_CYCLE: j.cycle,
                UF_CRM_ASAAS_WEEKDAY: j.weekday,
                UF_CRM_ASAAS_PAYMENT_METHOD: j.method,
              },
            }, j.accessToken);
          }

          // Timeline comment
          if (clientEndpoint && j.accessToken) {
            if (issuesArr.length) {
              await addTimelineComment(clientEndpoint, j.accessToken, j.entityType, j.entityId,
                `⚠️ Planejamento Asaas enviado com avisos:\n${issuesArr.join('\n')}\n\nCobranças criadas: ${createdCharges.length}`);
            } else {
              const summary = `entrada R$ ${(j.entry || 0).toFixed(2)} em ${j.entryN || 0}x + recorrência ${j.cycle} de R$ ${j.recVal.toFixed(2)} até ${j.end}`;
              await addTimelineComment(clientEndpoint, j.accessToken, j.entityType, j.entityId,
                `✅ Planejamento Asaas enviado com sucesso: ${summary}. Cobranças: ${createdCharges.length}${subscriptionId ? ` | Assinatura: ${subscriptionId}` : ''}`);
            }
          }

          return json({
            success: true,
            summary: `${createdCharges.length} cobrança(s) + ${subscriptionId ? '1 assinatura' : 'sem recorrência'}`,
            issues: issuesArr,
          });
        } catch (e: any) {
          if (clientEndpoint && j.accessToken) {
            await addTimelineComment(clientEndpoint, j.accessToken, j.entityType, j.entityId, `❌ Erro no envio Asaas: ${e.message}`);
          }
          return json({ success: false, error: e.message });
        }
      }

      return json({ success: false, error: 'Ação desconhecida: ' + action });
    }

    // ===== Bitrix placement (form-urlencoded) =====
    const params = new URLSearchParams(bodyText);
    const placement = params.get('PLACEMENT') || '';
    const memberId = params.get('member_id') || params.get('MEMBER_ID') || params.get('auth[member_id]') || '';
    const domain = params.get('DOMAIN') || params.get('domain') || params.get('auth[domain]') || '';
    const accessToken = params.get('AUTH_ID') || params.get('auth[access_token]') || '';

    let entityId = '';
    const po = params.get('PLACEMENT_OPTIONS');
    if (po) { try { const o = JSON.parse(po); entityId = o.ID || o.id || ''; } catch {} }

    const ei = getEntityInfo(placement);
    if (!ei) return new Response('<html><body>Placement não reconhecido</body></html>', { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });

    const { data: installation } = await supabase
      .from('bitrix_installations').select('id, tenant_id, client_endpoint, domain')
      .eq('member_id', memberId).order('updated_at', { ascending: false }).limit(1).maybeSingle();

    if (!installation?.tenant_id) {
      return new Response(html({
        entityType: ei.type, entityId, ownerTypeId: ei.ownerTypeId,
        transactions: [], subscriptions: [], invoices: [], splits: [], contractPlan: null,
        memberId, domain, accessToken, customer: {}, dealFields: {},
      }), { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const clientEndpoint = installation.client_endpoint || (installation.domain ? `https://${installation.domain}/rest/` : null);

    // Fire-and-await custom fields (idempotent) + customer + deal fields in parallel
    const [_, customer, dealFields, txRes, subRes, invRes, splitRes, planRes] = await Promise.all([
      (clientEndpoint && accessToken && ei.type === 'deal') ? ensureCustomFields(supabase, installation.id, clientEndpoint, accessToken).catch(() => null) : Promise.resolve(null),
      (clientEndpoint && accessToken) ? getCrmCustomer(clientEndpoint, accessToken, ei.type, entityId) : Promise.resolve({}),
      (clientEndpoint && accessToken && ei.type === 'deal') ? getDealFields(clientEndpoint, accessToken, ei.type, entityId) : Promise.resolve({}),
      supabase.from('transactions').select('*').eq('tenant_id', installation.tenant_id).eq('bitrix_entity_type', ei.type).eq('bitrix_entity_id', entityId).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('tenant_id', installation.tenant_id).eq('bitrix_entity_type', ei.type).eq('bitrix_entity_id', entityId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('tenant_id', installation.tenant_id).eq('bitrix_entity_type', ei.type).eq('bitrix_entity_id', entityId).order('created_at', { ascending: false }),
      supabase.from('split_configurations').select('*').eq('tenant_id', installation.tenant_id).eq('is_active', true),
      supabase.from('contract_plans').select('*').eq('tenant_id', installation.tenant_id).eq('bitrix_entity_type', ei.type).eq('bitrix_entity_id', entityId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    return new Response(html({
      entityType: ei.type, entityId, ownerTypeId: ei.ownerTypeId,
      transactions: txRes.data || [], subscriptions: subRes.data || [], invoices: invRes.data || [], splits: splitRes.data || [],
      contractPlan: planRes.data || null,
      memberId, domain, accessToken, customer, dealFields,
    }), { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRM Detail Tab] Error:', error);
    return new Response(`<html><body><h1>Erro</h1><p>${msg}</p></body></html>`, {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});

function json(o: any) {
  return new Response(JSON.stringify(o), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
