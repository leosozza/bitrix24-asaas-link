
CREATE TABLE IF NOT EXISTS public.contract_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bitrix_entity_type text NOT NULL,
  bitrix_entity_id text NOT NULL,
  customer_name text,
  customer_email text,
  customer_document text,
  contract_start date NOT NULL,
  contract_end date NOT NULL,
  payment_method text NOT NULL,
  entry_value numeric DEFAULT 0,
  entry_installments int DEFAULT 0,
  entry_first_due date,
  recurring_value numeric DEFAULT 0,
  cycle text,
  weekday int,
  monthday int,
  asaas_subscription_id text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_plans TO authenticated;
GRANT ALL ON public.contract_plans TO service_role;

ALTER TABLE public.contract_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own contract plans"
  ON public.contract_plans FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Tenants insert own contract plans"
  ON public.contract_plans FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants update own contract plans"
  ON public.contract_plans FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid());

CREATE TRIGGER contract_plans_updated_at
  BEFORE UPDATE ON public.contract_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bitrix_installations
  ADD COLUMN IF NOT EXISTS custom_fields_created boolean NOT NULL DEFAULT false;
