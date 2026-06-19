ALTER TABLE public.tenant_subscriptions ADD COLUMN IF NOT EXISTS invoice_url text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;