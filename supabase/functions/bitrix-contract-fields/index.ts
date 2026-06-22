// List Bitrix entity fields and resolve entity values for contract auto-fill.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBitrix } from "../_shared/bitrix-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const ENTITY_METHODS: Record<string, { fields: string; get: string }> = {
  deal: { fields: "crm.deal.fields", get: "crm.deal.get" },
  lead: { fields: "crm.lead.fields", get: "crm.lead.get" },
  contact: { fields: "crm.contact.fields", get: "crm.contact.get" },
  company: { fields: "crm.company.fields", get: "crm.company.get" },
};

async function getInstallation(admin: any, tenantId: string) {
  const { data } = await admin
    .from("bitrix_installations")
    .select("client_endpoint, access_token, member_id")
    .eq("status", "active")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function fieldLabel(meta: any): string {
  if (!meta) return "";
  if (typeof meta.formLabel === "string") return meta.formLabel;
  if (typeof meta.listLabel === "string") return meta.listLabel;
  if (typeof meta.title === "string") return meta.title;
  return "";
}

function valueFromField(entity: any, fieldId: string): string {
  if (!entity) return "";
  const v = entity[fieldId];
  if (v === null || v === undefined) return "";
  // Multi-field array (EMAIL/PHONE/etc)
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    const first = v[0];
    if (first && typeof first === "object" && "VALUE" in first) return String(first.VALUE ?? "");
    return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);
    const tenantId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const install = await getInstallation(admin, tenantId);
    if (!install) return json({ error: "Instalação Bitrix24 não encontrada para este tenant." }, 404);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "list_fields") {
      const entityType = String(body.entity_type || "deal").toLowerCase();
      const conf = ENTITY_METHODS[entityType];
      if (!conf) return json({ error: "entity_type inválido" }, 400);

      const res = await callBitrix(install.client_endpoint, conf.fields, {}, install.access_token);
      if (res?.error) return json({ error: res.error_description || res.error }, 502);

      const fields = Object.entries(res.result || {}).map(([id, meta]: [string, any]) => ({
        id,
        label: fieldLabel(meta) || id,
        type: meta?.type || "string",
        is_custom: id.startsWith("UF_"),
      }));
      fields.sort((a, b) => {
        if (a.is_custom !== b.is_custom) return a.is_custom ? 1 : -1;
        return a.label.localeCompare(b.label);
      });
      return json({ success: true, fields });
    }

    if (action === "resolve") {
      const templateId = String(body.template_id || "");
      const entityType = String(body.entity_type || "").toLowerCase();
      const entityId = String(body.entity_id || "");
      if (!templateId || !entityType || !entityId) return json({ error: "template_id, entity_type, entity_id obrigatórios" }, 400);

      const { data: template } = await admin
        .from("contract_templates")
        .select("bitrix_field_map, asaas_billing_map")
        .eq("id", templateId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!template) return json({ error: "Template não encontrado" }, 404);

      const map = (template.bitrix_field_map || {}) as Record<string, { entity: string; field: string }>;
      const asaasMap = (template.asaas_billing_map || {}) as Record<string, { entity: string; field: string }>;
      const neededEntities = new Set<string>([entityType]);
      for (const m of [...Object.values(map), ...Object.values(asaasMap)]) {
        if (m?.entity) neededEntities.add(String(m.entity).toLowerCase());
      }

      // Always fetch primary entity first to resolve related IDs
      const primaryConf = ENTITY_METHODS[entityType];
      if (!primaryConf) return json({ error: "entity_type inválido" }, 400);
      const primaryRes = await callBitrix(install.client_endpoint, primaryConf.get, { id: entityId }, install.access_token);
      if (primaryRes?.error) return json({ error: primaryRes.error_description || primaryRes.error }, 502);
      const entities: Record<string, any> = { [entityType]: primaryRes.result };

      // Resolve related contact/company from a deal/lead if mapped
      const primary = primaryRes.result || {};
      const contactId = primary.CONTACT_ID || primary.CONTACT_IDS?.[0];
      const companyId = primary.COMPANY_ID;

      if (neededEntities.has("contact") && !entities.contact && contactId) {
        const r = await callBitrix(install.client_endpoint, "crm.contact.get", { id: contactId }, install.access_token);
        if (!r?.error) entities.contact = r.result;
      }
      if (neededEntities.has("company") && !entities.company && companyId) {
        const r = await callBitrix(install.client_endpoint, "crm.company.get", { id: companyId }, install.access_token);
        if (!r?.error) entities.company = r.result;
      }

      const customer: Record<string, string> = {};
      const extra_vars: Record<string, string> = {};
      let mapped = 0;
      for (const [placeholder, m] of Object.entries(map)) {
        const ent = entities[m.entity];
        if (!ent) continue;
        const val = valueFromField(ent, m.field);
        if (!val) continue;
        mapped++;
        const key = placeholder.replace(/[{}]/g, "").trim();
        if (key === "cliente_nome") customer.name = val;
        else if (key === "cliente_doc") customer.doc = val;
        else if (key === "cliente_email") customer.email = val;
        else if (key === "cliente_telefone") customer.phone = val;
        else if (key === "cliente_endereco") customer.address = val;
        else if (key === "cliente_empresa") customer.company_name = val;
        else extra_vars[key] = val;
      }

      // Fallback: build customer.name from NAME/LAST_NAME if mapping didn't fill it
      if (!customer.name) {
        const c = entities.contact || entities.lead || {};
        const parts = [c.NAME, c.LAST_NAME].filter(Boolean).join(" ").trim();
        if (parts) customer.name = parts;
      }

      // Resolve Asaas billing fields
      const asaas_billing: Record<string, string> = {};
      const asaas_billing_keys: string[] = [];
      for (const [key, m] of Object.entries(asaasMap)) {
        const ent = entities[m.entity];
        if (!ent) continue;
        const val = valueFromField(ent, m.field);
        if (!val) continue;
        asaas_billing[key] = val;
        asaas_billing_keys.push(key);
      }
      // Sensible fallbacks
      if (!asaas_billing.name && customer.name) asaas_billing.name = customer.name;
      if (!asaas_billing.cpfCnpj && customer.doc) asaas_billing.cpfCnpj = customer.doc;
      if (!asaas_billing.email && customer.email) asaas_billing.email = customer.email;
      if (!asaas_billing.mobilePhone && customer.phone) asaas_billing.mobilePhone = customer.phone;

      return json({ success: true, customer, extra_vars, asaas_billing, asaas_billing_keys, mapped_count: mapped });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    console.error("bitrix-contract-fields error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
