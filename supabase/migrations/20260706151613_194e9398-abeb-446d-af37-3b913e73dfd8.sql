UPDATE public.tenant_subscriptions ts
SET status = 'active',
    trial_ends_at = NULL,
    current_period_start = CURRENT_DATE,
    current_period_end = (CURRENT_DATE + INTERVAL '1 month')::date,
    cancel_at_period_end = false,
    canceled_at = NULL,
    updated_at = now()
WHERE tenant_id = '42bacd0a-918a-4a1a-8283-8240d6be1b38'
  AND status = 'trial';