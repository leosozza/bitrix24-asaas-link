import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
          status: contract.status,
          signed_at: contract.signed_at,
          signature_name: contract.signature_name,
          signed_ip: contract.signed_ip,
          payment_schedule: contract.payment_schedule,
          total_value: contract.total_value,
        },
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.action !== "sign") return json({ error: "invalid action" }, 400);
      if (contract.status === "signed") return json({ error: "Já assinado" }, 400);
      const name = String(body.name || "").trim();
      if (!name) return json({ error: "Nome obrigatório" }, 400);
      if (!body.accept) return json({ error: "Aceite obrigatório" }, 400);

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
      const ua = req.headers.get("user-agent") || "unknown";
      const signedAt = new Date().toISOString();
      const hash = await sha256Hex(`${contract.public_token}|${name}|${ip}|${signedAt}`);

      const signatureBlock = `<div class="sign" style="margin-top:48px;padding:24px;border:2px solid #10b981;border-radius:8px;background:#ecfdf5;font-size:14px;">
        <div style="font-size:12px;color:#059669;letter-spacing:.05em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">✓ Contrato assinado digitalmente</div>
        <div><strong>Assinado por:</strong> ${name.replace(/[<>]/g, "")}</div>
        <div><strong>Data:</strong> ${new Date(signedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
        <div><strong>IP:</strong> ${ip}</div>
        <div style="margin-top:8px;font-size:11px;color:#475569;word-break:break-all;"><strong>Hash:</strong> ${hash}</div>
      </div>`;

      const updatedHtml = contract.rendered_html.replace("</div></body>", `${signatureBlock}</div></body>`);

      await admin.from("contracts").update({
        status: "signed",
        signed_at: signedAt,
        signed_ip: ip,
        signed_user_agent: ua,
        signature_name: name,
        signature_hash: hash,
        rendered_html: updatedHtml,
      }).eq("id", contract.id);

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
            }),
          }).catch(() => {});
        } catch (_) { /* ignore */ }
      }

      return json({ success: true, signed_at: signedAt, hash });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("contract-public error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
