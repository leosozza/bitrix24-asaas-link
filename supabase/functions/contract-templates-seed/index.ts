// Seed 5 default contract templates for the authenticated tenant.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_TEMPLATES } from "../_shared/contract-default-templates.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);
    const tenantId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await admin
      .from("contract_templates")
      .select("name, cover_style")
      .eq("tenant_id", tenantId);

    const existingStyles = new Set((existing || []).map((t: any) => t.cover_style).filter(Boolean));
    const existingNames = new Set((existing || []).map((t: any) => t.name));

    const hasAnyDefault = (existing || []).length > 0;
    const inserts = DEFAULT_TEMPLATES
      .filter((t) => !existingStyles.has(t.cover_style) && !existingNames.has(t.name))
      .map((t) => ({
        tenant_id: tenantId,
        name: t.name,
        description: t.description,
        body_html: t.body_html,
        cover_style: t.cover_style,
        is_default: !hasAnyDefault && !!t.is_default,
        bitrix_field_map: t.bitrix_field_map ?? {},
      }));

    if (inserts.length === 0) {
      return json({ success: true, inserted: 0, message: "Todos os modelos prontos já estão carregados." });
    }

    const { error } = await admin.from("contract_templates").insert(inserts);
    if (error) throw error;

    return json({ success: true, inserted: inserts.length });
  } catch (e) {
    console.error("contract-templates-seed error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
