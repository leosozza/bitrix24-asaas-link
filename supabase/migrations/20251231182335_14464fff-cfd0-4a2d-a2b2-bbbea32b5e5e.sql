-- Create subscription status enum
CREATE TYPE public.subscription_status_asaas AS ENUM ('active', 'canceled', 'expired', 'pending');

-- Create subscription cycle enum
CREATE TYPE public.subscription_cycle AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY');

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  value NUMERIC NOT NULL,
  billing_type public.payment_method NOT NULL,
  cycle public.subscription_cycle NOT NULL,
  description TEXT,
  next_due_date DATE,
  status public.subscription_status_asaas NOT NULL DEFAULT 'pending',
  bitrix_entity_type public.bitrix_status,
  bitrix_entity_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add subscription_id to transactions table
ALTER TABLE public.transactions ADD COLUMN subscription_id UUID REFERENCES public.subscriptions(id);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own subscriptions"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_asaas_id ON public.subscriptions(asaas_id);
CREATE INDEX idx_transactions_subscription_id ON public.transactions(subscription_id);