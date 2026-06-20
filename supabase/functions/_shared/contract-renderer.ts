// Shared contract rendering utilities
export interface PaymentRow {
  n: number;
  tipo: string;
  vencimento: string; // YYYY-MM-DD or DD/MM/YYYY
  valor: number;
  metodo: string;
}

export interface ContractVars {
  customer_name: string;
  customer_doc?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  company_name?: string;
  total_value: number;
  contract_term?: string;
  salesperson_name?: string;
  payment_schedule: PaymentRow[];
  contratado_nome?: string;
  contratado_cnpj?: string;
  contratado_endereco?: string;
  contratado_representante?: string;
  data_contrato?: string;
  [k: string]: unknown;
}

export function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

export function formatDateBR(iso: string): string {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const METHOD_COLORS: Record<string, string> = {
  PIX: "#0ea5e9",
  BOLETO: "#f59e0b",
  CREDIT_CARD: "#10b981",
  CARTAO: "#10b981",
  CARTÃO: "#10b981",
  DINHEIRO: "#6b7280",
  TRANSFERENCIA: "#8b5cf6",
};

export function renderScheduleTable(rows: PaymentRow[]): string {
  if (!rows?.length) return "";
  const head = `
    <thead>
      <tr>
        <th style="text-align:left;padding:12px 14px;background:#f3f4f6;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#374151;border-bottom:1px solid #e5e7eb;">#</th>
        <th style="text-align:left;padding:12px 14px;background:#f3f4f6;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#374151;border-bottom:1px solid #e5e7eb;">Tipo</th>
        <th style="text-align:left;padding:12px 14px;background:#f3f4f6;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#374151;border-bottom:1px solid #e5e7eb;">Vencimento</th>
        <th style="text-align:left;padding:12px 14px;background:#f3f4f6;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#374151;border-bottom:1px solid #e5e7eb;">Valor</th>
        <th style="text-align:left;padding:12px 14px;background:#f3f4f6;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#374151;border-bottom:1px solid #e5e7eb;">Método</th>
      </tr>
    </thead>`;
  const body = rows
    .map((r, i) => {
      const bg = i % 2 ? "#fafafa" : "#ffffff";
      const color = METHOD_COLORS[(r.metodo || "").toUpperCase()] || "#374151";
      return `
        <tr style="background:${bg};">
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;">${r.n}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;">${escapeHtml(r.tipo)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:14px;">${escapeHtml(formatDateBR(r.vencimento))}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#111827;font-weight:500;font-size:14px;">${formatBRL(r.valor)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${color}20;color:${color};font-weight:600;font-size:11px;letter-spacing:.04em;">${escapeHtml(r.metodo)}</span></td>
        </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${head}<tbody>${body}</tbody></table>`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
}

export function renderTemplate(html: string, vars: ContractVars): string {
  const replacements: Record<string, string> = {
    cliente_nome: escapeHtml(vars.customer_name),
    cliente_doc: escapeHtml(vars.customer_doc),
    cliente_email: escapeHtml(vars.customer_email),
    cliente_telefone: escapeHtml(vars.customer_phone),
    cliente_endereco: escapeHtml(vars.customer_address),
    cliente_empresa: escapeHtml(vars.company_name),
    valor_total: formatBRL(vars.total_value),
    prazo_contrato: escapeHtml(vars.contract_term),
    vendedor: escapeHtml(vars.salesperson_name),
    contratado_nome: escapeHtml(vars.contratado_nome),
    contratado_cnpj: escapeHtml(vars.contratado_cnpj),
    contratado_endereco: escapeHtml(vars.contratado_endereco),
    contratado_representante: escapeHtml(vars.contratado_representante),
    data_contrato: escapeHtml(vars.data_contrato || formatDateBR(new Date().toISOString())),
    parcelas_tabela: renderScheduleTable(vars.payment_schedule),
    qtd_parcelas: String(vars.payment_schedule?.length || 0),
  };
  for (const [k, v] of Object.entries(vars.extra_vars || {})) {
    replacements[k] = escapeHtml(v);
  }
  let out = html;
  for (const [k, v] of Object.entries(replacements)) {
    out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), v ?? "");
  }
  return out;
}

export function buildFullDocument(opts: {
  title: string;
  bodyHtml: string;
  signatureBlock?: string;
}): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.6;background:#f9fafb;margin:0;padding:24px}
  .doc{max-width:860px;margin:0 auto;background:#fff;padding:56px 64px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
  h1,h2,h3{color:#0f172a;line-height:1.25}
  h1{font-size:24px;margin:0 0 8px}
  h2{font-size:18px;margin:24px 0 12px}
  p{margin:8px 0}
  table{font-size:14px}
  .sign{margin-top:48px;padding:24px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;font-size:14px}
  .sign strong{color:#0f172a}
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;border-radius:0;padding:32px 40px;max-width:none}.no-print{display:none!important}}
</style></head><body><div class="doc">${opts.bodyHtml}${opts.signatureBlock || ""}</div></body></html>`;
}
