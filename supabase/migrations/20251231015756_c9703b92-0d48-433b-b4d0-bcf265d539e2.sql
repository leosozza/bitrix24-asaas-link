-- Create enums for type safety
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.bitrix_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE public.asaas_environment AS ENUM ('sandbox', 'production');
CREATE TYPE public.bitrix_entity_type AS ENUM ('deal', 'invoice', 'contact', 'company');
CREATE TYPE public.payment_method AS ENUM ('pix', 'boleto', 'credit_card');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'cancelled');
CREATE TYPE public.log_status AS ENUM ('success', 'error');
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trial');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  transaction_limit INTEGER NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create tenant_subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  current_period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  transactions_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create bitrix_installations table
CREATE TABLE public.bitrix_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  app_id TEXT,
  bitrix_user_id TEXT,
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  status bitrix_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bitrix_installations ENABLE ROW LEVEL SECURITY;

-- Create asaas_configurations table
CREATE TABLE public.asaas_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  api_key TEXT,
  environment asaas_environment NOT NULL DEFAULT 'sandbox',
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_configurations ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asaas_id TEXT,
  bitrix_entity_type bitrix_entity_type,
  bitrix_entity_id TEXT,
  amount DECIMAL(12,2) NOT NULL,
  payment_method payment_method NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  due_date DATE,
  payment_date DATE,
  payment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create integration_logs table
CREATE TABLE public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  request_data JSONB,
  response_data JSONB,
  status log_status NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

-- RLS Policies for tenant_subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.tenant_subscriptions FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own subscription"
ON public.tenant_subscriptions FOR UPDATE
USING (auth.uid() = tenant_id);

-- RLS Policies for bitrix_installations
CREATE POLICY "Users can view their own installations"
ON public.bitrix_installations FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own installations"
ON public.bitrix_installations FOR INSERT
WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own installations"
ON public.bitrix_installations FOR UPDATE
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete their own installations"
ON public.bitrix_installations FOR DELETE
USING (auth.uid() = tenant_id);

-- RLS Policies for asaas_configurations
CREATE POLICY "Users can view their own asaas config"
ON public.asaas_configurations FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own asaas config"
ON public.asaas_configurations FOR INSERT
WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own asaas config"
ON public.asaas_configurations FOR UPDATE
USING (auth.uid() = tenant_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = tenant_id);

-- RLS Policies for integration_logs
CREATE POLICY "Users can view their own logs"
ON public.integration_logs FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own logs"
ON public.integration_logs FOR INSERT
WITH CHECK (auth.uid() = tenant_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, company_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Minha Empresa'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone'
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bitrix_installations_updated_at
  BEFORE UPDATE ON public.bitrix_installations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asaas_configurations_updated_at
  BEFORE UPDATE ON public.asaas_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, price, transaction_limit, features) VALUES
  ('Starter', 49.90, 100, '["100 transações/mês", "1 instalação Bitrix24", "Suporte por email", "Cobranças avulsas"]'::jsonb),
  ('Pro', 149.90, 500, '["500 transações/mês", "3 instalações Bitrix24", "Suporte prioritário", "Cobranças avulsas", "Assinaturas/Recorrência", "Automações básicas"]'::jsonb),
  ('Enterprise', 399.90, -1, '["Transações ilimitadas", "Instalações ilimitadas", "Suporte dedicado", "Todas as funcionalidades", "API dedicada", "SLA garantido"]'::jsonb);