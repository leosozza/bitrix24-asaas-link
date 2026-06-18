
-- Add super_admin role
DO $$ BEGIN
  ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN others THEN NULL; END $$;

-- Add past_due and expired to subscription_status if missing
DO $$ BEGIN
  ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'past_due';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION WHEN others THEN NULL; END $$;

-- Extend tenant_subscriptions
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;
