-- Create enum for split type
CREATE TYPE public.split_type AS ENUM ('fixed', 'percentage');

-- Create table for split configurations
CREATE TABLE public.split_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  wallet_name TEXT,
  split_type public.split_type NOT NULL DEFAULT 'percentage',
  split_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for transaction splits (records applied splits)
CREATE TABLE public.transaction_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  wallet_id TEXT NOT NULL,
  wallet_name TEXT,
  split_type public.split_type NOT NULL,
  split_value NUMERIC NOT NULL,
  split_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.split_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- RLS policies for split_configurations
CREATE POLICY "Users can view their own split configs"
  ON public.split_configurations
  FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own split configs"
  ON public.split_configurations
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own split configs"
  ON public.split_configurations
  FOR UPDATE
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete their own split configs"
  ON public.split_configurations
  FOR DELETE
  USING (auth.uid() = tenant_id);

-- RLS policies for transaction_splits (via transaction ownership)
CREATE POLICY "Users can view their own transaction splits"
  ON public.transaction_splits
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
    AND t.tenant_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own transaction splits"
  ON public.transaction_splits
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
    AND t.tenant_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX idx_split_configurations_tenant ON public.split_configurations(tenant_id);
CREATE INDEX idx_split_configurations_active ON public.split_configurations(tenant_id, is_active);
CREATE INDEX idx_transaction_splits_transaction ON public.transaction_splits(transaction_id);

-- Create updated_at trigger for split_configurations
CREATE TRIGGER update_split_configurations_updated_at
  BEFORE UPDATE ON public.split_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();