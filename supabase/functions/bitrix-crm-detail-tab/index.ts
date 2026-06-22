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

async function ensureCustomFields(supabase: any, installationId: string, clientEndpoint: string, token: string) {
  const { data: inst } = await supabase.from('bitrix_installations').select('custom_fields_created').eq('id', installationId).maybeSingle();
  if (inst?.custom_fields_created) return;
  const fields = [
    { FIELD_NAME: 'UF_CRM_ASAAS_CONTRACT_START', USER_TYPE_ID: 'date', EDIT_FORM_LABEL: { br: 'Início do Contrato' }, LIST_COLUMN_LABEL: { br: 'Início do Contrato' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_CONTRACT_END', USER_TYPE_ID: 'date', EDIT_FORM_LABEL: { br: 'Fim do Contrato' }, LIST_COLUMN_LABEL: { br: 'Fim do Contrato' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_ENTRY_VALUE', USER_TYPE_ID: 'double', EDIT_FORM_LABEL: { br: 'Valor da Entrada' }, LIST_COLUMN_LABEL: { br: 'Valor da Entrada' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_ENTRY_INSTALLMENTS', USER_TYPE_ID: 'integer', EDIT_FORM_LABEL: { br: 'Parcelas da Entrada' }, LIST_COLUMN_LABEL: { br: 'Parcelas da Entrada' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_RECURRING_VALUE', USER_TYPE_ID: 'double', EDIT_FORM_LABEL: { br: 'Valor Recorrente' }, LIST_COLUMN_LABEL: { br: 'Valor Recorrente' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_CYCLE', USER_TYPE_ID: 'string', EDIT_FORM_LABEL: { br: 'Ciclo' }, LIST_COLUMN_LABEL: { br: 'Ciclo' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_WEEKDAY', USER_TYPE_ID: 'integer', EDIT_FORM_LABEL: { br: 'Dia da Semana' }, LIST_COLUMN_LABEL: { br: 'Dia da Semana' } },
    { FIELD_NAME: 'UF_CRM_ASAAS_PAYMENT_METHOD', USER_TYPE_ID: 'string', EDIT_FORM_LABEL: { br: 'Forma de Pagamento' }, LIST_COLUMN_LABEL: { br: 'Forma de Pagamento' } },
  ];
  for (const f of fields) {
    try { await callBitrixApi(clientEndpoint, 'crm.deal.userfield.add', { fields: f }, token); }
    catch (e) { console.log('[Custom fields] skip', f.FIELD_NAME, e); }
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

async function getDealProducts(clientEndpoint: string, token: string, entityType: string, entityId: string): Promise<{ rows: any[]; total: number }> {
  if (entityType !== 'deal') return { rows: [], total: 0 };
  try {
    const r = await callBitrixApi(clientEndpoint, 'crm.deal.productrows.get', { id: parseInt(entityId) }, token);
    const rows = r.result || [];
    const total = rows.reduce((s: number, p: any) => s + (Number(p.PRICE) || 0) * (Number(p.QUANTITY) || 0), 0);
    return { rows, total };
  } catch { return { rows: [], total: 0 }; }
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

function addDaysISO(date: Date, days: number): string {
  const d = new Date(date); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Server-side schedule generator. Returns ISO dates list.
function generateSchedule(startISO: string, cycle: string, weekday: number, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startISO + 'T12:00:00');
  if (cycle === 'WEEKLY' || cycle === 'BIWEEKLY') {
    const step = cycle === 'WEEKLY' ? 7 : 14;
    const cur = new Date(start);
    while (cur.getDay() !== weekday) cur.setDate(cur.getDate() + 1);
    for (let i = 0; i < count; i++) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + step);
    }
  } else { // MONTHLY
    const cur = new Date(start);
    for (let i = 0; i < count; i++) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return dates;
}

function countOccurrences(startISO: string, endISO: string, cycle: string, weekday: number): number {
  const start = new Date(startISO + 'T12:00:00');
  const end = new Date(endISO + 'T12:00:00');
  if (cycle === 'WEEKLY' || cycle === 'BIWEEKLY') {
    const step = cycle === 'WEEKLY' ? 7 : 14;
    const cur = new Date(start);
    while (cur.getDay() !== weekday) cur.setDate(cur.getDate() + 1);
    let n = 0;
    while (cur <= end) { n++; cur.setDate(cur.getDate() + step); }
    return n;
  }
  // MONTHLY
  const cur = new Date(start);
  let n = 0;
  while (cur <= end) { n++; cur.setMonth(cur.getMonth() + 1); }
  return n;
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
function safeJson(v: any): string {
  return JSON.stringify(v ?? null)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// ============ HTML ============
function html(ctx: {
  entityType: string; entityId: string; ownerTypeId: number;
  transactions: any[]; subscriptions: any[]; invoices: any[]; splits: any[]; contractPlan: any | null;
  memberId: string; domain: string; accessToken: string;
  customer: any; dealFields: any; dealProducts: { rows: any[]; total: number };
  templates: any[]; contracts: any[];
}): string {
  const { transactions, subscriptions, invoices, splits, contractPlan, customer, dealFields, dealProducts, templates, contracts } = ctx;
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
    contract: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 7 19 7"/><path d="M9 15l2 2 4-5"/></svg>',
    charges: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    subs: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    nfse: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M9 18h3"/></svg>',
    split: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="12" cy="6" r="3"/><path d="M12 9v3l-4 3"/><path d="M12 12l4 3"/></svg>',
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
    <div class="card">
      <div class="card-row"><b>Cliente:</b> ${escHtml(contractPlan.customer_name)} (${escHtml(contractPlan.customer_email)})</div>
      <div class="card-row"><b>CPF/CNPJ:</b> ${escHtml(contractPlan.customer_document)}</div>
      <div class="card-row"><b>Valor total contrato:</b> R$ ${Number((contractPlan.entry_value||0) + (contractPlan.recurring_value||0) * 1).toFixed(2)}</div>
      <div class="card-row"><b>Entrada:</b> R$ ${Number(contractPlan.entry_value||0).toFixed(2)} em ${contractPlan.entry_installments || 1}x</div>
      <div class="card-row"><b>Recorrência:</b> ${contractPlan.cycle} de R$ ${Number(contractPlan.recurring_value||0).toFixed(2)}</div>
      <div class="card-row"><b>Período:</b> ${new Date(contractPlan.contract_start).toLocaleDateString('pt-BR')} → ${contractPlan.contract_end ? new Date(contractPlan.contract_end).toLocaleDateString('pt-BR') : '—'}</div>
      <div class="card-row"><b>Forma de pagamento:</b> ${methodLabels[contractPlan.payment_method] || contractPlan.payment_method}</div>
      <div class="card-row"><b>Status:</b> <span class="badge">${contractPlan.status || 'success'}</span></div>
      ${contractPlan.error_message ? `<div class="card-row" style="color:#991b1b"><b>Avisos:</b> ${escHtml(contractPlan.error_message)}</div>` : ''}
    </div>` : `<div class="info-banner">Nenhum contrato planejado ainda. Clique em <b>Nova Cobrança</b> para criar o cronograma de cobranças e/ou assinatura.</div>`;

  const productRowsHtml = (dealProducts.rows || []).map((p: any) => `
    <tr>
      <td>${escHtml(p.PRODUCT_NAME || p.NAME || '-')}</td>
      <td style="text-align:right">${Number(p.QUANTITY || 0)}</td>
      <td style="text-align:right">R$ ${(Number(p.PRICE) || 0).toFixed(2).replace('.', ',')}</td>
      <td style="text-align:right"><b>R$ ${((Number(p.PRICE)||0) * (Number(p.QUANTITY)||0)).toFixed(2).replace('.', ',')}</b></td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">Nenhum produto no negócio.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Asaas — CRM</title>
<script src="//api.bitrix24.com/api/v1/"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;min-height:100vh}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:16px;color:#1e293b;font-size:13px;overflow-x:hidden}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.metric{background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.metric .lbl{font-size:11px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px}
.metric .val{font-size:20px;font-weight:700}
.tabs{display:flex;gap:4px;background:#fff;border-radius:10px;padding:4px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow-x:auto}
.tab{flex:1;min-width:120px;padding:10px 12px;border:0;background:transparent;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;color:#64748b;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px}
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
.btn{background:linear-gradient(135deg,#2FC6F6,#0066cc);color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-sec{background:#f1f5f9;color:#475569;border:0;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.ico{background:transparent;border:0;cursor:pointer;padding:4px 6px;display:inline-flex;align-items:center;justify-content:center;color:#475569;text-decoration:none}
.ico:hover{color:#0066cc;background:#f1f5f9;border-radius:6px}
.actions{white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.fg{margin-bottom:12px}
.fg label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:5px}
.fg label .req{color:#ef4444}
.fg input,.fg select,.fg textarea{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;font-family:inherit}
.fg input:focus,.fg select:focus{border-color:#0066cc;box-shadow:0 0 0 3px rgba(0,102,204,.1)}
.fg input[readonly]{background:#f8fafc;color:#475569}
.section{border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px}
.section h4{font-size:15px;margin-bottom:12px;color:#0f172a;display:flex;align-items:center;gap:7px}
.section h4 .num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#2FC6F6,#0066cc);color:#fff;font-size:13px;font-weight:700}
.info-banner{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:12px}
.msg{margin-top:10px;padding:10px;border-radius:8px;font-size:12px;display:none}
.msg.ok{display:block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.msg.err{display:block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;white-space:pre-wrap}
.preview-table th,.preview-table td{padding:8px 10px;font-size:13px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px}
.card-row{padding:4px 0;font-size:13px}
.radio-row{display:flex;gap:10px;flex-wrap:wrap}
.radio-pill{flex:1;min-width:120px;border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 14px;cursor:pointer;font-size:13px;font-weight:600;color:#475569;text-align:center;background:#fff;transition:.15s}
.radio-pill.active{border-color:#0066cc;background:#eff6ff;color:#0066cc}
.modal{display:none;position:fixed;inset:0;width:100vw;height:100vh;background:rgba(15,23,42,.55);z-index:1000;align-items:flex-start;justify-content:center;padding:12px;overflow-y:auto}
.modal.open{display:flex}
.modal-box{background:#fff;border-radius:14px;padding:28px;width:95vw;max-width:1100px;margin:auto;max-height:94vh;overflow-y:auto;font-size:14px}
.modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.modal-head h3{font-size:20px}
.summary-line{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px dashed #e2e8f0}
.summary-line:last-child{border:0}
.balance-box{background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin:12px 0;display:flex;justify-content:space-between;align-items:center;font-size:15px}
.balance-box b{font-size:20px;color:#0066cc}
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
  <button class="tab active" data-tab="contract">${ICONS.contract}<span>Dados do Contrato</span></button>
  <button class="tab" data-tab="charges">${ICONS.charges}<span>Cobranças</span></button>
  <button class="tab" data-tab="subs">${ICONS.subs}<span>Assinaturas</span></button>
  <button class="tab" data-tab="nfse">${ICONS.nfse}<span>NFSe</span></button>
  <button class="tab" data-tab="split">${ICONS.split}<span>Split</span></button>
  <button class="tab" data-tab="contract-gen">${ICONS.contract}<span>Gerar Contrato</span></button>
</div>

<!-- DADOS DO CONTRATO -->
<div class="panel active" id="panel-contract">
  <div class="head">
    <h3>Dados do Contrato</h3>
    <button class="btn" onclick="openWizard()">${ICONS.plus}<span style="margin-left:6px">Nova Cobrança</span></button>
  </div>
  ${planSummary}
  <h4 style="margin:14px 0 8px;font-size:13px;color:#475569">Produtos do Negócio</h4>
  <table>
    <thead><tr><th>Produto</th><th style="text-align:right">Qtd</th><th style="text-align:right">Preço</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>${productRowsHtml}</tbody>
    <tfoot><tr><td colspan="3" style="text-align:right;font-weight:700;padding-top:10px">Total dos Produtos</td><td style="text-align:right;font-weight:700;padding-top:10px;color:#0066cc">R$ ${Number(dealProducts.total || 0).toFixed(2).replace('.', ',')}</td></tr></tfoot>
  </table>
</div>

<!-- COBRANÇAS -->
<div class="panel" id="panel-charges">
  <div class="head">
    <h3>Cobranças</h3>
    <button class="btn" onclick="openWizard()">${ICONS.plus}<span style="margin-left:6px">Nova Cobrança</span></button>
  </div>
  <table><thead><tr><th>Cliente</th><th>Valor</th><th>Método</th><th>Status</th><th>Venc.</th><th>Ações</th></tr></thead><tbody>${txRows}</tbody></table>
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

<!-- GERAR CONTRATO -->
<div class="panel" id="panel-contract-gen">
  <div class="head"><h3>Gerar Contrato a partir deste ${escHtml(ctx.entityType === 'lead' ? 'Lead' : 'Negócio')}</h3></div>
  ${templates.length === 0 ? `<div class="info-banner">Nenhum template cadastrado. Crie um template na aba <b>Contratos → Templates</b> no app.</div>` : `
  <div class="grid">
    <div class="fg"><label>Template <span class="req">*</span></label>
      <select id="cg_template">
        ${templates.map((t: any) => `<option value="${escAttr(t.id)}">${escHtml(t.name)}</option>`).join('')}
      </select>
    </div>
    <div class="fg"><label>Nome do cliente <span class="req">*</span></label>
      <input id="cg_name" value="${escAttr(customer?.name || '')}">
    </div>
    <div class="fg"><label>E-mail</label>
      <input id="cg_email" value="${escAttr(customer?.email || '')}">
    </div>
    <div class="fg"><label>CPF/CNPJ</label>
      <input id="cg_doc" value="${escAttr(customer?.document || '')}">
    </div>
    <div class="fg"><label>Telefone</label>
      <input id="cg_phone" value="${escAttr(customer?.phone || '')}">
    </div>
    <div class="fg"><label>Valor total (R$)</label>
      <input id="cg_total" type="number" step="0.01" min="0" value="${Number(dealProducts.total || 0).toFixed(2)}">
    </div>
  </div>
  <div class="section">
    <h4><span class="num">A</span> Cobrança Asaas (opcional)</h4>
    <div class="grid-3">
      <div class="fg"><label>Modo</label>
        <select id="cg_mode">
          <option value="">Não criar cobrança</option>
          <option value="unica">Cobrança única</option>
          <option value="parcelada">Parcelada</option>
          <option value="assinatura_mensal">Assinatura mensal</option>
        </select>
      </div>
      <div class="fg"><label>Forma</label>
        <select id="cg_billing">
          <option value="UNDEFINED">Cliente escolhe</option>
          <option value="PIX">PIX</option>
          <option value="BOLETO">Boleto</option>
          <option value="CREDIT_CARD">Cartão</option>
        </select>
      </div>
      <div class="fg"><label>Parcelas / Ciclo</label>
        <input id="cg_count" type="number" min="1" value="1">
      </div>
    </div>
  </div>
  <button class="btn" type="button" onclick="generateContract()" id="cg_btn">${ICONS.contract}<span style="margin-left:6px">Gerar contrato</span></button>
  <div class="msg" id="cg_msg"></div>
  `}
  ${contracts.length > 0 ? `
  <h4 style="margin:18px 0 8px;font-size:13px;color:#475569">Contratos recentes deste ${escHtml(ctx.entityType === 'lead' ? 'lead' : 'negócio')}</h4>
  <table>
    <thead><tr><th>Cliente</th><th>Valor</th><th>Status</th><th>Criado</th><th>Ações</th></tr></thead>
    <tbody>${contracts.map((c: any) => `
      <tr>
        <td>${escHtml(c.customer_name || '-')}</td>
        <td>R$ ${Number(c.total_value || 0).toFixed(2).replace('.', ',')}</td>
        <td><span class="badge">${escHtml(c.payment_status || c.status || '-')}</span></td>
        <td>${c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-'}</td>
        <td class="actions">
          ${c.public_token ? `<a class="ico" target="_blank" href="/contrato/${escAttr(c.public_token)}" onclick="event.stopPropagation()">${ICONS.link}</a>` : ''}
          ${c.public_token ? `<button class="ico" title="Copiar link" onclick="copyText(window.location.origin.replace(/^https?:\\/\\/[^/]+/, '') + '/contrato/${escAttr(c.public_token)}')">${ICONS.download}</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : ''}
</div>

<div class="modal" id="wizardModal">
  <div class="modal-box">
    <div class="modal-head">
      <h3>Nova Cobrança / Plano de Contrato</h3>
      <button class="ico" onclick="closeWizard()" style="font-size:18px">${ICONS.x}</button>
    </div>

    <form id="wizForm" onsubmit="event.preventDefault();submitWizard()">

      <div class="section">
        <h4><span class="num">1</span> Cliente</h4>
        <div class="grid">
          <div class="fg"><label>Nome <span class="req">*</span></label><input id="w_name" required></div>
          <div class="fg"><label>Email <span class="req">*</span></label><input id="w_email" type="email" required></div>
          <div class="fg"><label>CPF/CNPJ <span class="req">*</span></label><input id="w_doc" required></div>
          <div class="fg"><label>Telefone</label><input id="w_phone"></div>
        </div>
      </div>

      <div class="section">
        <h4><span class="num">2</span> Valor Total</h4>
        <div class="grid">
          <div class="fg"><label>Valor total do contrato (R$) <span class="req">*</span></label><input id="w_total" type="number" step="0.01" min="0.01" required onchange="onTotalChange()"></div>
          <div class="fg" style="display:flex;align-items:flex-end">
            <button type="button" class="btn-sec" onclick="useProductsTotal()" style="width:100%">Usar total dos produtos (R$ ${Number(dealProducts.total||0).toFixed(2)})</button>
          </div>
        </div>
      </div>

      <div class="section">
        <h4><span class="num">3</span> Entrada</h4>
        <div class="grid-3">
          <div class="fg"><label>Valor da entrada (R$)</label><input id="w_entry" type="number" step="0.01" min="0" value="0" onchange="recalc()"></div>
          <div class="fg"><label>Tipo</label>
            <div class="radio-row" id="w_entryType">
              <div class="radio-pill active" data-v="cash" onclick="pickPill('w_entryType', this);recalc()">À vista</div>
              <div class="radio-pill" data-v="installments" onclick="pickPill('w_entryType', this);recalc()">Parcelada</div>
            </div>
          </div>
          <div class="fg" id="w_entryN_wrap" style="display:none"><label>Nº de parcelas</label>
            <select id="w_entryN" onchange="recalc()">
              ${Array.from({length: 11}, (_, i) => `<option value="${i + 2}">${i + 2}x</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid">
          <div class="fg"><label>1º vencimento da entrada <span class="req">*</span></label><input id="w_entryDue" type="date" onchange="recalc()"></div>
          <div class="fg"><label>Método da entrada</label>
            <div class="radio-row" id="w_entryMethod">
              <div class="radio-pill active" data-v="PIX" onclick="pickPill('w_entryMethod', this)">PIX</div>
              <div class="radio-pill" data-v="BOLETO" onclick="pickPill('w_entryMethod', this)">Boleto</div>
              <div class="radio-pill" data-v="CREDIT_CARD" onclick="pickPill('w_entryMethod', this)">Cartão</div>
            </div>
          </div>
        </div>
      </div>

      <div id="w_entryTable_wrap" style="display:none">
        <div class="section">
          <h4><span class="num">3b</span> Parcelas da Entrada (edite data/valor se necessário)</h4>
          <table class="preview-table">
            <thead><tr><th>#</th><th>Vencimento</th><th>Valor (R$)</th><th>Método</th></tr></thead>
            <tbody id="w_entryTable"></tbody>
          </table>
          <div style="margin-top:6px;font-size:11px;color:#64748b">Soma das parcelas deve igualar o valor da entrada.</div>
        </div>
      </div>

      <div class="balance-box">
        <span>Saldo a parcelar:</span>
        <b id="w_balance">R$ 0,00</b>
      </div>


      <div class="section" id="w_balanceSection">
        <h4><span class="num">4</span> Modalidade do Saldo</h4>
        <div class="radio-row" id="w_mode" style="margin-bottom:12px">
          <div class="radio-pill active" data-v="recurring" onclick="pickPill('w_mode', this);onModeChange()">Recorrente (Assinatura)</div>
          <div class="radio-pill" data-v="installments" onclick="pickPill('w_mode', this);onModeChange()">Parcelamento Fixo</div>
        </div>

        <div class="grid-3">
          <div class="fg"><label>Data de início <span class="req">*</span></label><input id="w_start" type="date" required onchange="recalc()"></div>
          <div class="fg"><label>Ciclo <span class="req">*</span></label>
            <select id="w_cycle" required onchange="onCycleChange();recalc()">
              <option value="WEEKLY" selected>Semanal</option>
              <option value="BIWEEKLY">Quinzenal</option>
              <option value="MONTHLY">Mensal</option>
            </select>
          </div>
          <div class="fg" id="w_weekday_wrap"><label>Dia da semana</label>
            <select id="w_weekday" onchange="recalc()">
              <option value="0">Domingo</option><option value="1">Segunda</option><option value="2">Terça</option>
              <option value="3" selected>Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option>
            </select>
          </div>
        </div>

        <div class="grid-3">
          <div class="fg"><label>Modo de término <span class="req">*</span></label>
            <div class="radio-row" id="w_endMode">
              <div class="radio-pill active" data-v="count" onclick="pickPill('w_endMode', this);onEndModeChange();recalc()">Nº parcelas</div>
              <div class="radio-pill" data-v="date" onclick="pickPill('w_endMode', this);onEndModeChange();recalc()">Data fim</div>
            </div>
          </div>
          <div class="fg" id="w_count_wrap"><label>Nº de parcelas <span class="req">*</span></label><input id="w_count" type="number" min="1" max="240" value="10" onchange="recalc()"></div>
          <div class="fg" id="w_end_wrap" style="display:none"><label>Data fim <span class="req">*</span></label><input id="w_end" type="date" onchange="recalc()"></div>
        </div>

        <div class="fg"><label>Método de pagamento</label>
          <div class="radio-row" id="w_recMethod">
            <div class="radio-pill active" data-v="PIX" onclick="pickPill('w_recMethod', this)">PIX</div>
            <div class="radio-pill" data-v="BOLETO" onclick="pickPill('w_recMethod', this)">Boleto</div>
            <div class="radio-pill" data-v="CREDIT_CARD" onclick="pickPill('w_recMethod', this)">Cartão</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h4><span class="num">5</span> Cronograma <span id="w_cycleLabel" style="font-weight:400;font-size:12px;color:#666;margin-left:8px"></span></h4>
        <table class="preview-table">
          <thead><tr><th>#</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Método</th></tr></thead>
          <tbody id="w_preview"><tr><td colspan="5" class="empty">Preencha os dados acima.</td></tr></tbody>
        </table>
        <div id="w_totals" style="margin-top:8px;font-size:12px;color:#444"></div>
      </div>

      <div id="w_warn" style="display:none;margin-top:10px;padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.5"></div>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" class="btn-sec" style="flex:1" onclick="closeWizard()">Cancelar</button>
        <button type="submit" class="btn" style="flex:2" id="w_submit">Enviar ao Asaas</button>
      </div>
      <div class="msg" id="w_msg"></div>
    </form>
  </div>
</div>

<script>
'use strict';
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
  dealProducts: ${safeJson(dealProducts)},
  contractPlan: ${safeJson(contractPlan)},
};

// Tab nav
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){
    try {
      document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
      document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active')});
      t.classList.add('active');
      var panel = document.getElementById('panel-' + t.dataset.tab);
      if (panel) panel.classList.add('active');
    } catch (e) { console.error('Tab error', e); }
  });
});

function pickPill(groupId, el){
  var g = document.getElementById(groupId);
  if (!g) return;
  g.querySelectorAll('.radio-pill').forEach(function(p){p.classList.remove('active')});
  el.classList.add('active');
}
function pillVal(groupId){
  var g = document.getElementById(groupId);
  if (!g) return null;
  var a = g.querySelector('.radio-pill.active');
  return a ? a.dataset.v : null;
}
function val(id){ var e = document.getElementById(id); return e ? e.value : ''; }

function useProductsTotal(){
  document.getElementById('w_total').value = (CTX.dealProducts && CTX.dealProducts.total) || 0;
  onTotalChange();
}

function onTotalChange(){ recalc(); }

function onModeChange(){
  // no extra dynamic UI for now — cronograma redraws
  recalc();
}

function onCycleChange(){
  var cycle = val('w_cycle');
  document.getElementById('w_weekday_wrap').style.display = (cycle === 'MONTHLY') ? 'none' : 'block';
}

function onEndModeChange(){
  var m = pillVal('w_endMode');
  document.getElementById('w_count_wrap').style.display = (m === 'count') ? 'block' : 'none';
  document.getElementById('w_end_wrap').style.display = (m === 'date') ? 'block' : 'none';
}

// entry type pill triggers parcelas wrap visibility
function syncEntryType(){
  var t = pillVal('w_entryType');
  document.getElementById('w_entryN_wrap').style.display = (t === 'installments') ? 'block' : 'none';
}

// schedule calc
function calcRecurringDates(startISO, cycle, weekday, count){
  var dates = [];
  var d = new Date(startISO + 'T12:00:00');
  if (cycle === 'WEEKLY' || cycle === 'BIWEEKLY') {
    var step = cycle === 'WEEKLY' ? 7 : 14;
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    for (var i = 0; i < count; i++) {
      dates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + step);
    }
  } else {
    for (var j = 0; j < count; j++) {
      dates.push(d.toISOString().split('T')[0]);
      d.setMonth(d.getMonth() + 1);
    }
  }
  return dates;
}

function countOccur(startISO, endISO, cycle, weekday){
  var s = new Date(startISO + 'T12:00:00');
  var e = new Date(endISO + 'T12:00:00');
  if (cycle === 'WEEKLY' || cycle === 'BIWEEKLY') {
    var step = cycle === 'WEEKLY' ? 7 : 14;
    var c = new Date(s);
    while (c.getDay() !== weekday) c.setDate(c.getDate() + 1);
    var n = 0; while (c <= e) { n++; c.setDate(c.getDate() + step); }
    return n;
  }
  var c2 = new Date(s); var n2 = 0;
  while (c2 <= e) { n2++; c2.setMonth(c2.getMonth() + 1); }
  return n2;
}

function recalc(){
  syncEntryType();
  var total = parseFloat(val('w_total')) || 0;
  var entry = parseFloat(val('w_entry')) || 0;
  var entryType = pillVal('w_entryType') || 'cash';
  var entryN = entryType === 'installments' ? (parseInt(val('w_entryN')) || 1) : 1;
  var entryDue = val('w_entryDue');
  var entryMethod = pillVal('w_entryMethod') || 'PIX';
  var balance = Math.max(0, total - entry);
  document.getElementById('w_balance').textContent = 'R$ ' + balance.toFixed(2).replace('.', ',');

  // Hide balance/modalidade section if nothing left to schedule
  document.getElementById('w_balanceSection').style.display = balance > 0 ? 'block' : 'none';
  document.querySelector('.balance-box').style.display = entry > 0 || balance > 0 ? 'flex' : 'none';

  // Rebuild entry overrides if structure changed (entry, entryN, entryDue)
  rebuildEntryOverrides(entry, entryN, entryDue);

  // Entry rows: render editable table when entry > 0
  var entryWrap = document.getElementById('w_entryTable_wrap');
  if (entry > 0 && entryDue) {
    entryWrap.style.display = 'block';
    renderEntryTable(entryMethod);
  } else {
    entryWrap.style.display = 'none';
  }

  // Cronograma: entry overrides + balance schedule
  var rows = [];
  if (entry > 0 && entryDue) {
    for (var i = 0; i < window.ENTRY_OVERRIDES.length; i++) {
      var it = window.ENTRY_OVERRIDES[i];
      rows.push({n: rows.length+1, type: 'Entrada ' + (i+1) + '/' + entryN, due: it.due, val: Number(it.val) || 0, method: entryMethod});
    }
  }

  // balance schedule
  var mode = pillVal('w_mode') || 'recurring';
  var start = val('w_start');
  var cycle = val('w_cycle') || 'WEEKLY';
  var weekday = parseInt(val('w_weekday'));
  var endMode = pillVal('w_endMode') || 'count';
  var count = parseInt(val('w_count')) || 0;
  var endISO = val('w_end');
  var recMethod = pillVal('w_recMethod') || 'PIX';

  if (balance > 0 && start) {
    var n = endMode === 'count' ? count : (endISO ? countOccur(start, endISO, cycle, weekday) : 0);
    if (n > 0) {
      var per2 = Math.round((balance / n) * 100) / 100;
      var dates = calcRecurringDates(start, cycle, weekday, n);
      for (var k = 0; k < dates.length; k++) {
        var v2 = (k === dates.length - 1) ? (balance - per2 * (dates.length - 1)) : per2;
        var typeLabel = mode === 'recurring' ? ('Recorrente ' + (k+1)) : ('Parcela ' + (k+1) + '/' + dates.length);
        rows.push({n: rows.length+1, type: typeLabel, due: dates[k], val: v2, method: recMethod});
      }
      if (endMode === 'count' && dates.length) document.getElementById('w_end').value = dates[dates.length - 1];
      if (endMode === 'date') document.getElementById('w_count').value = n;
    }
  }

  finalizeSchedule(rows);
}

function cycleLabel(c){ return c==='WEEKLY'?'semanal':c==='BIWEEKLY'?'quinzenal':c==='MONTHLY'?'mensal':String(c||''); }

function finalizeSchedule(rows){
  var tbody = document.getElementById('w_preview');
  var total = parseFloat(val('w_total')) || 0;
  var entry = parseFloat(val('w_entry')) || 0;
  var mode = pillVal('w_mode') || 'recurring';
  var cycle = val('w_cycle') || 'WEEKLY';
  var balance = Math.max(0, total - entry);
  var lbl = document.getElementById('w_cycleLabel');
  if (lbl) lbl.textContent = balance > 0 ? ('• Ciclo do saldo: ' + cycleLabel(cycle) + (mode==='installments'?' (parcelamento fixo)':' (assinatura recorrente)')) : '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Preencha os dados acima.</td></tr>';
  } else {
    tbody.innerHTML = rows.map(function(r){
      return '<tr><td>'+r.n+'</td><td>'+r.type+'</td><td>'+new Date(r.due+'T12:00:00').toLocaleDateString('pt-BR')+'</td><td>R$ '+r.val.toFixed(2).replace('.',',')+'</td><td>'+r.method+'</td></tr>';
    }).join('');
  }
  var sum = rows.reduce(function(a,r){return a + (Number(r.val)||0);}, 0);
  var tot = document.getElementById('w_totals');
  if (tot) tot.textContent = rows.length ? ('Soma do cronograma: R$ ' + sum.toFixed(2).replace('.',',') + ' / Valor total: R$ ' + total.toFixed(2).replace('.',',')) : '';
  validateWizard(rows, {total: total, entry: entry, balance: balance, mode: mode, cycle: cycle});
}

function validateWizard(rows, s){
  var errs = [], warns = [];
  // basic
  if (!(s.total > 0)) errs.push('Informe um valor total maior que zero.');
  if (s.entry < 0) errs.push('Valor de entrada não pode ser negativo.');
  if (s.entry > s.total + 0.009) errs.push('Entrada (R$ '+s.entry.toFixed(2)+') maior que o total (R$ '+s.total.toFixed(2)+').');

  // entry items
  var items = window.ENTRY_OVERRIDES || [];
  if (s.entry > 0 && items.length) {
    var sumE = 0, prev = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.due) errs.push('Parcela de entrada '+(i+1)+' sem data.');
      if (!(Number(it.val) >= 0)) errs.push('Parcela de entrada '+(i+1)+' com valor inválido.');
      if (prev && it.due && it.due < prev) warns.push('Datas das entradas fora de ordem na parcela '+(i+1)+'.');
      prev = it.due || prev;
      sumE += Number(it.val) || 0;
    }
    if (Math.abs(sumE - s.entry) > 0.01) errs.push('Soma das parcelas de entrada (R$ '+sumE.toFixed(2)+') difere do valor de entrada (R$ '+s.entry.toFixed(2)+').');
  }

  // balance config
  var start = val('w_start');
  var endMode = pillVal('w_endMode') || 'count';
  var count = parseInt(val('w_count')) || 0;
  var endISO = val('w_end');
  if (s.balance > 0) {
    if (!start) errs.push('Informe a data de início do saldo.');
    if (endMode === 'count' && !(count > 0)) errs.push('Informe o número de parcelas (>0).');
    if (endMode === 'date') {
      if (!endISO) errs.push('Informe a data fim.');
      else if (start && endISO < start) errs.push('Data fim do saldo é anterior ao início.');
    }
    // balance start should be after last entry date
    if (items.length && start) {
      var lastE = items.map(function(x){return x.due;}).filter(Boolean).sort().pop();
      if (lastE && start <= lastE) warns.push('Início do saldo ('+start+') sobrepõe a última entrada ('+lastE+').');
    }
    // schedule sum vs balance
    var sched = rows.filter(function(r){ return r.type.indexOf('Entrada') !== 0; });
    if (sched.length) {
      var sumS = sched.reduce(function(a,r){return a + (Number(r.val)||0);}, 0);
      if (Math.abs(sumS - s.balance) > 0.05) warns.push('Soma das parcelas do saldo (R$ '+sumS.toFixed(2)+') difere do saldo (R$ '+s.balance.toFixed(2)+').');
    }
  }

  var box = document.getElementById('w_warn');
  var btn = document.getElementById('w_submit');
  if (errs.length) {
    box.style.display = 'block';
    box.style.background = '#fdecea'; box.style.color = '#a12622'; box.style.border = '1px solid #f5c2c0';
    box.innerHTML = '<strong>Corrija antes de enviar:</strong><ul style="margin:6px 0 0 18px;padding:0">' + errs.concat(warns).map(function(e){return '<li>'+e+'</li>';}).join('') + '</ul>';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  } else if (warns.length) {
    box.style.display = 'block';
    box.style.background = '#fff4e5'; box.style.color = '#8a5a00'; box.style.border = '1px solid #ffd596';
    box.innerHTML = '<strong>Atenção:</strong><ul style="margin:6px 0 0 18px;padding:0">' + warns.map(function(e){return '<li>'+e+'</li>';}).join('') + '</ul>';
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  } else {
    box.style.display = 'none'; box.innerHTML = '';
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
  return errs.length === 0;
}

// Entry override state: array of {due, val}
window.ENTRY_OVERRIDES = window.ENTRY_OVERRIDES || [];
window.ENTRY_SIG = window.ENTRY_SIG || '';

function rebuildEntryOverrides(entry, entryN, entryDue){
  if (!(entry > 0) || !entryDue || !entryN) { window.ENTRY_OVERRIDES = []; window.ENTRY_SIG = ''; return; }
  var sig = entry + '|' + entryN + '|' + entryDue;
  if (sig === window.ENTRY_SIG && window.ENTRY_OVERRIDES.length === entryN) return;
  var per = Math.round((entry / entryN) * 100) / 100;
  var d0 = new Date(entryDue + 'T12:00:00');
  var arr = [];
  for (var i = 0; i < entryN; i++) {
    var d = new Date(d0); d.setMonth(d.getMonth() + i);
    var v = (i === entryN - 1) ? Math.round((entry - per * (entryN - 1)) * 100) / 100 : per;
    arr.push({due: d.toISOString().split('T')[0], val: v});
  }
  window.ENTRY_OVERRIDES = arr;
  window.ENTRY_SIG = sig;
}

function renderEntryTable(method){
  var tbody = document.getElementById('w_entryTable');
  tbody.innerHTML = window.ENTRY_OVERRIDES.map(function(it, i){
    return '<tr>'+
      '<td>'+(i+1)+'</td>'+
      '<td><input type="date" value="'+it.due+'" onchange="updateEntryItem('+i+', \\'due\\', this.value)" style="padding:6px 10px;font-size:13px;width:100%"></td>'+
      '<td><input type="number" step="0.01" min="0" value="'+it.val+'" onchange="updateEntryItem('+i+', \\'val\\', this.value)" style="padding:6px 10px;font-size:13px;width:100%"></td>'+
      '<td>'+method+'</td>'+
    '</tr>';
  }).join('');
}

window.updateEntryItem = function(idx, field, value){
  if (!window.ENTRY_OVERRIDES[idx]) return;
  window.ENTRY_OVERRIDES[idx][field] = field === 'val' ? (parseFloat(value) || 0) : value;
  // refresh cronograma preview only (don't rebuild overrides)
  refreshPreviewOnly();
};

function refreshPreviewOnly(){
  // re-render just the cronograma table using current overrides (avoid recalc which would rebuild overrides)
  var entry = parseFloat(val('w_entry')) || 0;
  var entryN = (pillVal('w_entryType') === 'installments') ? (parseInt(val('w_entryN')) || 1) : 1;
  var entryMethod = pillVal('w_entryMethod') || 'PIX';
  var rows = [];
  for (var i = 0; i < window.ENTRY_OVERRIDES.length; i++) {
    var it = window.ENTRY_OVERRIDES[i];
    rows.push({n: rows.length+1, type: 'Entrada '+(i+1)+'/'+entryN, due: it.due, val: Number(it.val)||0, method: entryMethod});
  }
  var total = parseFloat(val('w_total')) || 0;
  var balance = Math.max(0, total - entry);
  var mode = pillVal('w_mode') || 'recurring';
  var start = val('w_start');
  var cycle = val('w_cycle') || 'WEEKLY';
  var weekday = parseInt(val('w_weekday'));
  var endMode = pillVal('w_endMode') || 'count';
  var count = parseInt(val('w_count')) || 0;
  var endISO = val('w_end');
  var recMethod = pillVal('w_recMethod') || 'PIX';
  if (balance > 0 && start) {
    var n = endMode === 'count' ? count : (endISO ? countOccur(start, endISO, cycle, weekday) : 0);
    if (n > 0) {
      var per2 = Math.round((balance / n) * 100) / 100;
      var dates = calcRecurringDates(start, cycle, weekday, n);
      for (var k = 0; k < dates.length; k++) {
        var v2 = (k === dates.length - 1) ? (balance - per2 * (dates.length - 1)) : per2;
        var typeLabel = mode === 'recurring' ? ('Recorrente '+(k+1)) : ('Parcela '+(k+1)+'/'+dates.length);
        rows.push({n: rows.length+1, type: typeLabel, due: dates[k], val: v2, method: recMethod});
      }
    }
  }
  finalizeSchedule(rows);
}


function fitFrame(openModal){
  if (typeof BX24 === 'undefined') return;
  try {
    if (openModal) {
      var box = document.querySelector('.modal-box');
      var h = box ? box.scrollHeight + 80 : document.body.scrollHeight;
      var desired = Math.max(h, window.innerHeight, document.body.scrollHeight);
      BX24.resizeWindow(Math.max(window.innerWidth, 320), desired);
    } else {
      BX24.fitWindow();
    }
  } catch(e){}
}

function openWizard(){
  var c = CTX.customer || {}, p = CTX.contractPlan;
  document.getElementById('w_name').value = (p && p.customer_name) || c.name || '';
  document.getElementById('w_email').value = (p && p.customer_email) || c.email || '';
  document.getElementById('w_doc').value = (p && p.customer_document) || c.document || '';
  document.getElementById('w_phone').value = c.phone || '';
  var prodTotal = (CTX.dealProducts && CTX.dealProducts.total) || 0;
  document.getElementById('w_total').value = (p && ((p.entry_value||0) + (p.recurring_value||0))) || prodTotal || '';
  var d7 = new Date(); d7.setDate(d7.getDate()+7);
  document.getElementById('w_start').value = (p && p.contract_start) || d7.toISOString().split('T')[0];
  document.getElementById('w_entryDue').value = (p && p.entry_first_due) || d7.toISOString().split('T')[0];
  if (p) {
    document.getElementById('w_entry').value = p.entry_value || 0;
    if (p.cycle) document.getElementById('w_cycle').value = p.cycle;
    if (p.weekday != null) document.getElementById('w_weekday').value = p.weekday;
  }
  onCycleChange();
  onEndModeChange();
  syncEntryType();
  recalc();
  document.getElementById('wizardModal').classList.add('open');
  setTimeout(function(){ fitFrame(true); }, 60);
}

function closeWizard(){
  document.getElementById('wizardModal').classList.remove('open');
  setTimeout(function(){ fitFrame(false); }, 60);
}

async function submitWizard(){
  var btn = document.getElementById('w_submit'), msg = document.getElementById('w_msg');
  msg.className = 'msg'; msg.textContent = '';
  // Re-run full recalc to refresh validation state, then block if invalid
  try { recalc(); } catch(e){}
  var warnBox = document.getElementById('w_warn');
  if (warnBox && warnBox.style.display !== 'none' && warnBox.style.background === 'rgb(253, 236, 234)') {
    msg.className = 'msg err'; msg.textContent = '❌ Corrija os erros indicados antes de enviar.';
    return;
  }
  btn.disabled = true; btn.textContent = 'Enviando ao Asaas...';
  try {
    var total = parseFloat(val('w_total')) || 0;
    var entry = parseFloat(val('w_entry')) || 0;
    var entryType = pillVal('w_entryType') || 'cash';
    var balance = Math.max(0, total - entry);
    var endMode = pillVal('w_endMode') || 'count';
    var count = parseInt(val('w_count')) || 0;
    var endISO = val('w_end');
    var cycle = val('w_cycle');
    var weekday = parseInt(val('w_weekday'));
    var start = val('w_start');

    var n = (balance > 0 && start) ? (endMode === 'count' ? count : (endISO ? countOccur(start, endISO, cycle, weekday) : 0)) : 0;
    var recVal = n > 0 ? Math.round((balance / n) * 100) / 100 : 0;
    var computedEnd = endISO;
    if (endMode === 'count' && n > 0) {
      var dates = calcRecurringDates(start, cycle, weekday, n);
      computedEnd = dates[dates.length - 1];
    }

    var payload = {
      action: 'submit_contract_plan',
      entityType: CTX.entityType, entityId: CTX.entityId,
      memberId: CTX.memberId, domain: CTX.domain, accessToken: CTX.accessToken,
      name: val('w_name'), email: val('w_email'), doc: val('w_doc'), phone: val('w_phone'),
      total: total,
      entry: entry,
      entryN: entryType === 'installments' ? (parseInt(val('w_entryN')) || 1) : 1,
      entryDue: val('w_entryDue'),
      entryMethod: pillVal('w_entryMethod') || 'PIX',
      balance: balance,
      mode: pillVal('w_mode') || 'recurring',
      recVal: recVal,
      recCount: n,
      cycle: cycle,
      weekday: weekday,
      start: start,
      end: computedEnd,
      method: pillVal('w_recMethod') || 'PIX',
      entryItems: (entry > 0) ? window.ENTRY_OVERRIDES : [],
    };


    var r = await fetch(CTX.supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
    });
    var data = await r.json();
    if (data.success) {
      msg.className = 'msg ok'; msg.textContent = '✅ ' + (data.summary || 'Enviado!');
      setTimeout(function(){ location.reload(); }, 1500);
    } else {
      msg.className = 'msg err'; msg.textContent = '❌ ' + (data.error || 'Falha ao enviar') + (data.detail ? '\\n' + JSON.stringify(data.detail, null, 2) : '');
    }
  } catch (e) {
    msg.className = 'msg err'; msg.textContent = '❌ ' + e.message;
  }
  btn.disabled = false; btn.textContent = 'Enviar ao Asaas';
}

async function generateContract(){
  var btn = document.getElementById('cg_btn');
  var msg = document.getElementById('cg_msg');
  if (!btn) return;
  btn.disabled = true;
  msg.className = 'msg';
  try {
    var payload = {
      action: 'generate_contract',
      memberId: CTX.memberId, domain: CTX.domain, accessToken: CTX.accessToken,
      entityType: CTX.entityType, entityId: CTX.entityId,
      template_id: document.getElementById('cg_template').value,
      name: document.getElementById('cg_name').value,
      email: document.getElementById('cg_email').value,
      doc: document.getElementById('cg_doc').value,
      phone: document.getElementById('cg_phone').value,
      total: Number(document.getElementById('cg_total').value) || 0,
      mode: document.getElementById('cg_mode').value,
      billing: document.getElementById('cg_billing').value,
      count: Number(document.getElementById('cg_count').value) || 1,
    };
    var r = await fetch(CTX.supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload),
    });
    var d = await r.json();
    if (d.success && d.public_url) {
      msg.className = 'msg ok';
      msg.innerHTML = '✅ Contrato gerado! <a href="'+d.public_url+'" target="_blank" style="color:#0066cc;text-decoration:underline">Abrir contrato</a> · <button class="ico" onclick="copyText(\\''+d.public_url+'\\')">Copiar link</button>';
      setTimeout(function(){ location.reload(); }, 4000);
    } else {
      msg.className = 'msg err'; msg.textContent = '❌ ' + (d.error || 'Falha ao gerar');
    }
  } catch(e){ msg.className='msg err'; msg.textContent='❌ '+e.message; }
  btn.disabled = false;
}

async function rowAction(action, id){
  if (!confirm('Confirmar ação: ' + action + '?')) return;
  try {
    var payload = {action: action, targetId: id, entityType: CTX.entityType, entityId: CTX.entityId, memberId: CTX.memberId, domain: CTX.domain, accessToken: CTX.accessToken};
    var r = await fetch(CTX.supabaseUrl + '/functions/v1/bitrix-crm-detail-tab', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload),
    });
    var d = await r.json();
    if (d.success) location.reload(); else alert('Erro: ' + (d.error||'desconhecido'));
  } catch(e){ alert('Erro: ' + e.message); }
}

function copyText(t){ navigator.clipboard.writeText(t).then(function(){alert('Link copiado!')}); }

// Initial UI sync
onCycleChange();
onEndModeChange();
syncEntryType();
if (typeof BX24 !== 'undefined') { BX24.init(function(){ try { BX24.fitWindow(); } catch(e){} }); }
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
          customer: { name: 'João Silva', email: 'joao@ex.com', document: '', phone: '' },
          dealFields: {}, dealProducts: { rows: [], total: 0 },
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
        await fetch(`${base}/payments/${j.targetId}/notifications`, { headers: { 'access_token': cfg.api_key } });
        return json({ success: true });
      }
      if (action === 'cancel_subscription') {
        const r = await fetch(`${base}/subscriptions/${j.targetId}`, { method: 'DELETE', headers: { 'access_token': cfg.api_key } });
        const d = await r.json();
        if (d.deleted || d.id) { await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('asaas_id', j.targetId); return json({ success: true }); }
        return json({ success: false, error: d.errors?.[0]?.description || 'Falha' });
      }

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

      // -------- submit_contract_plan (wizard) --------
      if (action === 'submit_contract_plan') {
        const errors: string[] = [];
        if (!j.name) errors.push('Nome do cliente');
        if (!j.email) errors.push('Email');
        if (!j.doc) errors.push('CPF/CNPJ');
        if (!j.total || j.total <= 0) errors.push('Valor total');
        if (j.entry > 0 && !j.entryDue) errors.push('Vencimento da entrada');
        const hasBalance = (j.balance || 0) > 0;
        if (hasBalance && !j.start) errors.push('Data de início');
        if (hasBalance && (!j.recCount || j.recCount <= 0)) errors.push('Nº de parcelas/ocorrências');
        if (errors.length) return json({ success: false, error: 'Campos obrigatórios: ' + errors.join(', ') });

        if (clientEndpoint && j.accessToken && j.entityType === 'deal') {
          await ensureCustomFields(supabase, installation.id, clientEndpoint, j.accessToken);
        }

        const createdCharges: string[] = [];
        const issuesArr: string[] = [];
        let subscriptionId: string | null = null;

        try {
          const customerId = await findOrCreateAsaasCustomer(base, cfg.api_key, j.name, j.email, j.doc, j.phone);

          const billingMapLower = (bt: string) => bt.toLowerCase() === 'credit_card' ? 'credit_card' : bt.toLowerCase();

          // Entry charges — honor per-row overrides if provided, else monthly consecutive
          if (j.entry > 0 && (j.entryDue || (j.entryItems && j.entryItems.length))) {
            const entryMethod = j.entryMethod || 'PIX';
            let items: { due: string; val: number }[] = [];
            if (Array.isArray(j.entryItems) && j.entryItems.length > 0) {
              items = j.entryItems.map((it: any) => ({ due: String(it.due), val: Number(it.val) || 0 })).filter(it => it.due && it.val > 0);
            } else {
              const entryN = j.entryN || 1;
              const per = Math.round((j.entry / entryN) * 100) / 100;
              const d0 = new Date(j.entryDue + 'T12:00:00');
              for (let i = 0; i < entryN; i++) {
                const d = new Date(d0); d.setMonth(d.getMonth() + i);
                const v = i === entryN - 1 ? Number((j.entry - per * (entryN - 1)).toFixed(2)) : per;
                items.push({ due: d.toISOString().split('T')[0], val: v });
              }
            }
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              const r = await fetch(`${base}/payments`, {
                method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer: customerId, billingType: entryMethod, value: it.val, dueDate: it.due,
                  description: `Entrada ${i + 1}/${items.length} — ${j.entityType} #${j.entityId}`,
                  externalReference: `bitrix_${j.entityType}_${j.entityId}_entry_${i + 1}`,
                }),
              });
              const p = await r.json();
              if (p.errors) { issuesArr.push(`Entrada ${i + 1}: ${p.errors[0]?.description}`); continue; }
              createdCharges.push(p.id);
              await supabase.from('transactions').insert({
                tenant_id: installation.tenant_id, asaas_id: p.id, amount: it.val,
                payment_method: billingMapLower(entryMethod), status: 'pending',
                customer_name: j.name, customer_email: j.email, customer_document: j.doc,
                due_date: p.dueDate, payment_url: p.invoiceUrl,
                bitrix_entity_type: j.entityType === 'lead' ? 'lead' : 'deal', bitrix_entity_id: j.entityId,
              });
            }
          }


          // Balance: recurring (subscription) or installments (multiple charges)
          if (hasBalance && j.recCount > 0) {
            const cycle = j.cycle || 'WEEKLY';
            const weekday = parseInt(j.weekday);
            const method = j.method || 'PIX';
            const dates = generateSchedule(j.start, cycle, weekday, j.recCount);
            const per = Math.round((j.balance / j.recCount) * 100) / 100;

            if (j.mode === 'recurring') {
              const r = await fetch(`${base}/subscriptions`, {
                method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer: customerId, billingType: method, value: per,
                  nextDueDate: dates[0], cycle, endDate: dates[dates.length - 1],
                  description: `Recorrência ${cycle} — ${j.entityType} #${j.entityId}`,
                  externalReference: `bitrix_${j.entityType}_${j.entityId}_sub`,
                }),
              });
              const s = await r.json();
              if (s.errors) issuesArr.push(`Assinatura: ${s.errors[0]?.description}`);
              else {
                subscriptionId = s.id;
                await supabase.from('subscriptions').insert({
                  tenant_id: installation.tenant_id, asaas_id: s.id, customer_id: customerId,
                  customer_name: j.name, customer_email: j.email, customer_document: j.doc,
                  value: per, billing_type: billingMapLower(method),
                  cycle: cycle.toLowerCase(), description: `Recorrência ${cycle}`, next_due_date: dates[0], status: 'active',
                  bitrix_entity_type: j.entityType === 'lead' ? 'lead' : 'deal', bitrix_entity_id: j.entityId,
                });
              }
            } else {
              // installments → cobranças individuais
              for (let i = 0; i < dates.length; i++) {
                const v = i === dates.length - 1 ? Number((j.balance - per * (dates.length - 1)).toFixed(2)) : per;
                const r = await fetch(`${base}/payments`, {
                  method: 'POST', headers: { 'access_token': cfg.api_key, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customer: customerId, billingType: method, value: v, dueDate: dates[i],
                    description: `Parcela ${i + 1}/${dates.length} — ${j.entityType} #${j.entityId}`,
                    externalReference: `bitrix_${j.entityType}_${j.entityId}_inst_${i + 1}`,
                  }),
                });
                const p = await r.json();
                if (p.errors) { issuesArr.push(`Parcela ${i + 1}: ${p.errors[0]?.description}`); continue; }
                createdCharges.push(p.id);
                await supabase.from('transactions').insert({
                  tenant_id: installation.tenant_id, asaas_id: p.id, amount: v,
                  payment_method: billingMapLower(method), status: 'pending',
                  customer_name: j.name, customer_email: j.email, customer_document: j.doc,
                  due_date: p.dueDate, payment_url: p.invoiceUrl,
                  bitrix_entity_type: j.entityType === 'lead' ? 'lead' : 'deal', bitrix_entity_id: j.entityId,
                });
              }
            }
          }

          await supabase.from('contract_plans').insert({
            tenant_id: installation.tenant_id, bitrix_entity_type: j.entityType, bitrix_entity_id: j.entityId,
            customer_name: j.name, customer_email: j.email, customer_document: j.doc,
            contract_start: j.start || new Date().toISOString().split('T')[0],
            contract_end: j.end || j.start || new Date().toISOString().split('T')[0],
            payment_method: j.method,
            entry_value: j.entry || 0, entry_installments: j.entryN || 0, entry_first_due: j.entryDue || null,
            recurring_value: j.balance > 0 ? Math.round((j.balance / j.recCount) * 100) / 100 : 0,
            cycle: j.cycle, weekday: j.weekday,
            asaas_subscription_id: subscriptionId,
            status: issuesArr.length ? 'partial' : 'success',
            error_message: issuesArr.join('\n') || null,
          });

          if (clientEndpoint && j.accessToken && j.entityType === 'deal') {
            await callBitrixApi(clientEndpoint, 'crm.deal.update', {
              id: parseInt(j.entityId),
              fields: {
                UF_CRM_ASAAS_CONTRACT_START: j.start,
                UF_CRM_ASAAS_CONTRACT_END: j.end,
                UF_CRM_ASAAS_ENTRY_VALUE: j.entry || 0,
                UF_CRM_ASAAS_ENTRY_INSTALLMENTS: j.entryN || 0,
                UF_CRM_ASAAS_RECURRING_VALUE: j.balance > 0 ? Math.round((j.balance / j.recCount) * 100) / 100 : 0,
                UF_CRM_ASAAS_CYCLE: j.cycle,
                UF_CRM_ASAAS_WEEKDAY: j.weekday,
                UF_CRM_ASAAS_PAYMENT_METHOD: j.method,
              },
            }, j.accessToken);
          }

          if (clientEndpoint && j.accessToken) {
            const summary = `Total R$ ${Number(j.total).toFixed(2)} | Entrada R$ ${Number(j.entry||0).toFixed(2)} em ${j.entryN || 1}x | Saldo R$ ${Number(j.balance||0).toFixed(2)} em ${j.recCount}x ${j.cycle} (${j.mode === 'recurring' ? 'assinatura' : 'parcelado'})`;
            if (issuesArr.length) {
              await addTimelineComment(clientEndpoint, j.accessToken, j.entityType, j.entityId,
                `⚠️ Plano Asaas enviado com avisos:\n${issuesArr.join('\n')}\n\nCobranças criadas: ${createdCharges.length}\n${summary}`);
            } else {
              await addTimelineComment(clientEndpoint, j.accessToken, j.entityType, j.entityId,
                `✅ Plano Asaas enviado: ${summary}. Cobranças: ${createdCharges.length}${subscriptionId ? ` | Assinatura: ${subscriptionId}` : ''}`);
            }
          }

          return json({
            success: true,
            summary: `${createdCharges.length} cobrança(s)${subscriptionId ? ' + 1 assinatura' : ''}`,
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
        memberId, domain, accessToken, customer: {}, dealFields: {}, dealProducts: { rows: [], total: 0 },
      }), { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const clientEndpoint = installation.client_endpoint || (installation.domain ? `https://${installation.domain}/rest/` : null);

    const [_, customer, dealFields, dealProducts, txRes, subRes, invRes, splitRes, planRes] = await Promise.all([
      (clientEndpoint && accessToken && ei.type === 'deal') ? ensureCustomFields(supabase, installation.id, clientEndpoint, accessToken).catch(() => null) : Promise.resolve(null),
      (clientEndpoint && accessToken) ? getCrmCustomer(clientEndpoint, accessToken, ei.type, entityId) : Promise.resolve({}),
      (clientEndpoint && accessToken && ei.type === 'deal') ? getDealFields(clientEndpoint, accessToken, ei.type, entityId) : Promise.resolve({}),
      (clientEndpoint && accessToken && ei.type === 'deal') ? getDealProducts(clientEndpoint, accessToken, ei.type, entityId) : Promise.resolve({ rows: [], total: 0 }),
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
      memberId, domain, accessToken, customer, dealFields, dealProducts,
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
