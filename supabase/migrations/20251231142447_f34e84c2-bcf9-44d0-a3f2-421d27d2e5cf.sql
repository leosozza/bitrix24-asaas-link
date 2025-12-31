-- Add column to track if pay systems have been registered for this installation
ALTER TABLE public.bitrix_installations 
ADD COLUMN IF NOT EXISTS pay_systems_registered boolean NOT NULL DEFAULT false;

-- Add column to store the access_token for lazy registration (encrypted in production)
-- This allows us to register pay systems later when we have the domain
COMMENT ON COLUMN public.bitrix_installations.pay_systems_registered IS 'Indicates if pay systems (PIX, Boleto, Credit Card) have been registered in Bitrix24 for this installation';