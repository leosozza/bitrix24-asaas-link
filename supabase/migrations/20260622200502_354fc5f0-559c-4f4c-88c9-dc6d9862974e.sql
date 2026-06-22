ALTER TABLE public.asaas_configurations
  ADD COLUMN IF NOT EXISTS sync_bitrix_invoices boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bitrix_invoice_paid_stage_id text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bitrix_invoice_id bigint;

CREATE INDEX IF NOT EXISTS idx_transactions_bitrix_invoice_id
  ON public.transactions(bitrix_invoice_id)
  WHERE bitrix_invoice_id IS NOT NULL;