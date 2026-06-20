// Bitrix contract integration: field setup, robot registration, entity updates
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBitrix } from "../_shared/bitrix-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getInstallation(admin: any, tenantId?: string, memberId?: string) {
  let q = admin.from("bitrix_installations").select("id, tenant_id, client_endpoint, server_endpoint, access_token, member_id").eq("status", "active").order("updated_at", { ascending: false }).limit(1);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  if (memberId) q = q.eq("member_id", memberId);
  const { data } = await q.maybeSingle();
  return data;
}

const FIELDS = [
  { code: "UF_CRM_CONTRATO_LINK", label: "Link do Contrato", type: "string" },
  { code: "UF_CRM_CONTRATO_PDF", label: "Contrato PDF", type: "string" },
  { code: "UF_CRM_CONTRATO_ID", label: "ID do Contrato", type: "string" },
  { code: "UF_CRM_CONTRATO_ASSINADO", label: "Contrato Assinado", type: "enumeration" },
];

async function ensureFields(endpoint: string, accessToken: string, entityKind: "deal" | "lead") {
  const apiMethod = entityKind === "deal" ? "crm.deal.userfield" : "crm.lead.userfield";
  for (const f of FIELDS) {
    const fields: Record<string, unknown> = {
      FIELD_NAME: f.code,
      USER_TYPE_ID: f.type,
      XML_ID: f.code,
      EDIT_FORM_LABEL: { pt: f.label, br: f.label, en: f.label },
      LIST_COLUMN_LABEL: { pt: f.label, br: f.label, en: f.label },
      SHOW_IN_LIST: "Y",
      EDIT_IN_LIST: "Y",
    };
    if (f.type === "enumeration") {
      fields.LIST = [
        { VALUE: "Sim", DEF: "N", SORT: 100 },
        { VALUE: "Não", DEF: "Y", SORT: 200 },
      ];
    }
    const res = await callBitrix(endpoint, `${apiMethod}.add`, { fields }, accessToken);
    if (res?.error && res.error !== "ERROR_FIELD_EXISTS" && !String(res.error_description || "").includes("exist")) {
      console.warn(`[contract-setup] field ${f.code} on ${entityKind}:`, res.error, res.error_description);
    }
  }
}

async function registerRobot(endpoint: string, accessToken: string) {
  const handler = `${SUPABASE_URL}/functions/v1/bitrix-contract-robot`;
  const params = {
    CODE: "asaas_contract_generate",
    HANDLER: handler,
    AUTH_USER_ID: 1,
    USE_SUBSCRIPTION: "Y",
    NAME: "ConnectPay: Gerar Contrato",
    PROPERTIES: {
      template_id: { Name: "Template ID (UUID)", Type: "string", Required: "Y" },
      payment_total: { Name: "Valor total (R$)", Type: "double" },
      payment_qty: { Name: "Qtd parcelas", Type: "int" },
      payment_method: { Name: "Método (PIX/BOLETO/CREDIT_CARD)", Type: "string" },
      payment_start: { Name: "Início (YYYY-MM-DD)", Type: "string" },
      payment_interval_days: { Name: "Intervalo (dias)", Type: "int" },
    },
    RETURN_PROPERTIES: {
      contract_url: { Name: "Link do contrato", Type: "string" },
      contract_pdf_url: { Name: "Link PDF", Type: "string" },
      contract_id: { Name: "ID do contrato", Type: "string" },
    },
  };
  const res = await callBitrix(endpoint, "bizproc.robot.add", params, accessToken);
  if (res?.error && res.error !== "ERROR_ROBOT_VALIDATION_FAILURE" && !String(res.error_description || "").includes("already")) {
    console.warn("[contract-setup] robot.add:", res.error, res.error_description);
  }
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("OK", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const action = body.action as string;

    if (action === "setup_fields") {
      const tenantId = body.tenant_id;
      const inst = await getInstallation(admin, tenantId);
      if (!inst?.client_endpoint || !inst?.access_token) return json({ error: "Instalação Bitrix não encontrada" }, 404);
      await ensureFields(inst.client_endpoint, inst.access_token, "deal");
      await ensureFields(inst.client_endpoint, inst.access_token, "lead");
      const robot = await registerRobot(inst.client_endpoint, inst.access_token);
      return json({ success: true, fields_installed: FIELDS.map((f) => f.code), robot });
    }

    if (action === "update_entity") {
      const inst = await getInstallation(admin, body.tenant_id);
      if (!inst?.client_endpoint || !inst?.access_token) return json({ error: "Bitrix not connected" }, 404);
      const kind = String(body.entity_type || "deal").toLowerCase();
      const id = parseInt(String(body.entity_id || "").replace(/[^0-9]/g, "")) || 0;
      if (!id) return json({ error: "entity_id required" }, 400);
      const method = kind === "lead" ? "crm.lead.update" : "crm.deal.update";
      const fields: Record<string, unknown> = {
        UF_CRM_CONTRATO_LINK: body.link,
        UF_CRM_CONTRATO_PDF: body.pdf_url,
        UF_CRM_CONTRATO_ID: body.contract_id,
      };
      const res = await callBitrix(inst.client_endpoint, method, { id, fields }, inst.access_token);
      // post timeline activity link too
      await callBitrix(inst.client_endpoint, "crm.timeline.comment.add", {
        fields: { ENTITY_ID: id, ENTITY_TYPE: kind, COMMENT: `[B]📄 Contrato gerado[/B]\nLink: ${body.link}` },
      }, inst.access_token).catch(() => {});
      return json({ success: true, res });
    }

    if (action === "mark_signed") {
      const inst = await getInstallation(admin, body.tenant_id);
      if (!inst?.client_endpoint || !inst?.access_token) return json({ error: "Bitrix not connected" }, 404);
      const kind = String(body.entity_type || "deal").toLowerCase();
      const id = parseInt(String(body.entity_id || "").replace(/[^0-9]/g, "")) || 0;
      if (!id) return json({ error: "entity_id required" }, 400);
      const ufMethod = kind === "lead" ? "crm.lead.userfield" : "crm.deal.userfield";
      // Resolve enum ID for "Sim"
      const list = await callBitrix(inst.client_endpoint, `${ufMethod}.list`, { filter: { FIELD_NAME: "UF_CRM_CONTRATO_ASSINADO" } }, inst.access_token);
      const enumField = (list?.result || [])[0];
      const simOption = (enumField?.LIST || []).find((o: any) => String(o.VALUE).toLowerCase() === "sim");
      const valueToSet = simOption?.ID || "Sim";
      const method = kind === "lead" ? "crm.lead.update" : "crm.deal.update";
      const res = await callBitrix(inst.client_endpoint, method, { id, fields: { UF_CRM_CONTRATO_ASSINADO: valueToSet } }, inst.access_token);
      await callBitrix(inst.client_endpoint, "crm.timeline.comment.add", {
        fields: { ENTITY_ID: id, ENTITY_TYPE: kind, COMMENT: `[B]✅ Contrato assinado[/B]\nAssinado por: ${body.signer_name}\nData: ${new Date(body.signed_at).toLocaleString("pt-BR")}` },
      }, inst.access_token).catch(() => {});
      return json({ success: true, res });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("contract-setup error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
