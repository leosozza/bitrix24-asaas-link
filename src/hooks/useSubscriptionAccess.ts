import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionAccess {
  hasAccess: boolean;
  status: string | null;
  reason: 'trial_expired' | 'suspended' | 'past_due' | 'canceled' | 'expired' | 'no_subscription' | 'ok' | null;
  subscription: {
    id: string;
    status: string;
    plan_id: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    invoice_url: string | null;
  } | null;
  plan: {
    id: string;
    name: string;
    price: number;
  } | null;
  daysUntilTrialEnd: number | null;
  loading: boolean;
}

export function useSubscriptionAccess(): SubscriptionAccess {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-access', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: sub } = await supabase
        .from('tenant_subscriptions')
        .select('id, status, plan_id, trial_ends_at, current_period_end, invoice_url')
        .eq('tenant_id', user!.id)
        .maybeSingle();

      let plan = null;
      if (sub?.plan_id) {
        const { data: p } = await supabase
          .from('subscription_plans')
          .select('id, name, price')
          .eq('id', sub.plan_id)
          .maybeSingle();
        plan = p;
      }
      return { sub, plan };
    },
  });

  const sub = data?.sub ?? null;
  const plan = data?.plan ?? null;

  let hasAccess = false;
  let reason: SubscriptionAccess['reason'] = 'no_subscription';
  let daysUntilTrialEnd: number | null = null;

  if (sub) {
    const now = Date.now();
    if (sub.status === 'trial') {
      const end = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
      if (end > now) {
        hasAccess = true;
        reason = 'ok';
        daysUntilTrialEnd = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
      } else {
        reason = 'trial_expired';
      }
    } else if (sub.status === 'active') {
      const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : Infinity;
      if (end >= new Date().setHours(0, 0, 0, 0)) {
        hasAccess = true;
        reason = 'ok';
      } else {
        reason = 'expired';
      }
    } else if (sub.status === 'suspended') {
      reason = 'suspended';
    } else if (sub.status === 'past_due') {
      reason = 'past_due';
    } else if (sub.status === 'cancelled') {
      reason = 'canceled';
    } else if (sub.status === 'expired') {
      reason = 'expired';
    }
  }

  return {
    hasAccess,
    status: sub?.status ?? null,
    reason,
    subscription: sub as SubscriptionAccess['subscription'],
    plan: plan as SubscriptionAccess['plan'],
    daysUntilTrialEnd,
    loading: isLoading,
  };
}
