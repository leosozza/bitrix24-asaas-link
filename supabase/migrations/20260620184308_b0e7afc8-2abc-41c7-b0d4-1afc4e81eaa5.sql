ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS bitrix_field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_style text;