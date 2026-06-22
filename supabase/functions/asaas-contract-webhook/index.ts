// Public webhook receiving Asaas events for contract-linked payments.
// Updates contracts.payment_status, contracts.status and posts back to Bitrix timeline.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBitrix } from "../_shared/bitrix-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const PAID = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"]);
const OVERDUE = new Set(["PAYMENT_OVERDUE"]);
const CANCELED = new Set(["PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"]);
const CREATED = new Set(["PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_AWAITING_RISK_ANALYSIS"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("OK", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const event = await req.json().catch(() => ({}));
    const eventName: string = String(event?.event || "");
    const payment = event?.payment || {};
    const subscriptionId: string | null = payment?.subscription || event?.subscription?.id || null;
    const paymentId: string | null = payment?.id || null;
    const externalReference: string = String(payment?.externalReference || event?.subscription?.externalReference || "");

    console.log("asaas-contract-webhook", { eventName, paymentId, subscriptionId, externalReference });

    // Lookup contract: prefer externalReference "contract:<id>", fallback to asaas_payment_id, then asaas_subscription_id
    let contractId: string | null = null;
    if (externalReference.startsWith("contract:")) contractId = externalReference.slice("contract:".length);
    let contract: any = null;
    if (contractId) {
      const { data } = await admin.from("contracts").select("*").eq("id", contractId).maybeSingle();
      contract = data;
    }
    if (!contract && paymentId) {
      const { data } = await admin.from("contracts").select("*").eq("asaas_payment_id", paymentId).maybeSingle();
      contract = data;
    }
    if (!contract && subscriptionId) {
      const { data } = await admin.from("contracts").select("*").eq("asaas_subscription_id", subscriptionId).maybeSingle();
      contract = data;
    }
    if (!contract) {
      // Not a contract-linked event — ack to avoid Asaas retries
      return json({ success: true, ignored: true, reason: "no contract match" });
    }

    // Idempotency
    const { data: prev } = await admin
      .from("integration_logs")
      .select("id")
      .eq("tenant_id", contract.tenant_id)
      .eq("action", `contract_webhook_${eventName.toLowerCase()}`)
      .eq("entity_id", paymentId || subscriptionId || contract.id)
      .eq("status", "success")
      .limit(1)
      .maybeSingle();
    if (prev) return json({ success: true, duplicate: true });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let timelineMsg = "";

    if (CREATED.has(eventName)) {
      if (paymentId && !contract.asaas_payment_id) update.asaas_payment_id = paymentId;
      if (payment?.invoiceUrl) update.asaas_invoice_url = payment.invoiceUrl;
      if (payment?.bankSlipUrl) update.asaas_bank_slip_url = payment.bankSlipUrl;
      if (contract.payment_status === "pending") timelineMsg = `Cobrança Asaas criada — vencimento ${payment?.dueDate || ""}`;
    } else if (PAID.has(eventName)) {
      update.payment_status = "paid";
      update.status = "signed"; // remains signed/active after payment
      timelineMsg = `✅ Pagamento confirmado no Asaas — R$ ${Number(payment?.value || contract.total_value).toFixed(2)}`;
    } else if (OVERDUE.has(eventName)) {
      update.payment_status = "overdue";
      timelineMsg = `⚠️ Cobrança em atraso no Asaas (venc. ${payment?.dueDate || "—"})`;
    } else if (CANCELED.has(eventName)) {
      update.payment_status = eventName.includes("REFUND") ? "refunded" : "canceled";
      timelineMsg = `Cobrança cancelada/estornada no Asaas`;
    } else if (eventName === "SUBSCRIPTION_DELETED") {
      update.payment_status = "canceled";
      update.status = "canceled";
      timelineMsg = `Assinatura recorrente cancelada no Asaas`;
    } else {
      return json({ success: true, ignored: true, reason: `event ${eventName} not handled` });
    }

    if (Object.keys(update).length > 1) {
      const { error: upErr } = await admin.from("contracts").update(update).eq("id", contract.id);
      if (upErr) throw upErr;
    }

    // Post back to Bitrix timeline
    if (timelineMsg && contract.bitrix_entity_type && contract.bitrix_entity_id) {
      try {
        const { data: install } = await admin
          .from("bitrix_installations")
          .select("client_endpoint, access_token")
          .eq("tenant_id", contract.tenant_id)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (install) {
          const entityTypeMap: Record<string, string> = { deal: "deal", lead: "lead", contact: "contact", company: "company" };
          const t = entityTypeMap[String(contract.bitrix_entity_type).toLowerCase()];
          if (t) {
            await callBitrix(install.client_endpoint, "crm.timeline.comment.add", {
              fields: {
                ENTITY_ID: contract.bitrix_entity_id,
                ENTITY_TYPE: t,
                COMMENT: `[Contrato Asaas] ${timelineMsg}\nCliente: ${contract.customer_name}`,
              },
            }, install.access_token);

            // If deal + paid, mark won (best-effort)
            if (t === "deal" && update.payment_status === "paid") {
              await callBitrix(install.client_endpoint, "crm.deal.update", {
                id: contract.bitrix_entity_id,
                fields: { STAGE_ID: "WON" },
              }, install.access_token).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn("Bitrix timeline update failed", e);
      }
    }

    await admin.from("integration_logs").insert({
      tenant_id: contract.tenant_id,
      action: `contract_webhook_${eventName.toLowerCase()}`,
      entity_type: "contract",
      entity_id: paymentId || subscriptionId || contract.id,
      status: "success",
      request_data: event as any,
      response_data: { contract_id: contract.id, update } as any,
    });

    return json({ success: true, contract_id: contract.id, event: eventName });
  } catch (e) {
    console.error("asaas-contract-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
