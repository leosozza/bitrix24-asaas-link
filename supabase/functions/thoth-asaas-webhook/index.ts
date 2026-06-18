import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AsaasWebhookPayment {
  id: string;
  customer: string;
  value: number;
  status: string;
  billingType: string;
  paymentDate?: string;
  subscription?: string;
  invoiceUrl?: string;
  externalReference?: string;
}

interface AsaasWebhookSubscription {
  id: string;
  customer: string;
  value: number;
  status: string;
  cycle: string;
  billingType: string;
  nextDueDate?: string;
  description?: string;
}

interface AsaasWebhookEvent {
  event: string;
  payment?: AsaasWebhookPayment;
  subscription?: AsaasWebhookSubscription;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const event: AsaasWebhookEvent = await req.json().catch(() => ({}));
    console.log('Thoth Asaas webhook event:', event.event);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Only handle payment and subscription events that relate to our tenant subscriptions
    const relevantEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_DELETED'];
    if (!relevantEvents.includes(event.event)) {
      return json({ success: true, message: 'Event ignored' });
    }

    const subscriptionId = event.payment?.subscription || event.subscription?.id;
    if (!subscriptionId) {
      return json({ success: true, message: 'No subscription id' });
    }

    const { data: tenantSub } = await supabase
      .from('tenant_subscriptions')
      .select('*, profiles:tenant_id(id, company_name, email)')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle();

    if (!tenantSub) {
      console.log('Tenant subscription not found for Asaas subscription:', subscriptionId);
      return json({ success: true, message: 'Tenant subscription not found' });
    }

    const tenantId = tenantSub.tenant_id;

    // Idempotency: skip if this exact event was already processed successfully
    const { data: prevLog } = await supabase
      .from('integration_logs')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('action', `thoth_asaas_webhook_${event.event.toLowerCase()}`)
      .eq('entity_id', subscriptionId)
      .eq('status', 'success')
      .limit(1)
      .maybeSingle();

    if (prevLog) {
      return json({ success: true, message: 'Already processed' });
    }

    let update: Record<string, unknown> = {};
    let statusNote = '';

    if (event.event.startsWith('PAYMENT_')) {
      const payment = event.payment!;
      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        update.status = 'active';
        update.current_period_start = new Date().toISOString().split('T')[0];
        update.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        statusNote = 'Payment confirmed, new period started';
      } else if (payment.status === 'OVERDUE') {
        update.status = 'past_due';
        statusNote = 'Payment overdue';
      }
    } else if (event.event === 'SUBSCRIPTION_UPDATED') {
      const sub = event.subscription!;
      const statusMap: Record<string, string> = { ACTIVE: 'active', INACTIVE: 'canceled', EXPIRED: 'expired' };
      update.status = statusMap[sub.status] || sub.status.toLowerCase();
      if (sub.nextDueDate) update.current_period_end = sub.nextDueDate;
      statusNote = `Subscription updated to ${sub.status}`;
    } else if (event.event === 'SUBSCRIPTION_DELETED') {
      update.status = 'canceled';
      update.canceled_at = new Date().toISOString();
      update.cancel_at_period_end = false;
      statusNote = 'Subscription deleted';
    }

    if (Object.keys(update).length > 0) {
      update.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('tenant_subscriptions')
        .update(update)
        .eq('id', tenantSub.id);

      if (updateError) throw updateError;
    }

    await supabase.from('integration_logs').insert({
      tenant_id: tenantId,
      action: `thoth_asaas_webhook_${event.event.toLowerCase()}`,
      entity_type: 'tenant_subscription',
      entity_id: subscriptionId,
      status: 'success',
      request_data: event as any,
      response_data: { update, note: statusNote },
    });

    return json({ success: true, event: event.event, tenant_id: tenantId });
  } catch (e) {
    console.error('thoth-asaas-webhook error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
