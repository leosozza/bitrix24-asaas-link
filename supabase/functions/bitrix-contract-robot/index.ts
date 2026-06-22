// Bizproc robot callback: generates a ConnectPay contract for the workflow's CRM entity
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBitrix } from "../_shared/bitrix-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_DOMAIN = Deno.env.get("APP_DOMAIN") || "https://asaas.thoth24.com";

function parseFormOrJson(text: string, contentType: string): Record<string, string> {
  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  const params = new URLSearchParams(text);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => { obj[k] = v; });
  return obj;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("OK", { headers: corsHeaders });

  try {
    const ct = req.headers.get("content-type") || "";
    const text = await req.text();
    const params = parseFormOrJson(text, ct);

    const eventToken = params["event_token"] || params["auth[event_token]"] || "";
    const memberId = params["auth[member_id]"] || params["AUTH[MEMBER_ID]"] || "";
    const accessToken = params["auth[access_token]"] || params["AUTH[ACCESS_TOKEN]"] || "";
    const documentTypeRaw = params["document_type[2]"] || "";
    const documentIdRaw = params["document_id[2]"] || params["document_id[0]"] || "";

    const p = (k: string) => params[`properties[${k}]`] || params[`PROPERTIES[${k}]`] || "";
    let templateId = p("template_id");
    const valor = Number(p("payment_total") || 0);
    const qty = parseInt(p("payment_qty") || "1");
    const method = (p("payment_method") || "PIX").toUpperCase();
    const startDate = p("payment_start") || new Date().toISOString().slice(0, 10);
    const intervalDays = parseInt(p("payment_interval_days") || "30");
    const asaasAutoCharge = String(p("asaas_auto_charge") || "Y").toUpperCase() !== "N";
    const asaasChargeMode = (p("asaas_charge_mode") || "parcelada").toLowerCase();
    const asaasSubscriptionCycle = (p("asaas_subscription_cycle") || "MONTHLY").toUpperCase();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: inst } = await admin.from("bitrix_installations")
      .select("tenant_id, client_endpoint, access_token, member_id")
      .eq("member_id", memberId).eq("status", "active").maybeSingle();

    if (!inst) {
      console.error("[contract-robot] installation not found", memberId);
      return new Response("OK", { headers: corsHeaders });
    }

    const tenantId = inst.tenant_id;
    const apiEndpoint = inst.client_endpoint || "";
    const tokenForCalls = accessToken || inst.access_token;

    let entityKind: "deal" | "lead" | "contact" | "company" = "deal";
    if (/Lead/i.test(documentTypeRaw)) entityKind = "lead";
    else if (/Contact/i.test(documentTypeRaw)) entityKind = "contact";
    else if (/Company/i.test(documentTypeRaw)) entityKind = "company";
    const entityId = parseInt(documentIdRaw.replace(/[^0-9]/g, "")) || 0;

    // Pull entity data for customer fields
    let customer = { name: "Cliente", doc: "", email: "", phone: "", address: "", company_name: "" };
    if (entityId) {
      const apiMethod = entityKind === "lead" ? "crm.lead.get" : "crm.deal.get";
      const res = await callBitrix(apiEndpoint, apiMethod, { id: entityId }, tokenForCalls);
      const r = res?.result || {};
      customer.name = r.TITLE || r.NAME || r.FULL_NAME || "Cliente";
      customer.email = r.EMAIL?.[0]?.VALUE || "";
      customer.phone = r.PHONE?.[0]?.VALUE || "";
      if (entityKind === "lead") customer.company_name = r.COMPANY_TITLE || "";
    }

    // Build manual schedule from robot inputs
    const valorParcela = qty > 0 ? Number((valor / qty).toFixed(2)) : valor;
    const start = new Date(startDate + "T12:00:00");
    const schedule = Array.from({ length: qty }, (_, i) => ({
      n: i + 1,
      tipo: `Parcela ${i + 1}/${qty}`,
      vencimento: new Date(start.getTime() + i * intervalDays * 86400000).toISOString().slice(0, 10),
      valor: valorParcela,
      metodo: method,
    }));

    // Render via shared logic by calling contract-generate as service role
    const genRes = await fetch(`${SUPABASE_URL}/functions/v1/contract-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY },
      body: JSON.stringify({
        template_id: templateId,
        customer,
        total_value: valor,
        payment_schedule: schedule,
        bitrix_entity_type: entityKind,
        bitrix_entity_id: String(entityId),
        __service_tenant: tenantId,
      }),
    });
    const genData = await genRes.json().catch(() => ({}));

    // Send back to bizproc
    if (eventToken) {
      await callBitrix(apiEndpoint, "bizproc.event.send", {
        EVENT_TOKEN: eventToken,
        RETURN_VALUES: {
          contract_url: genData?.public_url || "",
          contract_pdf_url: genData?.pdf_url || "",
          contract_id: genData?.contract_id || "",
        },
        LOG_MESSAGE: genData?.success ? `Contrato gerado: ${genData.public_url}` : `Erro: ${genData?.error || "desconhecido"}`,
      }, tokenForCalls);
    }

    return new Response("OK", { headers: corsHeaders });
  } catch (e) {
    console.error("contract-robot error", e);
    return new Response("OK", { headers: corsHeaders });
  }
});
