CREATE OR REPLACE FUNCTION public.tenant_has_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_subscriptions ts
    WHERE ts.tenant_id = _user_id
      AND ts.status IN ('trial', 'active')
      AND (
        (ts.status = 'trial' AND ts.trial_ends_at IS NOT NULL AND ts.trial_ends_at > now())
        OR (ts.status = 'active' AND (ts.current_period_end IS NULL OR ts.current_period_end >= CURRENT_DATE))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_access(uuid) TO authenticated, service_role;