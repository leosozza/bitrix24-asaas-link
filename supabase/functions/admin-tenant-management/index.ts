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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET') return new Response('OK', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    // Verify user via anon client + JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check super_admin role
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden: super_admin only' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    const logAction = async (act: string, payload: unknown, status: 'success' | 'error', resp?: unknown) => {
      await admin.from('integration_logs').insert({
        tenant_id: body.tenant_id || userId,
        action: `admin_${act}`,
        entity_type: 'admin',
        entity_id: body.tenant_id || null,
        status,
        request_data: payload as any,
        response_data: (resp ?? null) as any,
      });
    };

    switch (action) {
      case 'list_tenants': {
        const { data: profiles } = await admin
          .from('profiles')
          .select('id, company_name, email, phone, bitrix_domain, created_at')
          .order('created_at', { ascending: false });

        const ids = (profiles || []).map(p => p.id);
        const { data: subs } = await admin
          .from('tenant_subscriptions')
          .select('*')
          .in('tenant_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        const { data: plans } = await admin.from('subscription_plans').select('*');
        const { data: installs } = await admin
          .from('bitrix_installations')
          .select('tenant_id, domain, status')
          .in('tenant_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

        const planMap = new Map((plans || []).map(p => [p.id, p]));
        const subMap = new Map((subs || []).map(s => [s.tenant_id, s]));
        const instMap = new Map((installs || []).map(i => [i.tenant_id, i]));

        const tenants = (profiles || []).map(p => {
          const s = subMap.get(p.id);
          const plan = s ? planMap.get(s.plan_id) : null;
          return {
            ...p,
            subscription: s || null,
            plan: plan || null,
            bitrix: instMap.get(p.id) || null,
          };
        });

        return json({ success: true, tenants, plans: plans || [] });
      }

      case 'get_tenant': {
        const tenantId = body.tenant_id;
        if (!tenantId) return json({ error: 'tenant_id required' }, 400);
        const { data: profile } = await admin.from('profiles').select('*').eq('id', tenantId).maybeSingle();
        const { data: sub } = await admin.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle();
        const { data: plan } = sub ? await admin.from('subscription_plans').select('*').eq('id', sub.plan_id).maybeSingle() : { data: null };
        const { data: install } = await admin.from('bitrix_installations').select('*').eq('tenant_id', tenantId).maybeSingle();
        const { data: txCount } = await admin.from('transactions').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
        const { data: logs } = await admin.from('integration_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
        return json({ success: true, profile, subscription: sub, plan, bitrix: install, transactions_count: (txCount as any) ?? null, logs: logs || [] });
      }

      case 'change_plan': {
        const { tenant_id, plan_id } = body;
        if (!tenant_id || !plan_id) return json({ error: 'tenant_id and plan_id required' }, 400);
        const { data: plan } = await admin.from('subscription_plans').select('*').eq('id', plan_id).maybeSingle();
        if (!plan) return json({ error: 'Plan not found' }, 404);
        const { error } = await admin
          .from('tenant_subscriptions')
          .update({ plan_id, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenant_id);
        if (error) { await logAction('change_plan', body, 'error', error.message); return json({ error: error.message }, 400); }
        await logAction('change_plan', body, 'success', { plan_name: plan.name });
        return json({ success: true });
      }

      case 'extend_trial': {
        const { tenant_id, days } = body;
        if (!tenant_id || !days) return json({ error: 'tenant_id and days required' }, 400);
        const { data: sub } = await admin.from('tenant_subscriptions').select('*').eq('tenant_id', tenant_id).maybeSingle();
        if (!sub) return json({ error: 'Subscription not found' }, 404);
        const base = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
        const newTrial = new Date(base.getTime() + Number(days) * 24 * 60 * 60 * 1000);
        const newPeriodEnd = new Date(new Date(sub.current_period_end).getTime() + Number(days) * 24 * 60 * 60 * 1000);
        const { error } = await admin
          .from('tenant_subscriptions')
          .update({
            trial_ends_at: newTrial.toISOString(),
            current_period_end: newPeriodEnd.toISOString().split('T')[0],
            status: 'trial',
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenant_id);
        if (error) { await logAction('extend_trial', body, 'error', error.message); return json({ error: error.message }, 400); }
        await logAction('extend_trial', body, 'success', { new_trial_ends_at: newTrial.toISOString() });
        return json({ success: true, trial_ends_at: newTrial.toISOString() });
      }

      case 'cancel_subscription': {
        const { tenant_id, immediate } = body;
        if (!tenant_id) return json({ error: 'tenant_id required' }, 400);
        const { data: sub } = await admin.from('tenant_subscriptions').select('*').eq('tenant_id', tenant_id).maybeSingle();
        if (!sub) return json({ error: 'Subscription not found' }, 404);

        // Cancel in Asaas if there's a subscription id
        if (sub.asaas_subscription_id && THOTH_ASAAS_API_KEY) {
          await asaas(`/subscriptions/${sub.asaas_subscription_id}`, { method: 'DELETE' });
        }

        const update: Record<string, unknown> = {
          cancel_at_period_end: !immediate,
          updated_at: new Date().toISOString(),
        };
        if (immediate) { update.status = 'canceled'; update.canceled_at = new Date().toISOString(); }

        const { error } = await admin.from('tenant_subscriptions').update(update).eq('tenant_id', tenant_id);
        if (error) { await logAction('cancel_subscription', body, 'error', error.message); return json({ error: error.message }, 400); }
        await logAction('cancel_subscription', body, 'success', update);
        return json({ success: true });
      }

      case 'reactivate': {
        const { tenant_id } = body;
        if (!tenant_id) return json({ error: 'tenant_id required' }, 400);
        const { error } = await admin
          .from('tenant_subscriptions')
          .update({
            status: 'active',
            cancel_at_period_end: false,
            canceled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenant_id);
        if (error) { await logAction('reactivate', body, 'error', error.message); return json({ error: error.message }, 400); }
        await logAction('reactivate', body, 'success', null);
        return json({ success: true });
      }

      case 'update_notes': {
        const { tenant_id, notes } = body;
        if (!tenant_id) return json({ error: 'tenant_id required' }, 400);
        const { error } = await admin
          .from('tenant_subscriptions')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenant_id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case 'update_plan_details': {
        const { plan_id, name, price, transaction_limit, features, is_active } = body;
        if (!plan_id) return json({ error: 'plan_id required' }, 400);
        const patch: Record<string, unknown> = {};
        if (name !== undefined) patch.name = name;
        if (price !== undefined) patch.price = price;
        if (transaction_limit !== undefined) patch.transaction_limit = transaction_limit;
        if (features !== undefined) patch.features = features;
        if (is_active !== undefined) patch.is_active = is_active;
        const { error } = await admin.from('subscription_plans').update(patch).eq('id', plan_id);
        if (error) return json({ error: error.message }, 400);
        await logAction('update_plan_details', body, 'success', patch);
        return json({ success: true });
      }

      case 'create_asaas_subscription': {
        if (!THOTH_ASAAS_API_KEY) return json({ error: 'THOTH_ASAAS_API_KEY not configured' }, 400);
        const { tenant_id, billing_type = 'BOLETO', cpf_cnpj } = body;
        if (!tenant_id) return json({ error: 'tenant_id required' }, 400);

        const { data: profile } = await admin.from('profiles').select('*').eq('id', tenant_id).maybeSingle();
        const { data: sub } = await admin.from('tenant_subscriptions').select('*').eq('tenant_id', tenant_id).maybeSingle();
        if (!profile || !sub) return json({ error: 'Tenant/subscription not found' }, 404);
        const { data: plan } = await admin.from('subscription_plans').select('*').eq('id', sub.plan_id).maybeSingle();
        if (!plan) return json({ error: 'Plan not found' }, 404);

        // Find or create customer in Thoth24 Asaas
        let customerId = sub.asaas_customer_id as string | null;
        if (!customerId) {
          const doc = (cpf_cnpj || '').replace(/\D/g, '');
          if (!doc) return json({ error: 'cpf_cnpj required (no customer linked yet)' }, 400);
          const search = await asaas(`/customers?cpfCnpj=${doc}`);
          if (search.ok && search.data?.data?.length) {
            customerId = search.data.data[0].id;
          } else {
            const create = await asaas('/customers', {
              method: 'POST',
              body: JSON.stringify({
                name: profile.company_name || profile.email,
                email: profile.email,
                cpfCnpj: doc,
                mobilePhone: profile.phone || undefined,
              }),
            });
            if (!create.ok) { await logAction('create_asaas_subscription', body, 'error', create.data); return json({ error: 'Failed to create customer', detail: create.data }, 400); }
            customerId = create.data.id;
          }
        }

        const nextDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const createSub = await asaas('/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            customer: customerId,
            billingType: billing_type.toUpperCase(),
            value: Number(plan.price),
            cycle: 'MONTHLY',
            nextDueDate: nextDue,
            description: `ConnectPay - Plano ${plan.name}`,
          }),
        });
        if (!createSub.ok) { await logAction('create_asaas_subscription', body, 'error', createSub.data); return json({ error: 'Failed to create subscription', detail: createSub.data }, 400); }

        await admin.from('tenant_subscriptions').update({
          asaas_customer_id: customerId,
          asaas_subscription_id: createSub.data.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('tenant_id', tenant_id);

        await logAction('create_asaas_subscription', body, 'success', { subscription_id: createSub.data.id });
        return json({ success: true, asaas_subscription_id: createSub.data.id, customer_id: customerId });
      }

      default:
        return json({ error: 'Invalid action' }, 400);
    }
  } catch (e) {
    console.error('admin-tenant-management error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
