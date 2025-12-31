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
  apiKey: string;
  environment: 'sandbox' | 'production';
  memberId: string;
  domain: string;
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
    const { apiKey, environment, memberId, domain } = body;

    console.log('Config for domain:', domain, 'memberId:', memberId, 'environment:', environment);

    if (!apiKey || !environment) {
      return new Response(JSON.stringify({ error: 'API Key e ambiente são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no memberId, we can't find the installation
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
    console.log('Saving config for tenant:', tenantId);

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

    if (existingConfig) {
      // Update existing config
      const { error: updateError } = await supabase
        .from('asaas_configurations')
        .update({
          api_key: apiKey,
          environment,
          is_active: true,
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
      // Insert new config
      const { error: insertError } = await supabase
        .from('asaas_configurations')
        .insert({
          tenant_id: tenantId,
          api_key: apiKey,
          environment,
          is_active: true,
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
      message: 'Configuração salva com sucesso! Seus pagamentos estão prontos.'
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
