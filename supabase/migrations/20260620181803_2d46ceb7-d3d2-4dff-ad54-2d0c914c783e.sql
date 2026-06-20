
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  body_html text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manage_templates" ON public.contract_templates
  FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE INDEX idx_contract_templates_tenant ON public.contract_templates(tenant_id);
CREATE TRIGGER trg_contract_templates_updated BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  asaas_subscription_id text,
  asaas_customer_id text,
  bitrix_entity_type text,
  bitrix_entity_id text,
  customer_name text NOT NULL,
  customer_doc text,
  customer_email text,
  customer_phone text,
  customer_address text,
  company_name text,
  total_value numeric(12,2) NOT NULL DEFAULT 0,
  contract_term text,
  salesperson_name text,
  payment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_html text NOT NULL,
  pdf_storage_path text,
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_ip text,
  signed_user_agent text,
  signature_name text,
  signature_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manage_contracts" ON public.contracts
  FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE UNIQUE INDEX idx_contracts_public_token ON public.contracts(public_token);
CREATE INDEX idx_contracts_tenant ON public.contracts(tenant_id);
CREATE INDEX idx_contracts_bitrix ON public.contracts(bitrix_entity_type, bitrix_entity_id);
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
