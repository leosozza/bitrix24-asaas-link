ALTER TABLE public.asaas_configurations
  ADD COLUMN IF NOT EXISTS bitrix_invoice_pending_stage_id text,
  ADD COLUMN IF NOT EXISTS bitrix_invoice_overdue_stage_id text;