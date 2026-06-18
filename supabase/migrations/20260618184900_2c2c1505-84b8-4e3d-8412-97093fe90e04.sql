
-- Super admin policies on tenant_subscriptions
DROP POLICY IF EXISTS "Super admins manage all subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Super admins manage all subscriptions"
  ON public.tenant_subscriptions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can manage subscription_plans
DROP POLICY IF EXISTS "Super admins manage plans" ON public.subscription_plans;
CREATE POLICY "Super admins manage plans"
  ON public.subscription_plans
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can view all profiles
DROP POLICY IF EXISTS "Super admins view all profiles" ON public.profiles;
CREATE POLICY "Super admins view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can view all user_roles
DROP POLICY IF EXISTS "Super admins view all roles" ON public.user_roles;
CREATE POLICY "Super admins view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admin can view all integration_logs
DROP POLICY IF EXISTS "Super admins view all logs" ON public.integration_logs;
CREATE POLICY "Super admins view all logs"
  ON public.integration_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Update handle_new_user to auto-create trial subscription on Pro plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pro_plan_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, company_name, email, phone, bitrix_domain)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Minha Empresa'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'bitrix_domain'
  );

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Find Pro plan (by name, case insensitive)
  SELECT id INTO v_pro_plan_id
  FROM public.subscription_plans
  WHERE lower(name) = 'pro' AND is_active = true
  LIMIT 1;

  -- Create trial subscription (14 days on Pro)
  IF v_pro_plan_id IS NOT NULL THEN
    INSERT INTO public.tenant_subscriptions (
      tenant_id, plan_id, status,
      current_period_start, current_period_end, trial_ends_at
    )
    VALUES (
      NEW.id, v_pro_plan_id, 'trial',
      CURRENT_DATE, (CURRENT_DATE + INTERVAL '14 days')::date,
      now() + INTERVAL '14 days'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed super_admin roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users
WHERE email IN ('leonardo.zogbi@gmail.com', 'contato@thoth24.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill trial subscriptions for existing users without one
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, trial_ends_at)
SELECT p.id,
       (SELECT id FROM public.subscription_plans WHERE lower(name)='pro' AND is_active LIMIT 1),
       'trial',
       CURRENT_DATE,
       (CURRENT_DATE + INTERVAL '14 days')::date,
       now() + INTERVAL '14 days'
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = p.id)
  AND EXISTS (SELECT 1 FROM public.subscription_plans WHERE lower(name)='pro' AND is_active);
