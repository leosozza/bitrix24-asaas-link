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

// Webhook registration logic extracted for reuse
async function registerAsaasWebhook(apiKey: string, environment: string): Promise<{ webhookId: string | null; webhookSecret: string | null }> {
  const baseUrl = environment === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';
  
  const webhookUrl = `${SUPABASE_URL}/functions/v1/asaas-webhook`;
  console.log('Registering webhook at URL:', webhookUrl);
  
  let webhookId: string | null = null;
  let webhookSecret: string | null = null;
  
  const webhookEvents = [
    'PAYMENT_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED',
    'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED',
    'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_DELETED',
    'INVOICE_AUTHORIZED', 'INVOICE_ERROR', 'INVOICE_CANCELED'
  ];

  // List existing webhooks
  const listResponse = await fetch(`${baseUrl}/webhooks`, {
    headers: { 'access_token': apiKey },
  });

  if (listResponse.ok) {
    const webhookList = await listResponse.json();
    console.log('Existing webhooks:', JSON.stringify(webhookList.data?.map((w: { id: string; url: string }) => ({ id: w.id, url: w.url }))));

    // Check for existing webhook with correct URL
    const existingWebhook = webhookList.data?.find((wh: { url: string }) => wh.url === webhookUrl);

    if (existingWebhook) {
      webhookId = existingWebhook.id;
      webhookSecret = existingWebhook.authToken || null;
      console.log('Webhook already registered:', webhookId);
    } else {
      // Delete any old webhooks pointing to wrong URLs (cleanup)
      const oldWebhooks = webhookList.data?.filter((wh: { url: string }) => 
        wh.url.includes('asaas-webhook') && wh.url !== webhookUrl
      ) || [];
      for (const old of oldWebhooks) {
        console.log('Deleting old webhook:', old.id, old.url);
        await fetch(`${baseUrl}/webhooks/${old.id}`, {
          method: 'DELETE',
          headers: { 'access_token': apiKey },
        });
      }

      // Register new webhook
      const authToken = crypto.randomUUID();
      const webhookPayload = {
        url: webhookUrl,
        email: 'webhook@connectpay.app',
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken,
        sendType: 'SEQUENTIALLY',
        events: webhookEvents
      };

      console.log('Registering new webhook with payload:', JSON.stringify(webhookPayload));

      const webhookResponse = await fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      const webhookResponseText = await webhookResponse.text();
      console.log('Webhook registration response status:', webhookResponse.status);
      console.log('Webhook registration response:', webhookResponseText);

      if (webhookResponse.ok) {
        const webhookData = JSON.parse(webhookResponseText);
        webhookId = webhookData.id;
        webhookSecret = webhookData.authToken || authToken;
        console.log('Webhook registered successfully:', webhookId);
      } else {
        console.error('Failed to register webhook:', webhookResponseText);
      }
    }
  } else {
    console.error('Failed to list webhooks:', await listResponse.text());
  }

  return { webhookId, webhookSecret };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Config Handler called');

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

    // Find installation and get tenant_id
    const { data: installation, error: installError } = await supabase
      .from('bitrix_installations')
      .select('tenant_id')
      .eq('member_id', memberId)
      .single();

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

    // ========== REPAIR WEBHOOK ACTION ==========
    if (action === 'repair_webhook') {
      console.log('Repair webhook for tenant:', tenantId);

      // Get existing config
      const { data: existingConfig, error: configError } = await supabase
        .from('asaas_configurations')
        .select('api_key, environment')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (configError || !existingConfig || !existingConfig.api_key) {
        return new Response(JSON.stringify({ error: 'Configuração do Asaas não encontrada. Configure a API Key primeiro.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const { webhookId, webhookSecret } = await registerAsaasWebhook(existingConfig.api_key, existingConfig.environment);

        // Update config with webhook info
        await supabase
          .from('asaas_configurations')
          .update({
            webhook_id: webhookId,
            webhook_secret: webhookSecret,
            webhook_configured: !!webhookId,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);

        return new Response(JSON.stringify({
          success: true,
          message: webhookId
            ? 'Webhook reparado com sucesso! As notificações de pagamento serão recebidas automaticamente.'
            : 'Não foi possível registrar o webhook. Verifique sua API Key.',
          webhookConfigured: !!webhookId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (webhookErr) {
        console.error('Error repairing webhook:', webhookErr);
        return new Response(JSON.stringify({ error: 'Erro ao reparar webhook. Tente novamente.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========== SAVE CONFIG ACTION (default) ==========
    const { apiKey, environment, domain } = body;

    if (!apiKey || !environment) {
      return new Response(JSON.stringify({ error: 'API Key e ambiente são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Saving config for tenant:', tenantId, 'environment:', environment);

    // Validate API key by making a test request to Asaas
    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    try {
      const testResponse = await fetch(`${baseUrl}/finance/balance`, {
        headers: { 'access_token': apiKey },
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json().catch(() => ({}));
        console.error('Asaas API validation failed:', errorData);
        return new Response(JSON.stringify({ 
          error: 'Chave API inválida. Verifique se está usando a chave correta para o ambiente selecionado.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('Asaas API key validated successfully');
    } catch (fetchError) {
      console.error('Error validating Asaas API:', fetchError);
      // Continue anyway - might be network issue
    }

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('asaas_configurations')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    // Register webhook using shared function
    let webhookId: string | null = null;
    let webhookSecret: string | null = null;
    
    try {
      const result = await registerAsaasWebhook(apiKey!, environment!);
      webhookId = result.webhookId;
      webhookSecret = result.webhookSecret;
    } catch (webhookErr) {
      console.error('Error registering webhook:', webhookErr);
    }

    if (existingConfig) {
      const { error: updateError } = await supabase
        .from('asaas_configurations')
        .update({
          api_key: apiKey,
          environment,
          is_active: true,
          webhook_id: webhookId,
          webhook_secret: webhookSecret,
          webhook_configured: !!webhookId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Update config error:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar configuração' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Config updated for tenant:', tenantId);
    } else {
      const { error: insertError } = await supabase
        .from('asaas_configurations')
        .insert({
          tenant_id: tenantId,
          api_key: apiKey,
          environment,
          is_active: true,
          webhook_id: webhookId,
          webhook_secret: webhookSecret,
          webhook_configured: !!webhookId,
        });

      if (insertError) {
        console.error('Insert config error:', insertError);
        return new Response(JSON.stringify({ error: 'Erro ao salvar configuração' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Config created for tenant:', tenantId);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: webhookId 
        ? 'Configuração salva! Webhook configurado automaticamente para receber notificações de pagamento.'
        : 'Configuração salva! Configure o webhook manualmente no painel do Asaas.',
      webhookConfigured: !!webhookId
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
