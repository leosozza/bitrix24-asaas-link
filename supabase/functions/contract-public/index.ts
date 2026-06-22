import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureAsaasCustomer, createAsaasCharge, createAsaasSubscription } from "../_shared/asaas-contract-billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_ATTEMPTS = 5;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");

function maskDoc(raw: string): string {
  const d = onlyDigits(raw);
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(-2)}`;
  return d.replace(/.(?=.{2})/g, "*");
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmtDateBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (UTC-03:00)";
}

function buildEvidenceBlock(args: {
  signerName: string;
  docMasked: string;
  signedAt: string;
  ip: string;
  uaSummary: string;
  language: string;
  timezone: string;
  geolocation: string;
  publicToken: string;
  documentHash: string;
  evidenceId: string;
}): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#475569;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:4px 0;color:#0f172a;word-break:break-all;">${escapeHtml(v)}</td></tr>`;
  return `<div class="sign" style="margin-top:48px;padding:24px;border:2px solid #10b981;border-radius:8px;background:#ecfdf5;font-size:13px;line-height:1.55;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="font-size:12px;color:#059669;letter-spacing:.05em;text-transform:uppercase;font-weight:700;margin-bottom:4px;">✓ Assinatura eletrônica avançada</div>
    <div style="font-size:11px;color:#047857;margin-bottom:14px;">Lei 14.063/2020, art. 4º, II</div>
    <table style="border-collapse:collapse;font-size:13px;width:100%;">
      ${row("Signatário", args.signerName)}
      ${row("Documento", `${args.docMasked} (validado)`)}
      ${row("Data e hora", fmtDateBR(args.signedAt))}
      ${row("IP de origem", args.ip)}
      ${row("Dispositivo", args.uaSummary)}
      ${row("Idioma", args.language)}
      ${row("Fuso do cliente", args.timezone)}
      ${row("Geolocalização", args.geolocation)}
      ${row("Token público", args.publicToken)}
      ${row("ID da evidência", args.evidenceId)}
    </table>
    <div style="margin-top:12px;padding-top:12px;border-top:1px dashed #a7f3d0;">
      <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Hash SHA-256 do documento</div>
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#0f172a;word-break:break-all;margin-top:4px;">${args.documentHash}</div>
    </div>
    <div style="margin-top:12px;font-size:11px;color:#475569;">Este documento foi assinado eletronicamente. Qualquer alteração posterior invalidará o hash acima.</div>
  </div>`;
}

