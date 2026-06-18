ALTER TABLE public.bitrix_installations
  ADD COLUMN IF NOT EXISTS deal_fields_registered boolean NOT NULL DEFAULT false;