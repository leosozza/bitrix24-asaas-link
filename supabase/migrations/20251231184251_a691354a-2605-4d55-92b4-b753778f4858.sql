-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM (
  'scheduled',
  'synchronized',
  'authorized',
  'canceled',
  'error'
);

-- Create fiscal_configurations table
CREATE TABLE public.fiscal_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  municipal_service_id TEXT,
  municipal_service_code TEXT,
  municipal_service_name TEXT,
  default_iss NUMERIC DEFAULT 0,
  auto_emit_on_payment BOOLEAN NOT NULL DEFAULT false,
  observations_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  asaas_invoice_id TEXT,
  customer_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  value NUMERIC NOT NULL,
  service_description TEXT NOT NULL,
  observations TEXT,
  status public.invoice_status NOT NULL DEFAULT 'scheduled',
  invoice_number TEXT,
  invoice_url TEXT,
  effective_date DATE,
  external_reference TEXT,
  bitrix_entity_type public.bitrix_entity_type,
  bitrix_entity_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fiscal_configurations
ALTER TABLE public.fiscal_configurations ENABLE ROW LEVEL SECURITY;

-- RLS policies for fiscal_configurations
CREATE POLICY "Users can view their own fiscal config"
  ON public.fiscal_configurations
  FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own fiscal config"
  ON public.fiscal_configurations
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own fiscal config"
  ON public.fiscal_configurations
  FOR UPDATE
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete their own fiscal config"
  ON public.fiscal_configurations
  FOR DELETE
  USING (auth.uid() = tenant_id);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view their own invoices"
  ON public.invoices
  FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own invoices"
  ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own invoices"
  ON public.invoices
  FOR UPDATE
  USING (auth.uid() = tenant_id);

-- Create updated_at triggers
CREATE TRIGGER update_fiscal_configurations_updated_at
  BEFORE UPDATE ON public.fiscal_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_fiscal_configurations_tenant_id ON public.fiscal_configurations(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_transaction_id ON public.invoices(transaction_id);
CREATE INDEX idx_invoices_asaas_invoice_id ON public.invoices(asaas_invoice_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);