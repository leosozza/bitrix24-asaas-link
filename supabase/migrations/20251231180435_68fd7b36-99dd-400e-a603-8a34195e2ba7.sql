-- Add webhook configuration fields to asaas_configurations
ALTER TABLE public.asaas_configurations 
ADD COLUMN IF NOT EXISTS webhook_id text,
ADD COLUMN IF NOT EXISTS webhook_configured boolean NOT NULL DEFAULT false;