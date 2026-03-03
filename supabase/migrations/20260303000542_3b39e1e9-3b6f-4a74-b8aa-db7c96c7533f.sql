
-- Adicionar colunas de controle de lazy registration
ALTER TABLE public.bitrix_installations 
  ADD COLUMN IF NOT EXISTS placements_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badges_registered boolean NOT NULL DEFAULT false;

-- Adicionar coluna para armazenar o activity_id do Bitrix24
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS bitrix_activity_id text;

-- Adicionar 'lead' ao enum bitrix_entity_type se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lead' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'bitrix_entity_type')) THEN
    ALTER TYPE public.bitrix_entity_type ADD VALUE 'lead';
  END IF;
END
$$;
