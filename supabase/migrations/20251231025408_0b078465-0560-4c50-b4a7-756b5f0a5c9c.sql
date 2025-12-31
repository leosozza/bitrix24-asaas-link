-- Add new columns to bitrix_installations for marketplace integration
ALTER TABLE public.bitrix_installations 
ADD COLUMN IF NOT EXISTS member_id TEXT,
ADD COLUMN IF NOT EXISTS application_token TEXT,
ADD COLUMN IF NOT EXISTS server_endpoint TEXT,
ADD COLUMN IF NOT EXISTS client_endpoint TEXT;

-- Create table for registered pay system handlers and pay systems
CREATE TABLE public.bitrix_pay_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES public.bitrix_installations(id) ON DELETE CASCADE,
  handler_id TEXT,
  pay_system_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'boleto', 'credit_card')),
  entity_type TEXT DEFAULT 'ORDER',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bitrix_pay_systems ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bitrix_pay_systems
CREATE POLICY "Users can view their own pay systems"
ON public.bitrix_pay_systems
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bitrix_installations bi
    WHERE bi.id = bitrix_pay_systems.installation_id
    AND bi.tenant_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own pay systems"
ON public.bitrix_pay_systems
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bitrix_installations bi
    WHERE bi.id = bitrix_pay_systems.installation_id
    AND bi.tenant_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own pay systems"
ON public.bitrix_pay_systems
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bitrix_installations bi
    WHERE bi.id = bitrix_pay_systems.installation_id
    AND bi.tenant_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own pay systems"
ON public.bitrix_pay_systems
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bitrix_installations bi
    WHERE bi.id = bitrix_pay_systems.installation_id
    AND bi.tenant_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_bitrix_pay_systems_updated_at
BEFORE UPDATE ON public.bitrix_pay_systems
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_bitrix_pay_systems_installation ON public.bitrix_pay_systems(installation_id);
CREATE INDEX idx_bitrix_pay_systems_payment_method ON public.bitrix_pay_systems(payment_method);