import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function baseUrl(env: string) {
  return env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const log: string[] = [];
  const push = (s: string) => { log.push(s); console.log(s); };

  try {
    const { tenant_id, billing_type = 'PIX' } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    push('1/4 Buscando configuração Asaas...');
    const { data: cfg, error: cfgErr } = await supabase
      .from('asaas_configurations')
      .select('api_key, environment')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    if (cfgErr || !cfg?.api_key) {
      return new Response(JSON.stringify({
        success: false, error: 'Asaas não configurado para este tenant', log,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const url = baseUrl(cfg.environment);
    push(`   ✓ Ambiente: ${cfg.environment} (${url})`);

    push('2/4 Validando API key (GET /myAccount)...');
    const acc = await fetch(`${url}/myAccount`, { headers: { access_token: cfg.api_key } });
    const accBody = await acc.json().catch(() => ({}));
    if (!acc.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `API key inválida: ${accBody?.errors?.[0]?.description || acc.statusText}`,
        log, account: accBody,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    push(`   ✓ Conta: ${accBody?.name || accBody?.email || 'OK'}`);

    push('3/4 Criando cliente de teste...');
    const custRes = await fetch(`${url}/customers`, {
      method: 'POST',
      headers: { access_token: cfg.api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cliente Teste Assas Pay by Thoth',
        cpfCnpj: '24971563792', // CPF de teste válido
        email: 'teste@connectpay.app',
      }),
    });
    const customer = await custRes.json();
    if (!custRes.ok || !customer.id) {
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao criar cliente: ${customer?.errors?.[0]?.description || custRes.statusText}`,
        log, customer,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    push(`   ✓ Cliente: ${customer.id}`);

    push(`4/4 Criando cobrança de teste (${billing_type}, R$ 5,00)...`);
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const payRes = await fetch(`${url}/payments`, {
      method: 'POST',
      headers: { access_token: cfg.api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customer.id,
        billingType: billing_type,
        value: 5.00,
        dueDate: due.toISOString().slice(0, 10),
        description: 'Cobrança de teste - Assas Pay by Thoth (Lovable)',
        externalReference: `test-${Date.now()}`,
      }),
    });
    const payment = await payRes.json();
    if (!payRes.ok || !payment.id) {
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao criar cobrança: ${payment?.errors?.[0]?.description || payRes.statusText}`,
        log, payment,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    push(`   ✓ Cobrança: ${payment.id} - ${payment.status}`);

    return new Response(JSON.stringify({
      success: true,
      log,
      environment: cfg.environment,
      account: { name: accBody?.name, email: accBody?.email },
      customer: { id: customer.id, name: customer.name },
      payment: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('asaas-test-charge error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg, log }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
