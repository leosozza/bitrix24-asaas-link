import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const THOTH_ASAAS_API_KEY = Deno.env.get('THOTH_ASAAS_API_KEY') || '';
const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

const webhookUrl = `${SUPABASE_URL}/functions/v1/thoth-asaas-webhook`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      'access_token': THOTH_ASAAS_API_KEY,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function ensureWebhook() {
  if (!THOTH_ASAAS_API_KEY) return;
  const events = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_DELETED'];
  const list = await asaas('/webhooks');
  const items = (list.data?.data || []) as Array<{ id: string; url: string }>;
  if (items.find(w => w.url === webhookUrl)) return;
  await asaas('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      name: 'ConnectPay Thoth24 Billing',
      url: webhookUrl, email: 'contato@thoth24.com',
      enabled: true, interrupted: false, apiVersion: 3, sendType: 'SEQUENTIALLY', events,
    }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return new Response('OK', { headers: corsHeaders });

  try {
    if (!THOTH_ASAAS_API_KEY) return json({ error: 'THOTH_ASAAS_API_KEY not configured' }, 500);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'create_checkout';

    if (action === 'status') {
      const { data: sub } = await admin
        .from('tenant_subscriptions').select('*')
        .eq('tenant_id', userId).maybeSingle();
      return json({ success: true, subscription: sub });
    }

    if (action !== 'create_checkout') return json({ error: 'Invalid action' }, 400);

    const plan_id = String(body.plan_id || '');
    const cpf_cnpj = String(body.cpf_cnpj || '').replace(/\D/g, '');
    const billing_type = String(body.billing_type || 'PIX').toUpperCase();
    const phoneInput = String(body.phone || '').replace(/\D/g, '');

    if (!plan_id) return json({ error: 'plan_id required' }, 400);
    if (!cpf_cnpj || (cpf_cnpj.length !== 11 && cpf_cnpj.length !== 14)) {
      return json({ error: 'CPF/CNPJ inválido' }, 400);
    }
    if (!['PIX', 'CREDIT_CARD', 'BOLETO'].includes(billing_type)) {
      return json({ error: 'billing_type inválido' }, 400);
    }

    const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!profile) return json({ error: 'Profile not found' }, 404);

    const { data: plan } = await admin.from('subscription_plans').select('*').eq('id', plan_id).maybeSingle();
    if (!plan || !plan.is_active) return json({ error: 'Plan not found' }, 404);

    const { data: sub } = await admin.from('tenant_subscriptions').select('*').eq('tenant_id', userId).maybeSingle();
    if (!sub) return json({ error: 'Subscription not initialized' }, 404);

    // Update profile with CPF/CNPJ + phone for future use
    const profilePatch: Record<string, unknown> = { cpf_cnpj };
    if (phoneInput && !profile.phone) profilePatch.phone = phoneInput;
    await admin.from('profiles').update(profilePatch).eq('id', userId);

    // Cancel previous active asaas subscription if changing plan
    if (sub.asaas_subscription_id) {
      await asaas(`/subscriptions/${sub.asaas_subscription_id}`, { method: 'DELETE' });
    }

    // Find / create customer in Thoth Asaas
    let customerId = sub.asaas_customer_id as string | null;
    const searchByDoc = await asaas(`/customers?cpfCnpj=${cpf_cnpj}`);
    if (searchByDoc.ok && searchByDoc.data?.data?.length) {
      customerId = searchByDoc.data.data[0].id;
    } else {
      const create = await asaas('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: profile.company_name || profile.email,
          email: profile.email,
          cpfCnpj: cpf_cnpj,
          mobilePhone: phoneInput || profile.phone || undefined,
          externalReference: userId,
        }),
      });
      if (!create.ok) return json({ error: 'Falha ao criar cliente no Asaas', detail: create.data }, 400);
      customerId = create.data.id;
    }

    // Create subscription - first due tomorrow so invoice is generated immediately
    const nextDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const createSub = await asaas('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: billing_type,
        value: Number(plan.price),
        cycle: 'MONTHLY',
        nextDueDate: nextDue,
        description: `ConnectPay - Plano ${plan.name}`,
        externalReference: userId,
      }),
    });
    if (!createSub.ok) return json({ error: 'Falha ao criar assinatura no Asaas', detail: createSub.data }, 400);

    const asaasSubId = createSub.data.id;

    // Get first invoice for the subscription
    let invoiceUrl: string | null = null;
    let paymentId: string | null = null;
    const payments = await asaas(`/subscriptions/${asaasSubId}/payments`);
    if (payments.ok && payments.data?.data?.length) {
      const first = payments.data.data[0];
      invoiceUrl = first.invoiceUrl || null;
      paymentId = first.id || null;
    }

    // Persist on tenant_subscriptions
    await admin.from('tenant_subscriptions').update({
      plan_id,
      asaas_customer_id: customerId,
      asaas_subscription_id: asaasSubId,
      invoice_url: invoiceUrl,
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', userId);

    await admin.from('integration_logs').insert({
      tenant_id: userId,
      action: 'subscription_checkout_created',
      entity_type: 'subscription',
      entity_id: asaasSubId,
      status: 'success',
      request_data: { plan_id, billing_type } as any,
      response_data: { asaas_subscription_id: asaasSubId, invoice_url: invoiceUrl } as any,
    });

    // Make sure webhook is registered (idempotent)
    ensureWebhook().catch((e) => console.error('ensureWebhook error', e));

    return json({
      success: true,
      asaas_subscription_id: asaasSubId,
      customer_id: customerId,
      invoice_url: invoiceUrl,
      payment_id: paymentId,
      plan_name: plan.name,
      plan_price: plan.price,
    });
  } catch (e) {
    console.error('subscription-checkout error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