function summarizeUA(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Desconhecido";
  const os = /Windows NT/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Desconhecido";
  return `${browser} / ${os}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return json({ error: "token required" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: contract } = await admin.from("contracts").select("*").eq("public_token", token).maybeSingle();
    if (!contract) return json({ error: "Not found" }, 404);

    if (req.method === "GET") {
      if (!contract.viewed_at) {
        await admin.from("contracts").update({ viewed_at: new Date().toISOString(), status: contract.status === "sent" ? "viewed" : contract.status }).eq("id", contract.id);
      }
      return json({
        success: true,
        contract: {
          id: contract.id,
          rendered_html: contract.rendered_html,
          customer_name: contract.customer_name,
          customer_doc_required: !!contract.customer_doc,
          status: contract.status,
          signed_at: contract.signed_at,
          signature_name: contract.signature_name,
          signature_doc_masked: contract.signature_doc_masked,
          signed_ip: contract.signed_ip,
          document_hash: contract.document_hash,
          payment_schedule: contract.payment_schedule,
          total_value: contract.total_value,
        },
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.action !== "sign") return json({ error: "invalid action" }, 400);
      if (contract.status === "signed") return json({ error: "Contrato já assinado" }, 400);
      if ((contract.signature_attempts ?? 0) >= MAX_ATTEMPTS) {
        return json({ error: "Número máximo de tentativas excedido. Contate o emissor do contrato." }, 429);
      }

      const name = String(body.name || "").trim();
      const doc = onlyDigits(String(body.customer_doc || ""));
      if (!name) return json({ error: "Nome obrigatório" }, 400);
      if (!doc || (doc.length !== 11 && doc.length !== 14)) return json({ error: "CPF ou CNPJ inválido" }, 400);
      if (!body.accept_terms) return json({ error: "Aceite dos termos obrigatório" }, 400);
      if (!body.accept_ownership) return json({ error: "Declaração de titularidade obrigatória" }, 400);

      // Validate document matches the contract's customer_doc
      const expected = onlyDigits(contract.customer_doc || "");
      if (!expected) return json({ error: "Contrato sem documento do titular cadastrado. Contate o emissor." }, 400);
      if (doc !== expected) {
        await admin.from("contracts").update({ signature_attempts: (contract.signature_attempts ?? 0) + 1 }).eq("id", contract.id);
        return json({ error: "Documento informado não confere com o titular do contrato.", attempts_left: MAX_ATTEMPTS - ((contract.signature_attempts ?? 0) + 1) }, 422);
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
      const ua = req.headers.get("user-agent") || "unknown";
      const acceptLanguage = req.headers.get("accept-language") || "unknown";
      const language = String(body.client?.language || acceptLanguage.split(",")[0] || "unknown");
      const timezone = String(body.client?.timezone || "unknown");
      const screen = body.client?.screen || null;
      const platform = String(body.client?.platform || "unknown");
      const geo = body.client?.geolocation;
      const geolocation = geo && typeof geo.latitude === "number"
        ? `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)} (±${Math.round(geo.accuracy || 0)}m)`
        : "não autorizada";

      const signedAt = new Date().toISOString();
      const evidenceId = crypto.randomUUID();
      const docMasked = maskDoc(doc);

      // Hash the rendered HTML BEFORE appending signature block, plus a snapshot of key fields
      const documentHash = await sha256Hex(
        JSON.stringify({
          html: contract.rendered_html,
          token: contract.public_token,
          customer_name: contract.customer_name,
          total_value: contract.total_value,
          payment_schedule: contract.payment_schedule,
        })
      );

      const signatureHash = await sha256Hex(`${contract.public_token}|${doc}|${name}|${ip}|${signedAt}|${documentHash}`);
      const uaSummary = summarizeUA(ua);

      const signatureBlock = buildEvidenceBlock({
        signerName: name,
        docMasked,
        signedAt,
        ip,
        uaSummary,
        language,
        timezone,
        geolocation,
        publicToken: contract.public_token,
        documentHash,
        evidenceId,
      });

      const updatedHtml = contract.rendered_html.includes("</body>")
        ? contract.rendered_html.replace(/<\/body>\s*<\/html>\s*$/i, `${signatureBlock}</body></html>`)
        : contract.rendered_html + signatureBlock;

      const evidence = {
        evidence_id: evidenceId,
        signed_at: signedAt,
        ip,
        user_agent: ua,
        user_agent_summary: uaSummary,
        accept_language: acceptLanguage,
        language,
        timezone,
        platform,
        screen,
        geolocation: geo ?? null,
        document_hash: documentHash,
        signature_hash: signatureHash,
        legal_basis: "Lei 14.063/2020 art. 4º, II — assinatura eletrônica avançada",
      };

      await admin.from("contracts").update({
        status: "signed",
        signed_at: signedAt,
        signed_ip: ip,
        signed_user_agent: ua,
        signature_name: name,
        signature_hash: signatureHash,
        signature_doc_masked: docMasked,
        document_hash: documentHash,
        signature_evidence: evidence,
        rendered_html: updatedHtml,
      }).eq("id", contract.id);

      // Create Asaas charge/subscription if configured
      let chargeResult: { invoiceUrl?: string; bankSlipUrl?: string; id?: string } | null = null;
      if (contract.auto_create_charge && contract.asaas_charge_mode && contract.asaas_customer_payload) {
        try {
          const { data: cfg } = await admin
            .from("asaas_configurations")
            .select("api_key, environment")
            .eq("tenant_id", contract.tenant_id)
            .eq("is_active", true)
            .maybeSingle();
          if (cfg?.api_key) {
            const env = cfg.environment || "sandbox";
            const customerPayload = { ...(contract.asaas_customer_payload as any), externalReference: `contract:${contract.id}` };
            const customerId = await ensureAsaasCustomer(env, cfg.api_key, customerPayload);
            const billingType = (contract.asaas_billing_type || "UNDEFINED") as any;
            const due = contract.payment_due_date || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
            const description = `Contrato ${contract.id.slice(0, 8)} — ${contract.customer_name}`;
            const externalReference = `contract:${contract.id}`;

            if (contract.asaas_charge_mode === "assinatura_mensal" || contract.asaas_charge_mode === "assinatura") {
              const sub = await createAsaasSubscription(env, cfg.api_key, {
                customerId, value: Number(contract.total_value || 0),
                nextDueDate: due, billingType,
                cycle: (contract.asaas_subscription_cycle as any) || "MONTHLY",
                description, externalReference,
                maxPayments: contract.installment_count || undefined,
              });
              chargeResult = { id: sub.id };
              await admin.from("contracts").update({
                asaas_customer_id: customerId,
                asaas_subscription_id: sub.id,
                payment_status: "pending",
              }).eq("id", contract.id);
            } else {
              const isInstallment = contract.asaas_charge_mode === "parcelada" && (contract.installment_count ?? 0) > 1;
              const payment = await createAsaasCharge(env, cfg.api_key, {
                customerId,
                value: Number(contract.total_value || 0),
                billingType, dueDate: due, description, externalReference,
                installmentCount: isInstallment ? contract.installment_count : undefined,
                installmentValue: isInstallment ? Number(contract.total_value || 0) / (contract.installment_count || 1) : undefined,
              });
              chargeResult = { id: payment.id, invoiceUrl: payment.invoiceUrl, bankSlipUrl: payment.bankSlipUrl };
              await admin.from("contracts").update({
                asaas_customer_id: customerId,
                asaas_payment_id: payment.id,
                asaas_installment_id: payment.installment || null,
                asaas_invoice_url: payment.invoiceUrl || null,
                asaas_bank_slip_url: payment.bankSlipUrl || null,
                payment_status: "pending",
              }).eq("id", contract.id);
            }
          }
        } catch (e) {
          console.error("[contract-public] Asaas charge failed", e);
          await admin.from("integration_logs").insert({
            tenant_id: contract.tenant_id,
            action: "contract_charge_create_failed",
            entity_type: "contract",
            entity_id: contract.id,
            status: "error",
            error_message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Update Bitrix CRM field if linked
      if (contract.bitrix_entity_type && contract.bitrix_entity_id) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/bitrix-contract-setup`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({
              action: "mark_signed",
              tenant_id: contract.tenant_id,
              entity_type: contract.bitrix_entity_type,
              entity_id: contract.bitrix_entity_id,
              signer_name: name,
              signed_at: signedAt,
              invoice_url: chargeResult?.invoiceUrl || null,
            }),
          }).catch(() => {});
        } catch (_) { /* ignore */ }
      }

      return json({
        success: true,
        signed_at: signedAt,
        evidence_id: evidenceId,
        document_hash: documentHash,
        signature_hash: signatureHash,
        invoice_url: chargeResult?.invoiceUrl || null,
      });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("contract-public error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
