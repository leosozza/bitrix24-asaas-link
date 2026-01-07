# Guia Definitivo: Lovable + Bitrix24 Marketplace
## Versão 3.0 - Produção Testada

**Última atualização**: Janeiro 2025  
**Status**: Produção-Ready  
**Compatível com**: Lovable Cloud, Supabase Edge Functions, Bitrix24 REST API

---

## 📋 Índice Completo

1. [Introdução e Visão Geral](#1-introdução-e-visão-geral)
2. [Configuração Inicial no Lovable](#2-configuração-inicial-no-lovable)
3. [Painel de Vendors Bitrix24](#3-painel-de-vendors-bitrix24)
4. [Estrutura de Banco de Dados](#4-estrutura-de-banco-de-dados)
5. [Edge Functions - Ciclo de Vida Completo](#5-edge-functions---ciclo-de-vida-completo)
6. [CRÍTICO: Headers CSP e Iframes](#6-crítico-headers-csp-e-iframes)
7. [Extração de Domínio - Armadilhas](#7-extração-de-domínio---armadilhas)
8. [Sistema de Pagamentos Nativos](#8-sistema-de-pagamentos-nativos)
9. [Robots de Automação](#9-robots-de-automação)
10. [Sistema de Auto-Reparo](#10-sistema-de-auto-reparo)
11. [Autenticação Multi-Tenant](#11-autenticação-multi-tenant)
12. [Webhooks Bidirecionais](#12-webhooks-bidirecionais)
13. [Token Refresh e Manutenção](#13-token-refresh-e-manutenção)
14. [Templates de Código Testados](#14-templates-de-código-testados)
15. [Troubleshooting Expandido (25+ Erros)](#15-troubleshooting-expandido)
16. [Checklist de Deploy Completo](#16-checklist-de-deploy-completo)
17. [Prompts Recomendados para Lovable](#17-prompts-recomendados-para-lovable)

---

## 1. Introdução e Visão Geral

### 1.1 O que é um Conector Bitrix24?

Um conector Bitrix24 é uma aplicação que integra serviços externos ao CRM do Bitrix24:
- **Processamento de pagamentos nativos** (PIX, Boleto, Cartão)
- **Automações via Robots** de Business Process
- **Sincronização bidirecional** de dados
- **Extensão de funcionalidades** do CRM

### 1.2 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PORTAL BITRIX24                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   CRM Deals  │  │   Invoices   │  │  Automation  │              │
│  │   (Negócios) │  │   (Faturas)  │  │   (Robots)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │ OAuth 2.0       │ POST/IFRAME     │ bizproc.robot.*
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                SUPABASE EDGE FUNCTIONS (Deno)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │bitrix-install│  │bitrix-iframe │  │robot-handler │              │
│  │              │  │              │  │              │              │
│  │ - OAuth      │  │ - Pay System │  │ - Cobrança   │              │
│  │ - Upsert     │  │ - Lazy Reg   │  │ - Verificar  │              │
│  │ - Validação  │  │ - Auto-Reparo│  │ - Assinatura │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │bitrix-unstal │  │ asaas-webhook│  │refresh-token │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE (PostgreSQL)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ installations│  │ transactions │  │    logs      │              │
│  │              │  │              │  │              │              │
│  │ - tokens     │  │ - asaas_id   │  │ - action     │              │
│  │ - member_id  │  │ - status     │  │ - response   │              │
│  │ - tenant_id  │  │ - bitrix_id  │  │ - error      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API EXTERNA (ex: Asaas, Omie, etc.)              │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | React + TypeScript + Tailwind CSS |
| **Backend** | Supabase Edge Functions (Deno) |
| **Database** | PostgreSQL (Supabase/Lovable Cloud) |
| **Auth** | Supabase Auth + OAuth Bitrix24 |
| **Deploy** | Lovable Cloud (automático) |

### 1.4 Modelo Multi-Tenant

```
Portal Bitrix24 "empresa-a.bitrix24.com.br"
        │
        ▼
┌─────────────────────────────────────┐
│ bitrix_installations                │
│ ┌─────────────────────────────────┐ │
│ │ member_id: "abc123"             │ │
│ │ domain: "empresa-a.bitrix24..." │ │
│ │ tenant_id: null (aguardando)    │ │◄── Instalação sem usuário
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
                │
                ▼ (Usuário cria conta)
┌─────────────────────────────────────┐
│ profiles                            │
│ ┌─────────────────────────────────┐ │
│ │ id: "user-uuid-xxx"             │ │
│ │ email: "admin@empresa-a.com"    │ │
│ │ bitrix_domain: "empresa-a"      │ │◄── Signup com domínio
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
                │
                ▼ (Trigger automático)
┌─────────────────────────────────────┐
│ bitrix_installations (atualizado)   │
│ ┌─────────────────────────────────┐ │
│ │ tenant_id: "user-uuid-xxx"      │ │◄── Vinculado!
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 2. Configuração Inicial no Lovable

### 2.1 Prompt Inicial Recomendado

Use este prompt para iniciar um novo projeto de conector no Lovable:

```markdown
Estou criando um conector para o Bitrix24 Marketplace que integra [NOME_DA_API] 
(ex: Asaas, Omie, PagSeguro).

O conector deve:
1. Funcionar como aplicação nativa no Marketplace Bitrix24
2. Suportar instalação OAuth 2.0
3. Registrar sistemas de pagamento nativos (PIX, Boleto, Cartão)
4. Implementar robots de automação para processos
5. Usar modelo multi-tenant com RLS

Estrutura de Edge Functions necessárias:
- bitrix-install: Handler de instalação OAuth
- bitrix-uninstall: Handler de desinstalação  
- bitrix-payment-iframe: Interface principal + lazy registration
- bitrix-robot-handler: Handler de automações
- [api]-webhook: Receber webhooks da API externa

Por favor, use o padrão parsePhpArrayNotation para parsing robusto de dados.
```

### 2.2 Estrutura de Pastas Recomendada

```
projeto/
├── src/
│   ├── components/
│   │   ├── dashboard/         # Componentes do dashboard
│   │   ├── auth/              # Login/Signup com Bitrix
│   │   └── landing/           # Landing page
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── DashboardIntegrations.tsx
│   │   └── Auth.tsx
│   └── integrations/
│       └── supabase/
│           └── client.ts      # NÃO EDITAR (auto-gerado)
├── supabase/
│   ├── config.toml            # Configuração das functions
│   └── functions/
│       ├── bitrix-install/
│       │   └── index.ts
│       ├── bitrix-uninstall/
│       │   └── index.ts
│       ├── bitrix-payment-iframe/
│       │   └── index.ts
│       ├── bitrix-robot-handler/
│       │   └── index.ts
│       ├── bitrix-refresh-token/
│       │   └── index.ts
│       └── [api]-webhook/
│           └── index.ts
└── LOVABLE_BITRIX24_MASTERGUIDE.md  # Este arquivo
```

### 2.3 Configuração do supabase/config.toml

```toml
# IMPORTANTE: project_id DEVE ser a primeira linha
project_id = "seu-project-id"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322

[db.pooler]
enabled = false
port = 54329
pool_mode = "transaction"
default_pool_size = 20
max_client_conn = 100

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = []
jwt_expiry = 3600
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false  # Auto-confirm para dev

# CRÍTICO: verify_jwt = false para todas Edge Functions do Bitrix
[functions.bitrix-install]
verify_jwt = false

[functions.bitrix-uninstall]
verify_jwt = false

[functions.bitrix-payment-iframe]
verify_jwt = false

[functions.bitrix-robot-handler]
verify_jwt = false

[functions.bitrix-refresh-token]
verify_jwt = false

[functions.asaas-webhook]
verify_jwt = false
```

### 2.4 Secrets Necessários

Configure estes secrets no Lovable Cloud (Settings → Secrets):

| Secret | Descrição | Onde obter |
|--------|-----------|------------|
| `BITRIX_CLIENT_ID` | Client ID OAuth | Painel Vendors Bitrix24 |
| `BITRIX_CLIENT_SECRET` | Client Secret | Painel Vendors Bitrix24 |
| `APP_DOMAIN` | Domínio do app | seu-app.lovable.app |
| `ASAAS_API_KEY` | API Key do Asaas (opcional) | Painel Asaas |

**Secrets auto-gerados (não adicionar manualmente):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2.5 Ordem de Criação das Edge Functions

⚠️ **IMPORTANTE**: Crie as Edge Functions nesta ordem para evitar erros de dependência:

1. `bitrix-install` (primeiro - recebe dados de instalação)
2. `bitrix-uninstall` (segundo - recebe dados de desinstalação)
3. `bitrix-payment-iframe` (terceiro - depende de install estar funcionando)
4. `bitrix-robot-handler` (quarto - depende de install)
5. `bitrix-refresh-token` (quinto - manutenção de tokens)
6. `[api]-webhook` (último - recebe eventos da API externa)

---

## 3. Painel de Vendors Bitrix24

### 3.1 Criando a Aplicação

1. Acesse: https://vendors.bitrix24.com/
2. Faça login com sua conta de desenvolvedor
3. Clique em **"Add Application"**
4. Preencha:
   - **Name**: Nome do seu conector (ex: "Integração Asaas")
   - **Description**: Descrição detalhada
   - **Category**: Finances / Payments

### 3.2 Configuração de URLs

| Campo | URL | Descrição |
|-------|-----|-----------|
| **Application URL** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-payment-iframe` | Interface principal |
| **Installer URL** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-install` | Chamada na instalação |
| **Uninstall URL** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-uninstall` | Chamada na desinstalação |
| **Settings Handler** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-payment-iframe?settings=true` | Configurações |

**Exemplo real:**
```
https://prpvoabbenonecgzufhb.supabase.co/functions/v1/bitrix-install
https://prpvoabbenonecgzufhb.supabase.co/functions/v1/bitrix-payment-iframe
https://prpvoabbenonecgzufhb.supabase.co/functions/v1/bitrix-uninstall
```

### 3.3 Configuração OAuth 2.0

Após criar a aplicação, você receberá:

- **Client ID**: `app.XXXXXXXX.XXXXXXXX`
- **Client Secret**: `XXXXXXXXXXXXXXXXXXXX`

⚠️ **CRÍTICO**: Armazene como secrets no Lovable Cloud!

### 3.4 Escopos Necessários (Completo)

```
# === ESSENCIAIS (sempre incluir) ===
crm                    # Acesso ao CRM
user                   # Informações do usuário
user.admin             # Info admin do usuário
entity                 # Acesso a entidades

# === PARA PAGAMENTOS NATIVOS ===
sale                   # Sistema de vendas/pagamentos
salescenter            # Sales Center
pay.system             # Sistemas de pagamento

# === PARA AUTOMAÇÕES ===
bizproc                # Business Processes / Robots

# === PARA WEBHOOKS ===
event                  # Registro de eventos

# === PARA SMART PROCESSES ===
crm.type               # Tipos de entidade CRM
crm.item.add           # Adicionar itens
crm.item.update        # Atualizar itens
crm.item.read          # Ler itens

# === PARA CONTACT CENTER (opcional) ===
imopenlines            # Open Lines
imconnector            # Conectores de mensagem
messageservice         # Serviço de mensagens
```

### 3.5 Placements (Onde o App Aparece)

Configure os Placements para definir onde seu app será acessível:

| Placement | Descrição | Código |
|-----------|-----------|--------|
| CRM Deal Details | Na tela de detalhes do negócio | `CRM_DEAL_DETAIL_TAB` |
| CRM Invoice | Na fatura | `CRM_INVOICE_DETAIL_TAB` |
| Settings | Nas configurações | `REST_APPLICATION_SETTINGS` |

---

## 4. Estrutura de Banco de Dados

### 4.1 Tabela Principal: bitrix_installations

```sql
-- Registro de instalações do Bitrix24
CREATE TABLE public.bitrix_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificadores do Portal
  domain TEXT NOT NULL,                    -- portal.bitrix24.com.br
  member_id TEXT UNIQUE,                   -- ID único do portal (CRÍTICO para upsert)
  
  -- Tokens OAuth
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  application_token TEXT,                  -- Token estático (se configurado)
  
  -- Endpoints
  client_endpoint TEXT,                    -- https://portal.bitrix24.com.br/rest/
  server_endpoint TEXT,                    -- OAuth server endpoint
  
  -- Metadados
  scope TEXT,                              -- Escopos concedidos
  bitrix_user_id TEXT,                     -- ID do usuário que instalou
  app_id TEXT,                             -- ID da aplicação
  
  -- Vínculo com Tenant (pode ser NULL até usuário criar conta)
  tenant_id UUID REFERENCES public.profiles(id),
  
  -- Flags de Lazy Registration
  pay_systems_registered BOOLEAN NOT NULL DEFAULT false,
  robots_registered BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_bitrix_installations_member_id ON public.bitrix_installations(member_id);
CREATE INDEX idx_bitrix_installations_tenant_id ON public.bitrix_installations(tenant_id);
CREATE INDEX idx_bitrix_installations_domain ON public.bitrix_installations(domain);

-- RLS
ALTER TABLE public.bitrix_installations ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode inserir (instalação acontece antes do login)
CREATE POLICY "Allow insert installations" 
  ON public.bitrix_installations FOR INSERT 
  WITH CHECK (true);

-- Política: Usuário vê próprias instalações OU instalações não vinculadas
CREATE POLICY "Users can view own or unlinked installations" 
  ON public.bitrix_installations FOR SELECT 
  USING ((auth.uid() = tenant_id) OR (tenant_id IS NULL));

-- Política: Usuário atualiza apenas suas instalações
CREATE POLICY "Users can update their own installations" 
  ON public.bitrix_installations FOR UPDATE 
  USING (auth.uid() = tenant_id);

-- Política: Usuário deleta apenas suas instalações
CREATE POLICY "Users can delete their own installations" 
  ON public.bitrix_installations FOR DELETE 
  USING (auth.uid() = tenant_id);
```

### 4.2 Tabela de Pay Systems

```sql
CREATE TABLE public.bitrix_pay_systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES public.bitrix_installations(id) ON DELETE CASCADE,
  
  payment_method TEXT NOT NULL,            -- 'pix', 'boleto', 'credit_card'
  pay_system_id TEXT,                      -- ID retornado pelo Bitrix
  handler_id TEXT,                         -- ID do handler registrado
  entity_type TEXT DEFAULT 'ORDER',        -- Tipo de entidade
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS via join com installations
ALTER TABLE public.bitrix_pay_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pay systems" 
  ON public.bitrix_pay_systems FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM bitrix_installations bi 
    WHERE bi.id = bitrix_pay_systems.installation_id 
    AND bi.tenant_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own pay systems" 
  ON public.bitrix_pay_systems FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM bitrix_installations bi 
    WHERE bi.id = bitrix_pay_systems.installation_id 
    AND bi.tenant_id = auth.uid()
  ));

CREATE POLICY "Users can update their own pay systems" 
  ON public.bitrix_pay_systems FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM bitrix_installations bi 
    WHERE bi.id = bitrix_pay_systems.installation_id 
    AND bi.tenant_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own pay systems" 
  ON public.bitrix_pay_systems FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM bitrix_installations bi 
    WHERE bi.id = bitrix_pay_systems.installation_id 
    AND bi.tenant_id = auth.uid()
  ));
```

### 4.3 Tabela de Logs

```sql
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  
  action TEXT NOT NULL,                    -- 'payment_created', 'webhook_received', etc.
  entity_type TEXT,                        -- 'deal', 'invoice', 'transaction'
  entity_id TEXT,                          -- ID da entidade
  
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  
  request_data JSONB,
  response_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs" 
  ON public.integration_logs FOR SELECT 
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own logs" 
  ON public.integration_logs FOR INSERT 
  WITH CHECK (auth.uid() = tenant_id);
```

### 4.4 Tabela de Transações

```sql
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  
  -- IDs externos
  asaas_id TEXT,                           -- ID na API externa
  bitrix_entity_type TEXT,                 -- 'deal', 'invoice'
  bitrix_entity_id TEXT,
  
  -- Dados do cliente
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,                  -- CPF/CNPJ
  
  -- Dados do pagamento
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'boleto', 'credit_card')),
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'cancelled')),
  
  due_date DATE,
  payment_date DATE,
  payment_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" 
  ON public.transactions FOR SELECT 
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own transactions" 
  ON public.transactions FOR INSERT 
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own transactions" 
  ON public.transactions FOR UPDATE 
  USING (auth.uid() = tenant_id);
```

### 4.5 Trigger de Vinculação Automática no Signup

```sql
-- Função que vincula instalação ao usuário automaticamente no signup
CREATE OR REPLACE FUNCTION public.link_bitrix_installation_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_bitrix_domain TEXT;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger no auth.users
CREATE TRIGGER on_auth_user_created_link_bitrix
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_bitrix_installation_on_signup();
```

---

## 5. Edge Functions - Ciclo de Vida Completo

### 5.1 Helper CRÍTICO: parsePhpArrayNotation

⚠️ **ESTE HELPER É OBRIGATÓRIO EM TODAS AS EDGE FUNCTIONS**

O Bitrix24 envia dados em múltiplos formatos. Este helper unifica o parsing:

```typescript
/**
 * Parser robusto para dados do Bitrix24
 * Suporta: JSON, form-urlencoded, PHP array notation
 * 
 * Exemplos de formatos suportados:
 * 1. JSON: { "auth": { "access_token": "xxx" } }
 * 2. Form flat: AUTH_ID=xxx&MEMBER_ID=yyy
 * 3. PHP array: auth[access_token]=xxx&auth[member_id]=yyy
 */
function parsePhpArrayNotation(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of params.entries()) {
    // Padrão 1: auth[access_token] -> { auth: { access_token: value } }
    const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
    if (nestedMatch) {
      const [, parent, child] = nestedMatch;
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {};
      }
      (result[parent] as Record<string, string>)[child] = value;
    } 
    // Padrão 2: chave simples
    else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Extrai dados de instalação de qualquer formato
 */
function extractInstallData(contentType: string, bodyText: string): {
  event: string;
  auth: Record<string, string>;
  data: Record<string, string>;
} {
  let event = '';
  let auth: Record<string, string> = {};
  let data: Record<string, string> = {};
  
  // Formato 1: JSON
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(bodyText);
      event = json.event || 'ONAPPINSTALL';
      auth = json.auth || {};
      data = json.data || {};
      
      // Se veio com estrutura flat, mapear
      if (json.AUTH_ID) {
        auth = {
          access_token: json.AUTH_ID,
          refresh_token: json.REFRESH_ID || '',
          expires_in: json.AUTH_EXPIRES || '3600',
          member_id: json.member_id || json.MEMBER_ID || '',
          domain: json.DOMAIN || '',
        };
      }
    } catch (e) {
      console.error('Erro parsing JSON:', e);
    }
  }
  // Formato 2 e 3: Form-urlencoded (flat ou PHP array)
  else {
    const params = new URLSearchParams(bodyText);
    const parsed = parsePhpArrayNotation(params);
    
    event = (parsed.event as string) || params.get('event') || 'ONAPPINSTALL';
    
    // Se veio como objeto aninhado (PHP array notation)
    if (parsed.auth && typeof parsed.auth === 'object') {
      auth = parsed.auth as Record<string, string>;
    }
    // Se veio como flat
    else {
      auth = {
        access_token: params.get('AUTH_ID') || params.get('access_token') || '',
        refresh_token: params.get('REFRESH_ID') || params.get('refresh_token') || '',
        expires_in: params.get('AUTH_EXPIRES') || '3600',
        member_id: params.get('member_id') || params.get('MEMBER_ID') || '',
        domain: params.get('DOMAIN') || params.get('domain') || '',
        application_token: params.get('APP_SID') || params.get('application_token') || '',
        scope: params.get('SCOPE') || params.get('scope') || '',
      };
    }
    
    if (parsed.data && typeof parsed.data === 'object') {
      data = parsed.data as Record<string, string>;
    }
  }
  
  return { event, auth, data };
}
```

### 5.2 bitrix-install (Instalação)

```typescript
// supabase/functions/bitrix-install/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ========== HELPER OBRIGATÓRIO ==========
function parsePhpArrayNotation(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of params.entries()) {
    const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
    if (nestedMatch) {
      const [, parent, child] = nestedMatch;
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {};
      }
      (result[parent] as Record<string, string>)[child] = value;
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

function extractInstallData(contentType: string, bodyText: string) {
  let auth: Record<string, string> = {};
  let event = '';
  
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(bodyText);
      event = json.event || 'ONAPPINSTALL';
      auth = json.auth || {};
      if (json.AUTH_ID) {
        auth = {
          access_token: json.AUTH_ID,
          refresh_token: json.REFRESH_ID || '',
          member_id: json.member_id || json.MEMBER_ID || '',
          domain: json.DOMAIN || '',
          expires_in: json.AUTH_EXPIRES || '3600',
          scope: json.SCOPE || '',
          application_token: json.APP_SID || '',
        };
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  } else {
    const params = new URLSearchParams(bodyText);
    const parsed = parsePhpArrayNotation(params);
    
    event = (parsed.event as string) || params.get('event') || 'ONAPPINSTALL';
    
    if (parsed.auth && typeof parsed.auth === 'object') {
      auth = parsed.auth as Record<string, string>;
    } else {
      auth = {
        access_token: params.get('AUTH_ID') || '',
        refresh_token: params.get('REFRESH_ID') || '',
        member_id: params.get('member_id') || params.get('MEMBER_ID') || '',
        domain: params.get('DOMAIN') || '',
        expires_in: params.get('AUTH_EXPIRES') || '3600',
        scope: params.get('SCOPE') || '',
        application_token: params.get('APP_SID') || '',
      };
    }
  }
  
  return { event, auth };
}
// ========== FIM HELPER ==========

serve(async (req) => {
  console.log('=== BITRIX-INSTALL START ===');
  console.log('Method:', req.method);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validação do Marketplace (GET ou POST vazio)
    if (req.method === 'GET') {
      console.log('GET request - validation check');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    console.log('Content-Type:', contentType);
    console.log('Body length:', bodyText.length);
    console.log('Body preview:', bodyText.substring(0, 500));
    
    // POST vazio = validação do Marketplace
    if (!bodyText || bodyText.trim() === '') {
      console.log('Empty POST - validation check');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Extrair dados usando helper robusto
    const { event, auth } = extractInstallData(contentType, bodyText);
    
    console.log('Parsed event:', event);
    console.log('Parsed auth member_id:', auth.member_id);
    console.log('Parsed auth domain:', auth.domain);
    console.log('Parsed auth has access_token:', !!auth.access_token);
    
    // Validar dados mínimos
    if (!auth.member_id || !auth.access_token) {
      console.error('Missing required fields: member_id or access_token');
      return new Response(`
        <html>
          <head><title>Erro de Instalação</title></head>
          <body>
            <h1>Erro: Dados de instalação incompletos</h1>
            <p>member_id: ${auth.member_id || 'MISSING'}</p>
            <p>access_token: ${auth.access_token ? 'OK' : 'MISSING'}</p>
          </body>
        </html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        status: 400,
      });
    }
    
    // Calcular expiração do token
    const expiresIn = parseInt(auth.expires_in || '3600');
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    // Inicializar Supabase com service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // UPSERT por member_id (permite reinstalação)
    const { data: installation, error: upsertError } = await supabase
      .from('bitrix_installations')
      .upsert({
        member_id: auth.member_id,
        domain: auth.domain,
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expires_at: expiresAt,
        scope: auth.scope,
        application_token: auth.application_token,
        client_endpoint: `https://${auth.domain}/rest/`,
        status: 'active',
        // Reset flags para permitir re-registro
        pay_systems_registered: false,
        robots_registered: false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'member_id',
      })
      .select()
      .single();
    
    if (upsertError) {
      console.error('Upsert error:', upsertError);
      throw upsertError;
    }
    
    console.log('Installation saved:', installation?.id);
    
    // Retornar página de sucesso com BX24.installFinish()
    const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Instalação Concluída</title>
  <script src="https://api.bitrix24.com/api/v1/"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 400px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .success-icon::after {
      content: '✓';
      color: white;
      font-size: 40px;
    }
    h1 { color: #1f2937; margin-bottom: 10px; }
    p { color: #6b7280; margin-bottom: 20px; }
    .domain { 
      background: #f3f4f6; 
      padding: 8px 16px; 
      border-radius: 8px; 
      font-family: monospace;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon"></div>
    <h1>Instalação Concluída!</h1>
    <p>O aplicativo foi instalado com sucesso no seu portal:</p>
    <div class="domain">${auth.domain}</div>
  </div>
  <script>
    // Aguardar SDK carregar e finalizar instalação
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() {
        console.log('BX24 initialized, calling installFinish');
        BX24.installFinish();
      });
    } else {
      console.log('BX24 not available, waiting...');
      setTimeout(function() {
        if (typeof BX24 !== 'undefined') {
          BX24.init(function() {
            BX24.installFinish();
          });
        }
      }, 1000);
    }
  </script>
</body>
</html>`;
    
    return new Response(successHtml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8' 
      },
    });
    
  } catch (error) {
    console.error('Install error:', error);
    return new Response(`
      <html>
        <head><title>Erro</title></head>
        <body>
          <h1>Erro na instalação</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      status: 500,
    });
  }
});
```

### 5.3 bitrix-uninstall (Desinstalação)

```typescript
// supabase/functions/bitrix-uninstall/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mesmo helper de parsing
function parsePhpArrayNotation(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
    if (nestedMatch) {
      const [, parent, child] = nestedMatch;
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {};
      }
      (result[parent] as Record<string, string>)[child] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

serve(async (req) => {
  console.log('=== BITRIX-UNINSTALL START ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET = validação
    if (req.method === 'GET') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Extrair member_id
    let memberId = '';
    
    if (contentType.includes('application/json')) {
      const json = JSON.parse(bodyText);
      memberId = json.auth?.member_id || json.member_id || json.MEMBER_ID || '';
    } else {
      const params = new URLSearchParams(bodyText);
      const parsed = parsePhpArrayNotation(params);
      
      if (parsed.auth && typeof parsed.auth === 'object') {
        memberId = (parsed.auth as Record<string, string>).member_id || '';
      } else {
        memberId = params.get('member_id') || params.get('MEMBER_ID') || '';
      }
    }
    
    console.log('Uninstall for member_id:', memberId);
    
    if (!memberId) {
      console.log('No member_id, returning OK');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Revogar status e limpar tokens
    const { error: updateError } = await supabase
      .from('bitrix_installations')
      .update({
        status: 'revoked',
        access_token: null,
        refresh_token: null,
        pay_systems_registered: false,
        robots_registered: false,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId);
    
    if (updateError) {
      console.error('Update error:', updateError);
    }
    
    console.log('Installation revoked for:', memberId);
    
    return new Response('<html><body>OK</body></html>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
    
  } catch (error) {
    console.error('Uninstall error:', error);
    return new Response('<html><body>OK</body></html>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});
```

### 5.4 bitrix-payment-iframe (Interface Principal + Lazy Registration)

```typescript
// supabase/functions/bitrix-payment-iframe/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ========== CSP HEADERS OBRIGATÓRIOS ==========
const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.bitrix24.com https://*.bitrix24.com.br https://*.bitrix24.ru https://*.bitrix24.eu https://*.bitrix24.de",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.bitrix24.com https://*.bitrix24.com.br https://*.supabase.co",
  "connect-src 'self' https://*.bitrix24.com https://*.bitrix24.com.br https://*.supabase.co",
  "frame-ancestors https://*.bitrix24.com https://*.bitrix24.com.br https://*.bitrix24.ru https://*.bitrix24.eu https://*.bitrix24.de https://*.bitrix24.ua https://*.bitrix24.pl https://*.bitrix24.in",
  "frame-src https://*.bitrix24.com https://*.bitrix24.com.br"
].join('; ');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': cspValue,
  'X-Frame-Options': 'ALLOWALL',
};

// ========== HELPERS ==========
function parsePhpArrayNotation(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
    if (nestedMatch) {
      const [, parent, child] = nestedMatch;
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {};
      }
      (result[parent] as Record<string, string>)[child] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function extractDomain(bodyText: string, contentType: string): string {
  let domain = '';
  
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(bodyText);
      domain = json.auth?.domain || json.DOMAIN || '';
    } catch (e) {}
  } else {
    const params = new URLSearchParams(bodyText);
    const parsed = parsePhpArrayNotation(params);
    
    if (parsed.auth && typeof parsed.auth === 'object') {
      domain = (parsed.auth as Record<string, string>).domain || '';
    } else {
      domain = params.get('DOMAIN') || params.get('domain') || '';
    }
  }
  
  return domain;
}

async function callBitrixApi(endpoint: string, method: string, params: Record<string, unknown>, accessToken: string): Promise<unknown> {
  const url = `${endpoint}${method}`;
  console.log('Calling Bitrix API:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken }),
  });
  
  const data = await response.json();
  console.log('Bitrix API response:', JSON.stringify(data).substring(0, 500));
  
  return data;
}

// ========== LAZY REGISTRATION: PAY SYSTEMS ==========
async function ensurePaySystemsRegistered(
  supabase: ReturnType<typeof createClient>,
  installation: { id: string; access_token: string; domain: string; pay_systems_registered: boolean },
  handlerUrl: string
): Promise<void> {
  if (installation.pay_systems_registered) {
    console.log('Pay systems already registered');
    return;
  }
  
  const endpoint = `https://${installation.domain}/rest/`;
  const token = installation.access_token;
  
  console.log('Starting Pay System registration...');
  
  try {
    // 1. Registrar handler
    const handlerResult = await callBitrixApi(endpoint, 'sale.paysystem.handler.add', {
      NAME: 'Seu Conector',
      CODE: 'seu_conector_payments',
      SORT: 100,
      SETTINGS: {
        CURRENCY: ['BRL'],
        CLIENT_TYPE: 'b2c',
        IFRAME_DATA: {
          ACTION_URI: handlerUrl,
          FIELDS: {
            PAYMENT_ID: { CODE: 'PAYMENT_ID' },
            PAYMENT_SHOULD_PAY: { CODE: 'PAYMENT_SHOULD_PAY' },
            PS_SUM: { CODE: 'PS_SUM' },
            BUYER_PERSON_FIRST_NAME: { CODE: 'BUYER_PERSON_FIRST_NAME' },
            BUYER_PERSON_LAST_NAME: { CODE: 'BUYER_PERSON_LAST_NAME' },
            BUYER_PERSON_EMAIL: { CODE: 'BUYER_PERSON_EMAIL' },
            BUYER_PERSON_PHONE: { CODE: 'BUYER_PERSON_PHONE' },
          }
        }
      }
    }, token);
    
    console.log('Handler registered:', handlerResult);
    
    // 2. Obter personTypeId dinamicamente
    const personTypes = await callBitrixApi(endpoint, 'sale.persontype.list', {}, token) as { result?: Array<{ ID: string }> };
    const personTypeId = personTypes.result?.[0]?.ID || '1';
    console.log('Using personTypeId:', personTypeId);
    
    // 3. Criar Pay Systems
    const payMethods = [
      { name: 'PIX', code: 'pix' },
      { name: 'Boleto', code: 'boleto' },
      { name: 'Cartão de Crédito', code: 'credit_card' },
    ];
    
    for (const method of payMethods) {
      try {
        const result = await callBitrixApi(endpoint, 'sale.paysystem.add', {
          NAME: `Seu Conector - ${method.name}`,
          PSA_NAME: `seu_conector_${method.code}`,
          ACTION_FILE: 'seu_conector_payments',
          ENTITY_REGISTRY_TYPE: 'ORDER',
          PERSON_TYPE_ID: personTypeId,
          NEW_WINDOW: 'N',
          ACTIVE: 'Y',
          SORT: 100,
        }, token);
        
        console.log(`Pay System ${method.name} created:`, result);
        
        // Salvar no banco
        await supabase.from('bitrix_pay_systems').insert({
          installation_id: installation.id,
          payment_method: method.code,
          pay_system_id: (result as { result?: string }).result || null,
        });
      } catch (e) {
        console.error(`Error creating ${method.name}:`, e);
      }
    }
    
    // 4. Atualizar flag
    await supabase
      .from('bitrix_installations')
      .update({ pay_systems_registered: true })
      .eq('id', installation.id);
    
    console.log('Pay Systems registration complete');
    
  } catch (error) {
    console.error('Pay System registration failed:', error);
  }
}

// ========== LAZY REGISTRATION: ROBOTS ==========
async function ensureRobotsRegistered(
  supabase: ReturnType<typeof createClient>,
  installation: { id: string; access_token: string; domain: string; robots_registered: boolean | null },
  robotHandlerUrl: string
): Promise<void> {
  if (installation.robots_registered) {
    console.log('Robots already registered');
    return;
  }
  
  const endpoint = `https://${installation.domain}/rest/`;
  const token = installation.access_token;
  
  console.log('Starting Robot registration...');
  
  const robots = [
    {
      CODE: 'seu_conector_criar_cobranca',
      NAME: 'Seu Conector: Criar Cobrança',
      USE_PLACEMENT: 'N',
      PLACEMENT_HANDLER: robotHandlerUrl,
      PROPERTIES: {
        amount: { Name: 'Valor', Type: 'double', Required: 'Y' },
        payment_method: { Name: 'Forma de Pagamento', Type: 'select', Required: 'Y', Options: { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão' } },
        due_date: { Name: 'Vencimento', Type: 'date' },
        customer_name: { Name: 'Nome do Cliente', Type: 'string' },
        customer_email: { Name: 'E-mail', Type: 'string' },
        customer_document: { Name: 'CPF/CNPJ', Type: 'string' },
      },
      RETURN_PROPERTIES: {
        payment_id: { Name: 'ID do Pagamento', Type: 'string' },
        payment_url: { Name: 'Link de Pagamento', Type: 'string' },
        status: { Name: 'Status', Type: 'string' },
      },
    },
    {
      CODE: 'seu_conector_verificar_pagamento',
      NAME: 'Seu Conector: Verificar Pagamento',
      USE_PLACEMENT: 'N',
      PLACEMENT_HANDLER: robotHandlerUrl,
      PROPERTIES: {
        payment_id: { Name: 'ID do Pagamento', Type: 'string', Required: 'Y' },
      },
      RETURN_PROPERTIES: {
        status: { Name: 'Status', Type: 'string' },
        payment_date: { Name: 'Data do Pagamento', Type: 'string' },
      },
    },
  ];
  
  for (const robot of robots) {
    try {
      const result = await callBitrixApi(endpoint, 'bizproc.robot.add', robot, token);
      console.log(`Robot ${robot.CODE} registered:`, result);
    } catch (e) {
      // Ignorar erro se já existe
      const errorMsg = String(e);
      if (!errorMsg.includes('ERROR_ACTIVITY_ALREADY_INSTALLED')) {
        console.error(`Error registering ${robot.CODE}:`, e);
      }
    }
  }
  
  // Atualizar flag
  await supabase
    .from('bitrix_installations')
    .update({ robots_registered: true })
    .eq('id', installation.id);
  
  console.log('Robots registration complete');
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  console.log('=== BITRIX-PAYMENT-IFRAME START ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isSettings = url.searchParams.get('settings') === 'true';
    const isRepair = url.searchParams.get('repair') === 'true';
    
    // GET sem parâmetros = validação
    if (req.method === 'GET' && !isSettings && !isRepair) {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = req.method === 'POST' ? await req.text() : '';
    
    // POST vazio = validação
    if (req.method === 'POST' && (!bodyText || bodyText.trim() === '')) {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Extrair domínio
    const domain = extractDomain(bodyText, contentType);
    console.log('Extracted domain:', domain);
    
    if (!domain) {
      return new Response(`
        <html>
          <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="${cspValue}">
          </head>
          <body>
            <h1>Erro: Domínio não identificado</h1>
            <p>Por favor, reinstale o aplicativo.</p>
          </body>
        </html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }
    
    // Buscar instalação
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: installation, error } = await supabase
      .from('bitrix_installations')
      .select('*')
      .ilike('domain', `%${domain}%`)
      .eq('status', 'active')
      .single();
    
    if (error || !installation) {
      console.error('Installation not found:', error);
      return new Response(`
        <html>
          <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="${cspValue}">
          </head>
          <body>
            <h1>Instalação não encontrada</h1>
            <p>Por favor, reinstale o aplicativo no seu portal Bitrix24.</p>
          </body>
        </html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }
    
    console.log('Installation found:', installation.id);
    
    // Handler URL base
    const baseUrl = SUPABASE_URL.replace('.supabase.co', '.supabase.co/functions/v1');
    const paymentHandlerUrl = `${baseUrl}/bitrix-payment-iframe`;
    const robotHandlerUrl = `${baseUrl}/bitrix-robot-handler`;
    
    // Lazy Registration: Pay Systems e Robots
    if (!installation.pay_systems_registered || isRepair) {
      await ensurePaySystemsRegistered(supabase, installation, paymentHandlerUrl);
    }
    
    if (!installation.robots_registered || isRepair) {
      await ensureRobotsRegistered(supabase, installation, robotHandlerUrl);
    }
    
    // Verificar contexto: é pagamento ou dashboard?
    const params = new URLSearchParams(bodyText);
    const paymentId = params.get('PAYMENT_ID');
    const isPaymentContext = !!paymentId;
    
    if (isPaymentContext) {
      // Contexto de pagamento: renderizar checkout
      const amount = params.get('PS_SUM') || params.get('PAYMENT_SHOULD_PAY') || '0';
      const customerName = `${params.get('BUYER_PERSON_FIRST_NAME') || ''} ${params.get('BUYER_PERSON_LAST_NAME') || ''}`.trim();
      const customerEmail = params.get('BUYER_PERSON_EMAIL') || '';
      
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="${cspValue}">
          <title>Pagamento</title>
          <style>
            body { font-family: -apple-system, sans-serif; padding: 20px; }
            .amount { font-size: 32px; font-weight: bold; color: #10b981; }
            .info { margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px; }
            button { padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; }
          </style>
        </head>
        <body>
          <h1>Pagamento #${paymentId}</h1>
          <div class="amount">R$ ${parseFloat(amount).toFixed(2)}</div>
          <div class="info">
            <p><strong>Cliente:</strong> ${customerName || 'Não informado'}</p>
            <p><strong>E-mail:</strong> ${customerEmail || 'Não informado'}</p>
          </div>
          <button onclick="processPayment()">Processar Pagamento</button>
          <script>
            function processPayment() {
              // Implementar lógica de pagamento
              alert('Processando pagamento...');
            }
          </script>
        </body>
        </html>
      `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    }
    
    // Contexto normal: dashboard/settings
    const tenantLinked = !!installation.tenant_id;
    
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${cspValue}">
        <title>Seu Conector</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f9fafb;
          }
          .container { max-width: 600px; margin: 0 auto; }
          .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 16px;
          }
          .status { 
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
          }
          .status.active { background: #d1fae5; color: #065f46; }
          .status.pending { background: #fef3c7; color: #92400e; }
          h1 { color: #1f2937; margin-bottom: 8px; }
          p { color: #6b7280; }
          .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
          }
          .btn-secondary {
            background: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>Seu Conector</h1>
            <p>Portal: <strong>${installation.domain}</strong></p>
            <p>Status: <span class="status ${tenantLinked ? 'active' : 'pending'}">${tenantLinked ? 'Configurado' : 'Aguardando configuração'}</span></p>
          </div>
          
          ${!tenantLinked ? `
            <div class="card">
              <h2>⚠️ Configuração Necessária</h2>
              <p>Para ativar a integração, você precisa criar uma conta e configurar sua API Key.</p>
              <a href="https://seu-app.lovable.app/auth?bitrix_domain=${installation.domain}" class="btn" target="_blank">
                Configurar Agora
              </a>
            </div>
          ` : `
            <div class="card">
              <h2>✅ Integração Ativa</h2>
              <p>Sua integração está funcionando corretamente.</p>
              <p>Pay Systems: ${installation.pay_systems_registered ? '✅' : '❌'}</p>
              <p>Robots: ${installation.robots_registered ? '✅' : '❌'}</p>
            </div>
          `}
          
          <div class="card">
            <h3>🔧 Manutenção</h3>
            <p>Se as automações ou formas de pagamento não estiverem aparecendo, clique no botão abaixo:</p>
            <a href="?repair=true" class="btn btn-secondary">Reparar Integração</a>
          </div>
        </div>
      </body>
      </html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
    
  } catch (error) {
    console.error('Iframe error:', error);
    return new Response(`
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="${cspValue}">
        </head>
        <body>
          <h1>Erro</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' }, status: 500 });
  }
});
```

### 5.5 bitrix-robot-handler (Handler de Automações)

```typescript
// supabase/functions/bitrix-robot-handler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function parsePhpArrayNotation(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
    if (nestedMatch) {
      const [, parent, child] = nestedMatch;
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {};
      }
      (result[parent] as Record<string, string>)[child] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

serve(async (req) => {
  console.log('=== ROBOT-HANDLER START ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      return new Response('OK', { headers: corsHeaders });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    console.log('Robot request body:', bodyText.substring(0, 1000));
    
    if (!bodyText) {
      return new Response('OK', { headers: corsHeaders });
    }
    
    // Extrair dados
    const params = new URLSearchParams(bodyText);
    const parsed = parsePhpArrayNotation(params);
    
    const robotCode = params.get('code') || (parsed.code as string) || '';
    const eventToken = params.get('event_token') || (parsed.event_token as string) || '';
    const properties = (parsed.properties as Record<string, string>) || {};
    
    // Extrair auth
    let domain = '';
    let accessToken = '';
    
    if (parsed.auth && typeof parsed.auth === 'object') {
      const auth = parsed.auth as Record<string, string>;
      domain = auth.domain || '';
      accessToken = auth.access_token || '';
    } else {
      domain = params.get('DOMAIN') || '';
    }
    
    console.log('Robot code:', robotCode);
    console.log('Domain:', domain);
    console.log('Event token:', eventToken);
    console.log('Properties:', JSON.stringify(properties));
    
    // Inicializar resultado
    let returnValues: Record<string, string> = {};
    let success = false;
    let errorMessage = '';
    
    // Switch por código do robot
    switch (robotCode) {
      case 'seu_conector_criar_cobranca':
        try {
          const amount = parseFloat(properties.amount || '0');
          const paymentMethod = properties.payment_method || 'pix';
          
          // Aqui você chamaria sua API externa (Asaas, etc.)
          // Por exemplo:
          // const chargeResult = await createAsaasCharge({ amount, paymentMethod, ... });
          
          returnValues = {
            payment_id: 'PAY_' + Date.now(),
            payment_url: 'https://exemplo.com/pay/xxx',
            status: 'pending',
          };
          success = true;
        } catch (e) {
          errorMessage = (e as Error).message;
        }
        break;
        
      case 'seu_conector_verificar_pagamento':
        try {
          const paymentId = properties.payment_id || '';
          
          // Aqui você consultaria o status na API externa
          
          returnValues = {
            status: 'confirmed',
            payment_date: new Date().toISOString(),
          };
          success = true;
        } catch (e) {
          errorMessage = (e as Error).message;
        }
        break;
        
      default:
        console.log('Unknown robot code:', robotCode);
        errorMessage = 'Robot não reconhecido';
    }
    
    // Enviar retorno ao Bitrix via bizproc.event.send
    if (eventToken && domain) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Buscar access_token da instalação
      const { data: installation } = await supabase
        .from('bitrix_installations')
        .select('access_token')
        .ilike('domain', `%${domain}%`)
        .eq('status', 'active')
        .single();
      
      if (installation?.access_token) {
        const endpoint = `https://${domain}/rest/`;
        
        const eventResponse = await fetch(`${endpoint}bizproc.event.send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth: installation.access_token,
            event_token: eventToken,
            return_values: returnValues,
            log_message: success ? 'Executado com sucesso' : `Erro: ${errorMessage}`,
          }),
        });
        
        const eventResult = await eventResponse.json();
        console.log('bizproc.event.send result:', eventResult);
      }
    }
    
    return new Response(JSON.stringify({ success, returnValues, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Robot handler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

### 5.6 bitrix-refresh-token (Renovação de Tokens)

```typescript
// supabase/functions/bitrix-refresh-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BITRIX_CLIENT_ID = Deno.env.get('BITRIX_CLIENT_ID')!;
const BITRIX_CLIENT_SECRET = Deno.env.get('BITRIX_CLIENT_SECRET')!;

async function refreshBitrixToken(refreshToken: string, domain: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const oauthUrl = `https://oauth.bitrix.info/oauth/token/?grant_type=refresh_token&client_id=${BITRIX_CLIENT_ID}&client_secret=${BITRIX_CLIENT_SECRET}&refresh_token=${refreshToken}`;
  
  console.log('Refreshing token for domain:', domain);
  
  try {
    const response = await fetch(oauthUrl);
    const data = await response.json();
    
    if (data.error) {
      console.error('OAuth error:', data);
      return null;
    }
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600,
    };
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
  }
}

serve(async (req) => {
  console.log('=== REFRESH-TOKEN START ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Buscar instalações com tokens expirando (próximas 24h)
    const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: installations, error } = await supabase
      .from('bitrix_installations')
      .select('*')
      .eq('status', 'active')
      .lt('expires_at', expirationThreshold)
      .not('refresh_token', 'is', null);
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${installations?.length || 0} installations to refresh`);
    
    const results: Array<{ domain: string; success: boolean; error?: string }> = [];
    
    for (const installation of installations || []) {
      console.log('Processing:', installation.domain);
      
      const newTokens = await refreshBitrixToken(installation.refresh_token!, installation.domain);
      
      if (newTokens) {
        const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
        
        await supabase
          .from('bitrix_installations')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', installation.id);
        
        results.push({ domain: installation.domain, success: true });
      } else {
        // Token inválido - marcar como expirado
        await supabase
          .from('bitrix_installations')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('id', installation.id);
        
        results.push({ domain: installation.domain, success: false, error: 'Token refresh failed' });
      }
    }
    
    return new Response(JSON.stringify({ 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

---

## 6. CRÍTICO: Headers CSP e Iframes

### 6.1 O Problema

O Bitrix24 carrega seu aplicativo dentro de um iframe. Se os headers de segurança não estiverem configurados corretamente, você verá:
- **Tela branca** (conteúdo bloqueado)
- **Erros de X-Frame-Options** no console
- **Erro "Refused to display in a frame"**

### 6.2 Solução: Headers CSP Completos

**OBRIGATÓRIO em TODAS Edge Functions que renderizam HTML:**

```typescript
const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.bitrix24.com https://*.bitrix24.com.br https://*.bitrix24.ru https://*.bitrix24.eu https://*.bitrix24.de https://*.bitrix24.ua https://*.bitrix24.pl https://*.bitrix24.in",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.bitrix24.com https://*.bitrix24.com.br https://*.supabase.co blob:",
  "connect-src 'self' https://*.bitrix24.com https://*.bitrix24.com.br https://*.supabase.co",
  "frame-ancestors https://*.bitrix24.com https://*.bitrix24.com.br https://*.bitrix24.ru https://*.bitrix24.eu https://*.bitrix24.de https://*.bitrix24.ua https://*.bitrix24.pl https://*.bitrix24.in",
  "frame-src https://*.bitrix24.com https://*.bitrix24.com.br"
].join('; ');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': cspValue,
  'X-Frame-Options': 'ALLOWALL',
};
```

### 6.3 Meta Tag como Fallback

Adicione também a meta tag no HTML como fallback:

```html
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="frame-ancestors https://*.bitrix24.com https://*.bitrix24.com.br https://*.bitrix24.ru https://*.bitrix24.eu https://*.bitrix24.de">
</head>
```

### 6.4 Domínios Bitrix24 Conhecidos

| Região | Domínio |
|--------|---------|
| Brasil | `*.bitrix24.com.br` |
| Internacional | `*.bitrix24.com` |
| Rússia | `*.bitrix24.ru` |
| Europa | `*.bitrix24.eu` |
| Alemanha | `*.bitrix24.de` |
| Ucrânia | `*.bitrix24.ua` |
| Polônia | `*.bitrix24.pl` |
| Índia | `*.bitrix24.in` |

---

## 7. Extração de Domínio - Armadilhas

### 7.1 O Problema

O Bitrix24 envia o domínio em diferentes formatos:
- `empresa.bitrix24.com.br` (completo)
- `empresa` (apenas nome)
- Via parâmetro `DOMAIN`
- Via objeto `auth.domain`
- Via PHP array notation `auth[domain]`

### 7.2 Função de Extração Robusta

```typescript
function extractDomainFromRequest(
  bodyText: string, 
  contentType: string, 
  headers: Headers
): string {
  let domain = '';
  
  // Tentativa 1: JSON body
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(bodyText);
      domain = json.auth?.domain || json.DOMAIN || json.domain || '';
    } catch (e) {}
  }
  
  // Tentativa 2: Form-urlencoded
  if (!domain && bodyText) {
    const params = new URLSearchParams(bodyText);
    
    // PHP array notation
    const parsed = parsePhpArrayNotation(params);
    if (parsed.auth && typeof parsed.auth === 'object') {
      domain = (parsed.auth as Record<string, string>).domain || '';
    }
    
    // Flat params
    if (!domain) {
      domain = params.get('DOMAIN') || params.get('domain') || '';
    }
  }
  
  // Tentativa 3: Headers
  if (!domain) {
    const referer = headers.get('referer') || '';
    const match = referer.match(/https?:\/\/([^\/]+)/);
    if (match && match[1].includes('bitrix24')) {
      domain = match[1];
    }
  }
  
  // Normalizar: remover protocolo se presente
  domain = domain.replace(/^https?:\/\//, '');
  
  return domain;
}
```

### 7.3 Fallback via API

Se o domínio não vier no request, use a API:

```typescript
async function getDomainFromServer(accessToken: string): Promise<string> {
  try {
    const response = await fetch('https://oauth.bitrix.info/rest/server.info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: accessToken }),
    });
    
    const data = await response.json();
    return data.result?.serverEndpoint?.replace('https://', '').replace('/rest/', '') || '';
  } catch (e) {
    console.error('server.info error:', e);
    return '';
  }
}
```

---

## 8. Sistema de Pagamentos Nativos

### 8.1 Arquitetura

```
Portal Bitrix24
      │
      ▼
┌─────────────────────────────────┐
│  sale.paysystem.handler.add    │ ◄── Registra handler
│  (define callback URL)         │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  sale.paysystem.add            │ ◄── Cria método de pagamento
│  (PIX, Boleto, Cartão)         │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  Usuário seleciona pagamento   │
│  no checkout                   │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  Bitrix chama ACTION_URI       │
│  (bitrix-payment-iframe)       │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  Edge Function processa        │
│  e retorna iframe de checkout  │
└─────────────────────────────────┘
```

### 8.2 Registro de Handler

```typescript
const handlerParams = {
  NAME: 'Seu Conector Pagamentos',
  CODE: 'seu_conector_payments',
  SORT: 100,
  SETTINGS: {
    CURRENCY: ['BRL'],
    CLIENT_TYPE: 'b2c',
    IFRAME_DATA: {
      ACTION_URI: 'https://xxx.supabase.co/functions/v1/bitrix-payment-iframe',
      FIELDS: {
        PAYMENT_ID: { CODE: 'PAYMENT_ID' },
        PAYMENT_SHOULD_PAY: { CODE: 'PAYMENT_SHOULD_PAY' },
        PS_SUM: { CODE: 'PS_SUM' },
        BUYER_PERSON_FIRST_NAME: { CODE: 'BUYER_PERSON_FIRST_NAME' },
        BUYER_PERSON_LAST_NAME: { CODE: 'BUYER_PERSON_LAST_NAME' },
        BUYER_PERSON_EMAIL: { CODE: 'BUYER_PERSON_EMAIL' },
        BUYER_PERSON_PHONE: { CODE: 'BUYER_PERSON_PHONE' },
      }
    }
  }
};

const result = await callBitrixApi(endpoint, 'sale.paysystem.handler.add', handlerParams, token);
```

### 8.3 Criação de Pay System

```typescript
// Obter personTypeId dinamicamente (CRÍTICO!)
const personTypes = await callBitrixApi(endpoint, 'sale.persontype.list', {}, token);
const personTypeId = personTypes.result?.[0]?.ID || '1';

const paySystemParams = {
  NAME: 'Seu Conector - PIX',
  PSA_NAME: 'seu_conector_pix',
  ACTION_FILE: 'seu_conector_payments',  // Deve corresponder ao CODE do handler
  ENTITY_REGISTRY_TYPE: 'ORDER',
  PERSON_TYPE_ID: personTypeId,
  NEW_WINDOW: 'N',
  ACTIVE: 'Y',
  SORT: 100,
};

const result = await callBitrixApi(endpoint, 'sale.paysystem.add', paySystemParams, token);
```

### 8.4 Campos Disponíveis no Checkout

| Campo | Descrição |
|-------|-----------|
| `PAYMENT_ID` | ID do pagamento no Bitrix |
| `PAYMENT_SHOULD_PAY` | Valor a pagar |
| `PS_SUM` | Valor total |
| `BUYER_PERSON_FIRST_NAME` | Primeiro nome |
| `BUYER_PERSON_LAST_NAME` | Sobrenome |
| `BUYER_PERSON_EMAIL` | E-mail |
| `BUYER_PERSON_PHONE` | Telefone |
| `ORDER_ID` | ID do pedido |
| `ACCOUNT_NUMBER` | Número da conta |

---

## 9. Robots de Automação

### 9.1 Estrutura Completa de um Robot

```typescript
const robotDefinition = {
  CODE: 'seu_conector_criar_cobranca',          // Identificador único
  NAME: 'Seu Conector: Criar Cobrança',         // Nome exibido na UI
  USE_PLACEMENT: 'N',                           // Não usar placement
  PLACEMENT_HANDLER: robotHandlerUrl,           // URL do handler
  
  // Propriedades de entrada (parâmetros que o usuário configura)
  PROPERTIES: {
    amount: {
      Name: 'Valor',
      Type: 'double',
      Required: 'Y',
      Description: 'Valor da cobrança em reais',
    },
    payment_method: {
      Name: 'Forma de Pagamento',
      Type: 'select',
      Required: 'Y',
      Options: {
        pix: 'PIX',
        boleto: 'Boleto Bancário',
        credit_card: 'Cartão de Crédito',
      },
    },
    due_date: {
      Name: 'Data de Vencimento',
      Type: 'date',
      Required: 'N',
    },
    customer_name: {
      Name: 'Nome do Cliente',
      Type: 'string',
      Required: 'N',
    },
    customer_email: {
      Name: 'E-mail do Cliente',
      Type: 'string',
      Required: 'N',
    },
    customer_document: {
      Name: 'CPF/CNPJ',
      Type: 'string',
      Required: 'N',
    },
  },
  
  // Propriedades de retorno (valores que o robot retorna)
  RETURN_PROPERTIES: {
    payment_id: {
      Name: 'ID do Pagamento',
      Type: 'string',
    },
    payment_url: {
      Name: 'Link de Pagamento',
      Type: 'string',
    },
    status: {
      Name: 'Status',
      Type: 'string',
    },
    error_message: {
      Name: 'Mensagem de Erro',
      Type: 'string',
    },
  },
};
```

### 9.2 Tipos de Campo Suportados

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `string` | Texto simples | Nome, E-mail |
| `text` | Texto longo | Descrição |
| `int` | Número inteiro | Quantidade |
| `double` | Número decimal | Valor em R$ |
| `bool` | Sim/Não | Ativo? |
| `date` | Data | Vencimento |
| `datetime` | Data e hora | Data de criação |
| `select` | Lista de opções | Forma de pagamento |
| `user` | Usuário do Bitrix | Responsável |
| `file` | Arquivo | Anexo |

### 9.3 Robots Comuns

| Robot | Código | Descrição |
|-------|--------|-----------|
| Criar Cobrança | `criar_cobranca` | Cria pagamento avulso |
| Verificar Pagamento | `verificar_pagamento` | Consulta status |
| Criar Assinatura | `criar_assinatura` | Cria recorrência |
| Cancelar Assinatura | `cancelar_assinatura` | Cancela recorrência |
| Emitir Nota Fiscal | `emitir_nf` | Gera NF-e/NFS-e |

### 9.4 Tratamento de Erro: Robot Já Existe

```typescript
try {
  await callBitrixApi(endpoint, 'bizproc.robot.add', robot, token);
} catch (e) {
  const errorMsg = String(e);
  
  // Ignorar se robot já existe
  if (errorMsg.includes('ERROR_ACTIVITY_ALREADY_INSTALLED')) {
    console.log('Robot already installed, skipping');
  } else {
    throw e;
  }
}
```

---

## 10. Sistema de Auto-Reparo

### 10.1 Conceito de Lazy Registration

O registro de Pay Systems e Robots **não acontece na instalação**, mas sim na **primeira abertura do app** pelo usuário. Isso porque:

1. O endpoint de instalação (`bitrix-install`) não tem todas as informações
2. Alguns escopos só ficam disponíveis após instalação completa
3. Permite re-registro em caso de falha

### 10.2 Fluxo de Auto-Reparo

```
Usuário abre app
       │
       ▼
┌─────────────────────────────────┐
│ Verificar pay_systems_registered│
│ e robots_registered             │
└─────────────────────────────────┘
       │
       ▼
   Flag = false?
       │
   ┌───┴───┐
   │       │
   Sim     Não
   │       │
   ▼       ▼
┌──────────────┐  ┌──────────────┐
│ Registrar    │  │ Continuar    │
│ componentes  │  │ normalmente  │
└──────────────┘  └──────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Atualizar flag = true           │
└─────────────────────────────────┘
```

### 10.3 Função ensureAutomationRobots

```typescript
async function ensureAutomationRobots(
  supabase: ReturnType<typeof createClient>,
  installation: BitrixInstallation,
  robotHandlerUrl: string,
  forceRepair: boolean = false
): Promise<void> {
  // Skip se já registrado e não forçando reparo
  if (installation.robots_registered && !forceRepair) {
    console.log('Robots already registered, skipping');
    return;
  }
  
  const endpoint = `https://${installation.domain}/rest/`;
  const token = installation.access_token;
  
  console.log('Checking/registering robots...');
  
  // 1. Listar robots existentes
  const existingRobots = await callBitrixApi(endpoint, 'bizproc.robot.list', {}, token);
  const existingCodes = new Set(
    (existingRobots.result || []).map((r: { CODE: string }) => r.CODE)
  );
  
  // 2. Definir robots necessários
  const requiredRobots = [
    {
      CODE: 'seu_conector_criar_cobranca',
      NAME: 'Seu Conector: Criar Cobrança',
      // ... resto da definição
    },
    {
      CODE: 'seu_conector_verificar_pagamento',
      NAME: 'Seu Conector: Verificar Pagamento',
      // ... resto da definição
    },
  ];
  
  // 3. Registrar robots faltantes
  for (const robot of requiredRobots) {
    if (existingCodes.has(robot.CODE)) {
      console.log(`Robot ${robot.CODE} already exists`);
      
      // Se forçando reparo, deletar e recriar
      if (forceRepair) {
        await callBitrixApi(endpoint, 'bizproc.robot.delete', { CODE: robot.CODE }, token);
        await callBitrixApi(endpoint, 'bizproc.robot.add', { ...robot, PLACEMENT_HANDLER: robotHandlerUrl }, token);
        console.log(`Robot ${robot.CODE} recreated`);
      }
    } else {
      await callBitrixApi(endpoint, 'bizproc.robot.add', { ...robot, PLACEMENT_HANDLER: robotHandlerUrl }, token);
      console.log(`Robot ${robot.CODE} created`);
    }
  }
  
  // 4. Atualizar flag
  await supabase
    .from('bitrix_installations')
    .update({ robots_registered: true })
    .eq('id', installation.id);
}
```

### 10.4 Botão de Reparo Manual

Adicione na interface do app:

```html
<a href="?repair=true" class="btn btn-secondary">
  🔧 Reparar Integração
</a>
```

O parâmetro `repair=true` força re-registro mesmo que flags estejam `true`.

---

## 11. Autenticação Multi-Tenant

### 11.1 Fluxo Completo

```
1. Usuário instala app no Bitrix24
   └── bitrix_installations criado com tenant_id = NULL

2. Usuário abre app e vê mensagem "Configure sua conta"
   └── Link para página de cadastro com ?bitrix_domain=xxx

3. Usuário cria conta no seu sistema
   └── Durante signup, passar bitrix_domain nos metadados

4. Trigger automático vincula instalação
   └── tenant_id atualizado com UUID do usuário

5. Próxima abertura do app mostra "Integração Ativa"
```

### 11.2 Página de Auth com Bitrix Domain

```tsx
// src/pages/Auth.tsx
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const bitrixDomain = searchParams.get('bitrix_domain') || '';
  
  const handleSignup = async (email: string, password: string, companyName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
          bitrix_domain: bitrixDomain, // CRÍTICO: passar o domínio
        },
      },
    });
    
    if (error) throw error;
    return data;
  };
  
  return (
    <div>
      {bitrixDomain && (
        <div className="alert">
          Vinculando ao portal: <strong>{bitrixDomain}</strong>
        </div>
      )}
      {/* Formulário de cadastro */}
    </div>
  );
}
```

### 11.3 Trigger de Vinculação Automática

```sql
-- Já mostrado na seção 4.5, mas repetindo por importância
CREATE OR REPLACE FUNCTION public.link_bitrix_installation_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_bitrix_domain TEXT;
BEGIN
  v_bitrix_domain := NEW.raw_user_meta_data ->> 'bitrix_domain';
  
  IF v_bitrix_domain IS NOT NULL AND v_bitrix_domain != '' THEN
    UPDATE bitrix_installations
    SET tenant_id = NEW.id, updated_at = now()
    WHERE domain ILIKE '%' || v_bitrix_domain || '%'
      AND tenant_id IS NULL
      AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_link_bitrix
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_bitrix_installation_on_signup();
```

---

## 12. Webhooks Bidirecionais

### 12.1 Arquitetura

```
API Externa (Asaas)              Seu Sistema              Bitrix24
      │                              │                        │
      │  1. Evento de pagamento      │                        │
      ├─────────────────────────────►│                        │
      │                              │                        │
      │                              │ 2. Processar evento    │
      │                              │ 3. Atualizar status    │
      │                              │                        │
      │                              │ 4. Notificar Bitrix    │
      │                              ├───────────────────────►│
      │                              │                        │
      │                              │                        │ 5. Atualizar deal
```

### 12.2 Webhook Handler

```typescript
// supabase/functions/asaas-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    externalReference?: string;
    confirmedDate?: string;
  };
}

serve(async (req) => {
  console.log('=== ASAAS-WEBHOOK START ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AsaasWebhookPayload = await req.json();
    console.log('Webhook event:', payload.event);
    console.log('Payment ID:', payload.payment?.id);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Mapear status do Asaas para nosso sistema
    const statusMap: Record<string, string> = {
      'CONFIRMED': 'confirmed',
      'RECEIVED': 'received',
      'PENDING': 'pending',
      'OVERDUE': 'overdue',
      'REFUNDED': 'refunded',
      'DELETED': 'cancelled',
    };
    
    if (payload.payment) {
      const newStatus = statusMap[payload.payment.status] || 'pending';
      
      // Atualizar transação no banco
      const { data: transaction, error } = await supabase
        .from('transactions')
        .update({
          status: newStatus,
          payment_date: payload.payment.confirmedDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('asaas_id', payload.payment.id)
        .select('*, tenant_id')
        .single();
      
      if (error) {
        console.error('Transaction update error:', error);
      } else if (transaction?.bitrix_entity_id) {
        // Notificar Bitrix24
        await notifyBitrix(supabase, transaction);
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function notifyBitrix(
  supabase: ReturnType<typeof createClient>,
  transaction: { tenant_id: string; bitrix_entity_type?: string; bitrix_entity_id?: string; status: string }
): Promise<void> {
  // Buscar instalação do tenant
  const { data: installation } = await supabase
    .from('bitrix_installations')
    .select('*')
    .eq('tenant_id', transaction.tenant_id)
    .eq('status', 'active')
    .single();
  
  if (!installation?.access_token) {
    console.log('No active Bitrix installation for tenant');
    return;
  }
  
  const endpoint = `https://${installation.domain}/rest/`;
  
  // Atualizar deal no Bitrix
  if (transaction.bitrix_entity_type === 'deal' && transaction.bitrix_entity_id) {
    const stageMap: Record<string, string> = {
      'confirmed': 'WON',
      'received': 'WON',
      'cancelled': 'LOSE',
    };
    
    const newStage = stageMap[transaction.status];
    if (newStage) {
      await fetch(`${endpoint}crm.deal.update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth: installation.access_token,
          id: transaction.bitrix_entity_id,
          fields: {
            STAGE_ID: newStage,
          },
        }),
      });
      console.log('Bitrix deal updated');
    }
  }
}
```

---

## 13. Token Refresh e Manutenção

### 13.1 Verificação de Expiração

```typescript
function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  
  const expiration = new Date(expiresAt);
  const now = new Date();
  
  // Considerar expirado 5 minutos antes para evitar race conditions
  const buffer = 5 * 60 * 1000; // 5 minutos
  
  return now.getTime() > expiration.getTime() - buffer;
}
```

### 13.2 Refresh Antes de Chamadas

```typescript
async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  installation: BitrixInstallation
): Promise<string | null> {
  if (!isTokenExpired(installation.expires_at)) {
    return installation.access_token;
  }
  
  console.log('Token expired, refreshing...');
  
  // Chamar endpoint de refresh
  const response = await fetch(`${SUPABASE_URL}/functions/v1/bitrix-refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installation_id: installation.id }),
  });
  
  if (!response.ok) {
    console.error('Token refresh failed');
    return null;
  }
  
  // Buscar instalação atualizada
  const { data: updated } = await supabase
    .from('bitrix_installations')
    .select('access_token')
    .eq('id', installation.id)
    .single();
  
  return updated?.access_token || null;
}
```

### 13.3 Cron Job para Refresh Preventivo

Configure um cron para chamar `bitrix-refresh-token` periodicamente:

```typescript
// Chamar via Supabase pg_cron ou serviço externo
// A cada 6 horas, renovar tokens que expiram nas próximas 24h
```

---

## 14. Templates de Código Testados

### 14.1 Template Base de Edge Function

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Sua lógica aqui
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

### 14.2 Helper callBitrixApi

```typescript
async function callBitrixApi(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<unknown> {
  const url = `${endpoint}${method}`;
  
  console.log(`Bitrix API: ${method}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      auth: accessToken,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Bitrix API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Bitrix API error: ${data.error} - ${data.error_description || ''}`);
  }
  
  return data;
}
```

### 14.3 Helper parsePhpArrayNotation (Completo)

```typescript
/**
 * Parser robusto para dados do Bitrix24
 * 
 * Suporta:
 * - JSON: { "auth": { "access_token": "xxx" } }
 * - Form flat: AUTH_ID=xxx&MEMBER_ID=yyy
 * - PHP array: auth[access_token]=xxx&auth[member_id]=yyy
 */
function parsePhpArrayNotation(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of params.entries()) {
    // Padrão: auth[access_token] -> { auth: { access_token: value } }
    const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
    
    if (nestedMatch) {
      const [, parent, child] = nestedMatch;
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {};
      }
      (result[parent] as Record<string, string>)[child] = value;
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

function extractAuthData(contentType: string, bodyText: string): {
  accessToken: string;
  refreshToken: string;
  memberId: string;
  domain: string;
  expiresIn: number;
  scope: string;
  applicationToken: string;
} {
  let auth: Record<string, string> = {};
  
  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(bodyText);
      auth = json.auth || {};
      
      // Fallback para formato flat
      if (!auth.access_token && json.AUTH_ID) {
        auth = {
          access_token: json.AUTH_ID,
          refresh_token: json.REFRESH_ID || '',
          member_id: json.member_id || json.MEMBER_ID || '',
          domain: json.DOMAIN || '',
          expires_in: json.AUTH_EXPIRES || '3600',
          scope: json.SCOPE || '',
          application_token: json.APP_SID || '',
        };
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  } else {
    const params = new URLSearchParams(bodyText);
    const parsed = parsePhpArrayNotation(params);
    
    if (parsed.auth && typeof parsed.auth === 'object') {
      auth = parsed.auth as Record<string, string>;
    } else {
      auth = {
        access_token: params.get('AUTH_ID') || params.get('access_token') || '',
        refresh_token: params.get('REFRESH_ID') || params.get('refresh_token') || '',
        member_id: params.get('member_id') || params.get('MEMBER_ID') || '',
        domain: params.get('DOMAIN') || params.get('domain') || '',
        expires_in: params.get('AUTH_EXPIRES') || params.get('expires_in') || '3600',
        scope: params.get('SCOPE') || params.get('scope') || '',
        application_token: params.get('APP_SID') || params.get('application_token') || '',
      };
    }
  }
  
  return {
    accessToken: auth.access_token || '',
    refreshToken: auth.refresh_token || '',
    memberId: auth.member_id || '',
    domain: auth.domain || '',
    expiresIn: parseInt(auth.expires_in || '3600'),
    scope: auth.scope || '',
    applicationToken: auth.application_token || '',
  };
}
```

---

## 15. Troubleshooting Expandido

### 15.1 Tabela de Erros Comuns

| # | Erro | Causa | Solução |
|---|------|-------|---------|
| 1 | `URL not accessible` | Marketplace não consegue acessar Edge Function | Verificar deploy, CORS, e resposta para GET/POST vazio |
| 2 | Tela branca no iframe | Headers CSP incorretos | Adicionar todos domínios Bitrix24 no CSP |
| 3 | `member_id undefined` | Parsing incorreto | Usar `parsePhpArrayNotation` |
| 4 | `ERROR_HANDLER_ALREADY_EXIST` | Handler já registrado | Ignorar erro e continuar com pay systems |
| 5 | `ERROR_ACTIVITY_ALREADY_INSTALLED` | Robot já existe | Ignorar erro ou deletar+recriar |
| 6 | `PERSON_TYPE_NOT_FOUND` | personTypeId fixo | Consultar `sale.persontype.list` dinamicamente |
| 7 | Token expirado | Access token venceu | Implementar refresh token automático |
| 8 | `Invalid grant` | Refresh token inválido | Marcar instalação como `expired`, pedir reinstalação |
| 9 | RLS bloqueando | tenant_id NULL | Verificar trigger de vinculação automática |
| 10 | Robots não aparecem | Não registrados | Verificar flag `robots_registered`, usar repair |
| 11 | Pay Systems não aparecem | Não registrados | Verificar flag `pay_systems_registered`, usar repair |
| 12 | `domain is undefined` | Extração falhou | Usar função `extractDomainFromRequest` robusta |
| 13 | Webhook não chega | URL incorreta ou CORS | Verificar logs, CORS headers |
| 14 | Status não atualiza no Bitrix | Webhook handler não notificando | Verificar logs do webhook handler |
| 15 | Instalação não vincula | Domínio não corresponde | Usar ILIKE com wildcards no trigger |
| 16 | `Forbidden` no REST API | Token sem escopo | Verificar escopos na configuração do app |
| 17 | `Method not found` | Método não existe | Verificar documentação da API |
| 18 | JSON parse error | Body não é JSON | Detectar Content-Type corretamente |
| 19 | `installFinish` não funciona | SDK não carregou | Adicionar timeout e verificar BX24 |
| 20 | Duplicatas na instalação | Sem upsert por member_id | Usar `upsert` com `onConflict: 'member_id'` |
| 21 | Erro de CORS | Headers faltando | Adicionar `corsHeaders` em TODAS respostas |
| 22 | Timeout na Edge Function | Processamento lento | Otimizar queries, usar cache |
| 23 | `auth.uid() is null` | Chamada sem autenticação | Usar service role key no backend |
| 24 | Props do robot NULL | Não extraindo properties | Usar `parsePhpArrayNotation` para properties |
| 25 | `event_token` não funciona | Formato incorreto | Extrair corretamente do body |

### 15.2 Consultas SQL para Debug

```sql
-- Ver todas instalações
SELECT id, domain, member_id, tenant_id, status, pay_systems_registered, robots_registered, created_at
FROM bitrix_installations
ORDER BY created_at DESC;

-- Ver instalações ativas sem tenant
SELECT domain, member_id, created_at
FROM bitrix_installations
WHERE tenant_id IS NULL AND status = 'active';

-- Ver transações recentes
SELECT id, asaas_id, status, amount, created_at
FROM transactions
ORDER BY created_at DESC
LIMIT 20;

-- Ver logs de erro
SELECT action, status, error_message, created_at
FROM integration_logs
WHERE status = 'error'
ORDER BY created_at DESC
LIMIT 50;

-- Verificar tokens expirando
SELECT domain, expires_at, 
  CASE WHEN expires_at < NOW() THEN 'EXPIRED' 
       WHEN expires_at < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON'
       ELSE 'OK' END as token_status
FROM bitrix_installations
WHERE status = 'active';
```

### 15.3 Verificação de Instalação

```sql
-- Script completo de verificação
SELECT 
  bi.domain,
  bi.member_id,
  bi.status,
  bi.tenant_id IS NOT NULL as has_tenant,
  bi.pay_systems_registered,
  bi.robots_registered,
  bi.access_token IS NOT NULL as has_token,
  bi.expires_at,
  CASE WHEN bi.expires_at < NOW() THEN 'EXPIRED' ELSE 'VALID' END as token_status,
  p.email as tenant_email,
  p.company_name
FROM bitrix_installations bi
LEFT JOIN profiles p ON p.id = bi.tenant_id
ORDER BY bi.created_at DESC;
```

---

## 16. Checklist de Deploy Completo

### 16.1 Antes de Submeter ao Marketplace

- [ ] **Secrets configurados**
  - [ ] `BITRIX_CLIENT_ID`
  - [ ] `BITRIX_CLIENT_SECRET`
  - [ ] `APP_DOMAIN`
  - [ ] API key da integração externa (se aplicável)

- [ ] **Edge Functions deployadas**
  - [ ] `bitrix-install`
  - [ ] `bitrix-uninstall`
  - [ ] `bitrix-payment-iframe`
  - [ ] `bitrix-robot-handler`
  - [ ] `bitrix-refresh-token`
  - [ ] Webhook handler

- [ ] **config.toml configurado**
  - [ ] `verify_jwt = false` para todas functions do Bitrix

- [ ] **Banco de dados**
  - [ ] Tabelas criadas
  - [ ] RLS policies ativas
  - [ ] Trigger de vinculação criado

- [ ] **CSP Headers**
  - [ ] Todos domínios Bitrix24 incluídos
  - [ ] Meta tag CSP no HTML

### 16.2 Testes de Fluxo

- [ ] Instalação via Marketplace
- [ ] Validação do Marketplace (GET e POST vazio)
- [ ] Registro de Pay Systems
- [ ] Registro de Robots
- [ ] Criação de conta e vinculação
- [ ] Checkout de pagamento
- [ ] Execução de Robot
- [ ] Recebimento de webhook
- [ ] Atualização de status no Bitrix
- [ ] Reparo de integração
- [ ] Desinstalação

### 16.3 Validação Final

- [ ] Logs sem erros críticos
- [ ] Todas instalações com `pay_systems_registered = true`
- [ ] Todas instalações com `robots_registered = true`
- [ ] Tokens renovando automaticamente
- [ ] UI funcionando dentro do iframe

---

## 17. Prompts Recomendados para Lovable

### 17.1 Prompt: Criar Novo Conector

```markdown
Quero criar um conector Bitrix24 Marketplace para integrar a API [NOME_DA_API].

Funcionalidades:
1. Instalação OAuth 2.0 com upsert por member_id
2. Pay Systems nativos: PIX, Boleto e Cartão
3. Robots de automação: Criar Cobrança e Verificar Pagamento
4. Webhook handler para receber eventos da API
5. Sistema de auto-reparo (lazy registration)
6. Multi-tenant com RLS

Use os patterns documentados:
- parsePhpArrayNotation para parsing robusto
- CSP headers completos para iframe
- extractDomainFromRequest para extração de domínio

Edge Functions necessárias:
- bitrix-install
- bitrix-uninstall
- bitrix-payment-iframe
- bitrix-robot-handler
- bitrix-refresh-token
- [api]-webhook

Todas functions devem ter verify_jwt = false no config.toml.
```

### 17.2 Prompt: Adicionar Novo Robot

```markdown
Preciso adicionar um novo robot de automação ao conector Bitrix24 existente.

Robot: "[NOME_DO_ROBOT]"
Código: "[codigo_do_robot]"

Propriedades de entrada:
- [prop1]: tipo [type], obrigatório [S/N]
- [prop2]: tipo [type], obrigatório [S/N]

Propriedades de retorno:
- [return1]: tipo [type]
- [return2]: tipo [type]

Lógica: [descrever o que o robot deve fazer]

Atualizar:
1. Definição do robot em bitrix-payment-iframe (ensureRobotsRegistered)
2. Handler do robot em bitrix-robot-handler (switch case)
3. Resetar flag robots_registered para forçar re-registro
```

### 17.3 Prompt: Adicionar Pay System

```markdown
Quero adicionar um novo método de pagamento ao conector Bitrix24.

Método: [NOME]
Código: [codigo]

Configurações específicas:
- [config1]: [valor]
- [config2]: [valor]

Atualizar:
1. Array de payMethods em ensurePaySystemsRegistered
2. Lógica de checkout em bitrix-payment-iframe para esse método
3. Handler na API externa para criar cobrança desse tipo
```

### 17.4 Prompt: Debug de Problema

```markdown
Estou tendo o seguinte erro no conector Bitrix24:

Erro: [MENSAGEM_DE_ERRO]

Contexto:
- Função: [qual Edge Function]
- Ação: [o que estava tentando fazer]
- Logs: [colar logs relevantes]

Por favor:
1. Identificar a causa provável
2. Sugerir correção
3. Adicionar logs extras para debug futuro
```

---

## Conclusão

Este guia contém toda a documentação necessária para criar conectores Bitrix24 Marketplace profissionais usando Lovable. 

Os principais pontos a lembrar:

1. **Sempre use `parsePhpArrayNotation`** para parsing robusto
2. **Sempre inclua CSP headers completos** para iframes funcionarem
3. **Use lazy registration** para Pay Systems e Robots
4. **Implemente sistema de auto-reparo** com botão manual
5. **Configure `verify_jwt = false`** para todas Edge Functions do Bitrix
6. **Teste o fluxo completo** antes de submeter ao Marketplace

Se encontrar problemas não documentados aqui, adicione à seção de Troubleshooting para referência futura.

---

**Versão**: 3.0  
**Autor**: Documentação baseada em implementação real de produção  
**Licença**: Uso interno
