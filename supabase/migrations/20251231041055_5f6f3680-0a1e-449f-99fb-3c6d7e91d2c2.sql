-- Tornar tenant_id nullable para permitir instalações via marketplace
ALTER TABLE bitrix_installations 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Adicionar campo bitrix_domain na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bitrix_domain text;

-- Index para buscar instalações não vinculadas
CREATE INDEX IF NOT EXISTS idx_bitrix_installations_unlinked 
ON bitrix_installations (member_id, domain) 
WHERE tenant_id IS NULL;

-- Index para buscar profiles por bitrix_domain
CREATE INDEX IF NOT EXISTS idx_profiles_bitrix_domain 
ON profiles (bitrix_domain) 
WHERE bitrix_domain IS NOT NULL;

-- Atualizar RLS: permitir service role inserir sem tenant
DROP POLICY IF EXISTS "Users can insert their own installations" ON bitrix_installations;

CREATE POLICY "Allow insert installations"
ON bitrix_installations FOR INSERT
WITH CHECK (true);

-- Atualizar RLS: permitir ver instalações próprias OU não vinculadas
DROP POLICY IF EXISTS "Users can view their own installations" ON bitrix_installations;

CREATE POLICY "Users can view own or unlinked installations"
ON bitrix_installations FOR SELECT
USING (
  auth.uid() = tenant_id 
  OR tenant_id IS NULL
);

-- Função para vincular instalação automaticamente após signup
CREATE OR REPLACE FUNCTION public.link_bitrix_installation_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bitrix_domain text;
BEGIN
  -- Buscar domínio do Bitrix dos metadados do usuário
  v_bitrix_domain := NEW.raw_user_meta_data ->> 'bitrix_domain';
  
  -- Se tiver domínio, tentar vincular instalação pendente
  IF v_bitrix_domain IS NOT NULL AND v_bitrix_domain != '' THEN
    UPDATE bitrix_installations
    SET tenant_id = NEW.id, updated_at = now()
    WHERE domain ILIKE '%' || v_bitrix_domain || '%'
      AND tenant_id IS NULL
      AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para vincular após criar usuário
DROP TRIGGER IF EXISTS on_auth_user_created_link_bitrix ON auth.users;
CREATE TRIGGER on_auth_user_created_link_bitrix
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_bitrix_installation_on_signup();

-- Atualizar função handle_new_user para salvar bitrix_domain no profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, company_name, email, phone, bitrix_domain)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Minha Empresa'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'bitrix_domain'
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;