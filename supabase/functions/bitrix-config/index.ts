import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ConfigRequest {
  apiKey?: string;
  environment?: 'sandbox' | 'production';
  memberId: string;
  domain?: string;
  action?: 'save' | 'repair_webhook';
}

const WEBHOOK_EVENTS = [
  'PAYMENT_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED',
  'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_DELETED',
  'INVOICE_AUTHORIZED', 'INVOICE_ERROR', 'INVOICE_CANCELED',
];

interface WebhookResult {
  webhookId: string | null;
  webhookSecret: string | null;
  webhookUrl: string;
  events: string[];
  error?: string;
}

async function listAllWebhooks(apiKey: string, baseUrl: string): Promise<Array<{ id: string; url: string; authToken?: string }>> {
  const all: Array<{ id: string; url: string; authToken?: string }> = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(`${baseUrl}/webhooks?limit=${limit}&offset=${offset}`, {
      headers: { 'access_token': apiKey },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Falha ao listar webhooks: ${errText}`);
    }
    const json = await res.json();
    const items = json.data || [];
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }
  return all;
}

async function registerAsaasWebhook(
  apiKey: string,
  environment: string,
  email: string,
): Promise<WebhookResult> {
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  const webhookUrl = `${SUPABASE_URL}/functions/v1/asaas-webhook`;
  console.log('Registering webhook at URL:', webhookUrl, 'email:', email);

  let webhookId: string | null = null;
  let webhookSecret: string | null = null;

  try {
    const existing = await listAllWebhooks(apiKey, baseUrl);
    console.log('Found', existing.length, 'existing webhooks');

    const match = existing.find((wh) => wh.url === webhookUrl);
    if (match) {
      webhookId = match.id;
      webhookSecret = match.authToken || null;
      console.log('Webhook already registered:', webhookId);
      return { webhookId, webhookSecret, webhookUrl, events: WEBHOOK_EVENTS };
    }

    // Cleanup old webhooks pointing to wrong URLs
    const stale = existing.filter((wh) => wh.url.includes('asaas-webhook') && wh.url !== webhookUrl);
    for (const old of stale) {
      console.log('Deleting old webhook:', old.id, old.url);
      await fetch(`${baseUrl}/webhooks/${old.id}`, {
        method: 'DELETE',
        headers: { 'access_token': apiKey },
      });
    }

    const authToken = crypto.randomUUID();
    const payload = {
      name: 'Asaas → Bitrix24 (Lovable)',
      url: webhookUrl,
      email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken,
      sendType: 'SEQUENTIALLY',
      events: WEBHOOK_EVENTS,
    };

    console.log('Registering new webhook payload:', JSON.stringify({ ...payload, authToken: '***' }));

    const res = await fetch(`${baseUrl}/webhooks`, {
      method: 'POST',
      headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('Webhook registration response:', res.status, text);

    if (!res.ok) {
      let errMsg = `Asaas retornou ${res.status}`;
      try {
        const errJson = JSON.parse(text);
        errMsg = errJson.errors?.[0]?.description || errJson.message || errMsg;
      } catch {
        // keep default
      }
      return { webhookId: null, webhookSecret: null, webhookUrl, events: WEBHOOK_EVENTS, error: errMsg };
    }

    const data = JSON.parse(text);
    webhookId = data.id;
    webhookSecret = data.authToken || authToken;
    console.log('Webhook registered successfully:', webhookId);
    return { webhookId, webhookSecret, webhookUrl, events: WEBHOOK_EVENTS };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error registering webhook:', msg);
    return { webhookId: null, webhookSecret: null, webhookUrl, events: WEBHOOK_EVENTS, error: msg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ConfigRequest = await req.json();
    const { memberId, action } = body;
    console.log('Config action:', action || 'save', 'memberId:', memberId);

    if (!memberId) {
      return new Response(JSON.stringify({ error: 'Identificação da instalação não encontrada. Recarregue a página.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: installation, error: installError } = await supabase
      .from('bitrix_installations')
      .select('tenant_id')
      .eq('member_id', memberId)
      .maybeSingle();

    if (installError || !installation) {
      console.error('Installation not found:', installError);
      return new Response(JSON.stringify({ error: 'Instalação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!installation.tenant_id) {
      return new Response(JSON.stringify({ error: 'Instalação não vinculada a uma conta. Faça login primeiro.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = installation.tenant_id;

    // Fetch tenant email for webhook notifications
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', tenantId)
      .maybeSingle();

    const webhookEmail = profile?.email || 'webhook@asaas.thoth24.com';

    // ========== REPAIR WEBHOOK ==========
    if (action === 'repair_webhook') {
      const { data: existingConfig, error: configError } = await supabase
        .from('asaas_configurations')
        .select('api_key, environment')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle();

      if (configError || !existingConfig?.api_key) {
        return new Response(JSON.stringify({ error: 'Configuração do Asaas não encontrada. Configure a API Key primeiro.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await registerAsaasWebhook(existingConfig.api_key, existingConfig.environment, webhookEmail);

      await supabase
        .from('asaas_configurations')
        .update({
          webhook_id: result.webhookId,
          webhook_secret: result.webhookSecret,
          webhook_configured: !!result.webhookId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      return new Response(JSON.stringify({
        success: true,
        message: result.webhookId
          ? 'Webhook registrado com sucesso!'
          : `Não foi possível registrar automaticamente${result.error ? ': ' + result.error : ''}. Copie a URL abaixo e configure manualmente no painel Asaas.`,
        webhookConfigured: !!result.webhookId,
        webhookUrl: result.webhookUrl,
        webhookSecret: result.webhookSecret,
        webhookEvents: result.events,
        webhookError: result.error || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== SAVE CONFIG ==========
    const { apiKey, environment } = body;

    if (!apiKey || !environment) {
      return new Response(JSON.stringify({ error: 'API Key e ambiente são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Validate API key
    try {
      const testResponse = await fetch(`${baseUrl}/finance/balance`, {
        headers: { 'access_token': apiKey },
      });

      if (!testResponse.ok) {
        return new Response(JSON.stringify({
          error: 'Chave API inválida. Verifique se está usando a chave correta para o ambiente selecionado.',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (fetchError) {
      console.error('Error validating Asaas API:', fetchError);
    }

    const { data: existingConfig } = await supabase
      .from('asaas_configurations')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const result = await registerAsaasWebhook(apiKey, environment, webhookEmail);

    const configPayload = {
      api_key: apiKey,
      environment,
      is_active: true,
      webhook_id: result.webhookId,
      webhook_secret: result.webhookSecret,
      webhook_configured: !!result.webhookId,
      updated_at: new Date().toISOString(),
    };

    if (existingConfig) {
      const { error: updateError } = await supabase
        .from('asaas_configurations')
        .update(configPayload)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Update config error:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar configuração' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const { error: insertError } = await supabase
        .from('asaas_configurations')
        .insert({ tenant_id: tenantId, ...configPayload });

      if (insertError) {
        console.error('Insert config error:', insertError);
        return new Response(JSON.stringify({ error: 'Erro ao salvar configuração' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: result.webhookId
        ? 'Configuração salva! Webhook registrado automaticamente.'
        : `Configuração salva, mas o webhook precisa ser cadastrado manualmente${result.error ? ' (' + result.error + ')' : ''}. Copie a URL e o Token abaixo no painel Asaas → Integrações → Webhooks.`,
      webhookConfigured: !!result.webhookId,
      webhookUrl: result.webhookUrl,
      webhookSecret: result.webhookSecret,
      webhookEvents: result.events,
      webhookError: result.error || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-config:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
