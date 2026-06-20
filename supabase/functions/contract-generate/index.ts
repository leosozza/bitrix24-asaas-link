import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderTemplate, buildFullDocument, type ContractVars, type PaymentRow } from "../_shared/contract-renderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_DOMAIN = Deno.env.get("APP_DOMAIN") || "https://asaas.thoth24.com";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function fetchAsaasSchedule(apiKey: string, env: string, subscriptionId: string): Promise<PaymentRow[]> {
  const base = env === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  const r = await fetch(`${base}/subscriptions/${subscriptionId}/payments`, { headers: { access_token: apiKey } });
  if (!r.ok) return [];
  const data = await r.json();
  const items = (data?.data || []) as Array<Record<string, unknown>>;
  return items.map((p, i) => ({
    n: i + 1,
    tipo: `Parcela ${i + 1}`,
    vencimento: String(p.dueDate || ""),
    valor: Number(p.value || 0),
    metodo: String(p.billingType || "").toUpperCase(),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("OK", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    // Service-role internal call (from robot handler) — passes tenant explicitly
    let tenantId: string;
    if (token === SUPABASE_SERVICE_ROLE_KEY && body.__service_tenant) {
      tenantId = String(body.__service_tenant);
    } else {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: ue } = await userClient.auth.getUser(token);
      if (ue || !userData.user) return json({ error: "Unauthorized" }, 401);
      tenantId = userData.user.id;
    }


    const {
      template_id,
      customer = {},
      total_value = 0,
      contract_term,
      salesperson_name,
      payment_schedule,
      asaas_subscription_id,
      asaas_customer_id,
      bitrix_entity_type,
      bitrix_entity_id,
      extra_vars = {},
    } = body;

    if (!template_id) return json({ error: "template_id required" }, 400);
    if (!customer?.name) return json({ error: "customer.name required" }, 400);

    const { data: template } = await admin.from("contract_templates").select("*").eq("id", template_id).eq("tenant_id", tenantId).maybeSingle();
    if (!template) return json({ error: "Template not found" }, 404);

    // Build schedule
    let schedule: PaymentRow[] = Array.isArray(payment_schedule) ? payment_schedule : [];
    if ((!schedule.length) && asaas_subscription_id) {
      const { data: cfg } = await admin.from("asaas_configurations").select("api_key, environment").eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
      if (cfg?.api_key) schedule = await fetchAsaasSchedule(cfg.api_key, cfg.environment, asaas_subscription_id);
    }

    const { data: profile } = await admin.from("profiles").select("company_name, email").eq("id", tenantId).maybeSingle();

    const vars: ContractVars = {
      customer_name: customer.name,
      customer_doc: customer.doc || customer.cpf_cnpj,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_address: customer.address,
      company_name: customer.company_name,
      total_value: Number(total_value || schedule.reduce((s, r) => s + Number(r.valor || 0), 0)),
      contract_term,
      salesperson_name,
      payment_schedule: schedule,
      contratado_nome: profile?.company_name || "",
      data_contrato: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      extra_vars,
    };

    const renderedBody = renderTemplate(template.body_html, vars);
    const fullHtml = buildFullDocument({ title: `Contrato - ${customer.name}`, bodyHtml: renderedBody });

    const { data: inserted, error: insErr } = await admin
      .from("contracts")
      .insert({
        tenant_id: tenantId,
        template_id,
        asaas_subscription_id: asaas_subscription_id || null,
        asaas_customer_id: asaas_customer_id || null,
        bitrix_entity_type: bitrix_entity_type || null,
        bitrix_entity_id: bitrix_entity_id || null,
        customer_name: vars.customer_name,
        customer_doc: vars.customer_doc,
        customer_email: vars.customer_email,
        customer_phone: vars.customer_phone,
        customer_address: vars.customer_address,
        company_name: vars.company_name,
        total_value: vars.total_value,
        contract_term: vars.contract_term,
        salesperson_name: vars.salesperson_name,
        payment_schedule: schedule,
        extra_vars,
        rendered_html: fullHtml,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (insErr || !inserted) return json({ error: insErr?.message || "Failed to create contract" }, 500);

    const publicUrl = `${APP_DOMAIN}/contrato/${inserted.public_token}`;
    const pdfUrl = `${APP_DOMAIN}/contrato/${inserted.public_token}?print=1`;

    // Best-effort Bitrix CRM update
    if (bitrix_entity_type && bitrix_entity_id) {
      try {
        const fnUrl = `${SUPABASE_URL}/functions/v1/bitrix-contract-setup`;
        await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            action: "update_entity",
            tenant_id: tenantId,
            entity_type: bitrix_entity_type,
            entity_id: bitrix_entity_id,
            contract_id: inserted.id,
            link: publicUrl,
            pdf_url: pdfUrl,
            signed: false,
          }),
        }).catch(() => {});
      } catch (_) { /* ignore */ }
    }

    return json({ success: true, contract_id: inserted.id, public_url: publicUrl, pdf_url: pdfUrl, public_token: inserted.public_token });
  } catch (e) {
    console.error("contract-generate error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
