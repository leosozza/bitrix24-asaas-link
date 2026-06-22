ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS asaas_billing_map jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS asaas_billing_type text,
  ADD COLUMN IF NOT EXISTS asaas_charge_mode text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_cycle text,
  ADD COLUMN IF NOT EXISTS asaas_customer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_installment_id text,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url text,
  ADD COLUMN IF NOT EXISTS asaas_bank_slip_url text,
  ADD COLUMN IF NOT EXISTS auto_create_charge boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS installment_count integer;

CREATE INDEX IF NOT EXISTS idx_contracts_asaas_payment ON public.contracts(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_asaas_subscription ON public.contracts(asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;