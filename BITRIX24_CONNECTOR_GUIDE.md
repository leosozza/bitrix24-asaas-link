# Guia Completo: Desenvolvimento de Conectores Bitrix24 Marketplace

Este documento contém toda a documentação técnica necessária para criar conectores profissionais para o Marketplace do Bitrix24, incluindo OAuth, Pay Systems, Robots de Automação, Webhooks e templates de código.

---

## Índice

1. [Introdução e Arquitetura](#1-introdução-e-arquitetura)
2. [Configuração no Painel de Vendors Bitrix24](#2-configuração-no-painel-de-vendors-bitrix24)
3. [Estrutura de Tabelas do Banco de Dados](#3-estrutura-de-tabelas-do-banco-de-dados)
4. [Edge Functions - Ciclo de Vida do App](#4-edge-functions---ciclo-de-vida-do-app)
5. [Sistema de Pagamentos Nativos (Pay Systems)](#5-sistema-de-pagamentos-nativos-pay-systems)
6. [Robots de Automação](#6-robots-de-automação)
7. [Sistema de Auto-Reparo](#7-sistema-de-auto-reparo)
8. [Autenticação e Configuração do Tenant](#8-autenticação-e-configuração-do-tenant)
9. [Webhooks Bidirecionais](#9-webhooks-bidirecionais)
10. [Boas Práticas e Patterns](#10-boas-práticas-e-patterns)
11. [Checklist de Deploy](#11-checklist-de-deploy)
12. [Templates de Código](#12-templates-de-código)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Introdução e Arquitetura

### O que é um Conector Bitrix24?

Um conector Bitrix24 é uma aplicação que integra serviços externos ao CRM do Bitrix24, permitindo:
- Processamento de pagamentos nativos
- Automações via Robots de Business Process
- Sincronização bidirecional de dados
- Extensão de funcionalidades do CRM

### Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────────┐
│                     BITRIX24 PORTAL                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   CRM Deals  │  │   Invoices   │  │  Automation  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS (Supabase)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │bitrix-install│  │bitrix-iframe │  │ robot-handler│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ installations│  │ transactions │  │    logs      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API EXTERNA (ex: Asaas)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológica

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth + OAuth Bitrix24

### Modelo Multi-Tenant

Cada instalação do Bitrix24 representa um tenant isolado:
- `tenant_id`: UUID do usuário proprietário
- `member_id`: Identificador único do portal Bitrix24
- RLS (Row Level Security) para isolamento de dados

---

## 2. Configuração no Painel de Vendors Bitrix24

### 2.1 Criando a Aplicação

1. Acesse: https://vendors.bitrix24.com/
2. Clique em "Add Application"
3. Preencha as informações básicas:
   - **Name**: Nome do seu conector
   - **Description**: Descrição detalhada
   - **Category**: Escolha a categoria apropriada

### 2.2 Configuração de URLs

Configure as seguintes URLs no painel:

| Campo | URL | Descrição |
|-------|-----|-----------|
| **Application URL** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-payment-iframe` | Interface principal do app |
| **Installer URL** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-install` | Chamada durante instalação |
| **Uninstall URL** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-uninstall` | Chamada durante desinstalação |
| **Settings Handler** | `https://{PROJECT_ID}.supabase.co/functions/v1/bitrix-payment-iframe?settings=true` | Configurações do app |

### 2.3 Configuração OAuth 2.0

Após criar a aplicação, você receberá:

- **Client ID**: `app.XXXXXXXX.XXXXXXXX`
- **Client Secret**: String secreta para autenticação

Armazene como segredos no Supabase:
- `BITRIX_CLIENT_ID`
- `BITRIX_CLIENT_SECRET`

### 2.4 Escopos Necessários

Selecione os escopos baseados nas funcionalidades:

```
# Essenciais
crm              # Acesso ao CRM
user             # Informações do usuário

# Para Pagamentos Nativos
sale             # Sistema de vendas/pagamentos
salescenter      # Sales Center

# Para Automações
bizproc          # Business Processes / Robots

# Para Webhooks
event            # Registro de eventos

# Para Smart Processes
crm.type         # Tipos de entidade CRM
```

### 2.5 Configurações Adicionais

- **Application Token**: Token estático para validação (opcional)
- **Logo**: Upload de logo 100x100px
- **Screenshots**: Até 5 screenshots do app

---

## 3. Estrutura de Tabelas do Banco de Dados

### 3.1 Tabela Principal: bitrix_installations

```sql
-- Registro de instalações do Bitrix24
CREATE TABLE public.bitrix_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificadores do Portal
  domain TEXT NOT NULL,                    -- portal.bitrix24.com.br
  member_id TEXT UNIQUE,                   -- ID único do portal
  
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
  
  -- Vínculo com Tenant
  tenant_id UUID REFERENCES public.profiles(id),
  
  -- Flags de Registro (para Lazy Registration)
  pay_systems_registered BOOLEAN NOT NULL DEFAULT false,
  robots_registered BOOLEAN DEFAULT false,
  
  -- Status e Timestamps
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_bitrix_installations_member_id ON public.bitrix_installations(member_id);
CREATE INDEX idx_bitrix_installations_tenant_id ON public.bitrix_installations(tenant_id);
CREATE INDEX idx_bitrix_installations_domain ON public.bitrix_installations(domain);

-- RLS
ALTER TABLE public.bitrix_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert installations" 
  ON public.bitrix_installations FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can view own or unlinked installations" 
  ON public.bitrix_installations FOR SELECT 
  USING ((auth.uid() = tenant_id) OR (tenant_id IS NULL));

CREATE POLICY "Users can update their own installations" 
  ON public.bitrix_installations FOR UPDATE 
  USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete their own installations" 
  ON public.bitrix_installations FOR DELETE 
  USING (auth.uid() = tenant_id);
```

### 3.2 Tabela de Pay Systems (se aplicável)

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
```

### 3.3 Tabela de Logs de Integração

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

### 3.4 Tabela de Transações

```sql
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Identificadores externos
  asaas_id TEXT,                           -- ID na API externa
  bitrix_entity_type TEXT,                 -- 'deal', 'invoice'
  bitrix_entity_id TEXT,
  
  -- Dados do cliente
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  
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

### 3.5 Tabela de Configurações da API Externa

```sql
CREATE TABLE public.external_api_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id),
  
  api_key TEXT,                            -- Chave da API externa
  environment TEXT NOT NULL DEFAULT 'sandbox' 
    CHECK (environment IN ('sandbox', 'production')),
  
  -- Webhook configurado automaticamente
  webhook_configured BOOLEAN NOT NULL DEFAULT false,
  webhook_id TEXT,
  webhook_secret TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.external_api_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own config" 
  ON public.external_api_configurations FOR ALL 
  USING (auth.uid() = tenant_id);
```

---

## 4. Edge Functions - Ciclo de Vida do App

### 4.1 bitrix-install (Instalação)

Esta função é chamada quando o usuário instala o app no portal Bitrix24.

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
const APP_DOMAIN = Deno.env.get('APP_DOMAIN') || 'your-app.com';

interface BitrixInstallData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  domain: string;
  member_id: string;
  scope: string;
  server_endpoint: string;
  client_endpoint: string;
  application_token?: string;
  user_id?: string;
}

/**
 * Parsing robusto de dados do Bitrix24
 * Suporta múltiplos formatos: JSON, form-urlencoded, PHP array notation
 */
function parseBitrixData(contentType: string, bodyText: string): BitrixInstallData {
  let data: Record<string, unknown> = {};
  
  if (contentType.includes('application/json')) {
    data = JSON.parse(bodyText);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(bodyText);
    
    // Suporte a notação PHP array: auth[access_token]
    for (const [key, value] of params.entries()) {
      const match = key.match(/^(\w+)\[(\w+)\]$/);
      if (match) {
        const [, parent, child] = match;
        if (!data[parent]) data[parent] = {};
        (data[parent] as Record<string, string>)[child] = value;
      } else {
        data[key] = value;
      }
    }
  }
  
  // Extrair dados de auth (pode estar aninhado ou plano)
  const auth = data.auth as Record<string, string> || {};
  
  return {
    access_token: auth.access_token || data.AUTH_ID as string || '',
    refresh_token: auth.refresh_token || data.REFRESH_ID as string || '',
    expires_in: parseInt(auth.expires_in || data.AUTH_EXPIRES as string || '3600'),
    domain: auth.domain || data.DOMAIN as string || '',
    member_id: auth.member_id || data.MEMBER_ID as string || '',
    scope: auth.scope || data.SCOPE as string || '',
    server_endpoint: auth.server_endpoint || data.SERVER_ENDPOINT as string || '',
    client_endpoint: auth.client_endpoint || '',
    application_token: auth.application_token || data.APP_SID as string,
    user_id: data.user_id as string || auth.user_id,
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Install Handler called');
    console.log('Method:', req.method);
    
    // Validação do Marketplace (GET ou POST vazio)
    if (req.method === 'GET') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    // POST vazio = validação
    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Parse dos dados
    const installData = parseBitrixData(contentType, bodyText);
    
    console.log('Install data parsed:', {
      domain: installData.domain,
      member_id: installData.member_id,
      has_tokens: !!installData.access_token && !!installData.refresh_token,
    });
    
    // Validação mínima
    if (!installData.domain || !installData.member_id) {
      console.log('Missing domain or member_id, returning OK for validation');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Inicializa Supabase com service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Calcula expiração do token
    const expiresAt = new Date(Date.now() + (installData.expires_in * 1000)).toISOString();
    
    // Upsert da instalação (ON CONFLICT member_id)
    const { error: upsertError } = await supabase
      .from('bitrix_installations')
      .upsert({
        domain: installData.domain,
        member_id: installData.member_id,
        access_token: installData.access_token,
        refresh_token: installData.refresh_token,
        expires_at: expiresAt,
        scope: installData.scope,
        server_endpoint: installData.server_endpoint,
        client_endpoint: installData.client_endpoint || `https://${installData.domain}/rest/`,
        application_token: installData.application_token,
        bitrix_user_id: installData.user_id,
        status: 'active',
        // Reset flags para garantir re-registro em reinstalações
        pay_systems_registered: false,
        robots_registered: false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'member_id',
      });

    if (upsertError) {
      console.error('Error upserting installation:', upsertError);
      throw upsertError;
    }
    
    console.log('Installation saved successfully');
    
    // Retorna página de sucesso com BX24.installFinish()
    const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Instalação Concluída</title>
  <script src="https://${installData.domain}/bitrix/js/rest/jquery.min.js"></script>
  <script src="https://${installData.domain}/bitrix/js/rest/bx24.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 40px 60px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .success-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Instalação Concluída!</h1>
    <p>O aplicativo foi instalado com sucesso.</p>
    <p>Você pode fechar esta janela.</p>
  </div>
  <script>
    if (typeof BX24 !== 'undefined') {
      BX24.init(function() {
        BX24.installFinish();
      });
    }
  </script>
</body>
</html>`;

    return new Response(successHtml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-install:', error);
    
    return new Response(
      `<html><body>Error: ${errorMessage}</body></html>`,
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      }
    );
  }
});
```

### 4.2 bitrix-uninstall (Desinstalação)

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

interface BitrixUninstallEvent {
  event: string;
  auth: {
    domain: string;
    member_id: string;
    application_token: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Uninstall Handler called');
    
    // Validação GET
    if (req.method === 'GET') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    // Validação POST vazio
    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    let eventData: BitrixUninstallEvent;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyText);
      const authStr = params.get('auth') || '';
      eventData = {
        event: params.get('event') || 'ONAPPUNINSTALL',
        auth: authStr ? JSON.parse(authStr) : {},
      };
    } else {
      eventData = JSON.parse(bodyText);
    }
    
    console.log('Uninstall event:', eventData);
    
    const { auth } = eventData;
    
    if (!auth?.member_id) {
      console.log('Missing member_id, returning OK');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Busca instalação
    const { data: installation, error: findError } = await supabase
      .from('bitrix_installations')
      .select('id')
      .eq('member_id', auth.member_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !installation) {
      console.log('Installation not found');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Marca como revogado e limpa dados sensíveis
    const { error: updateError } = await supabase
      .from('bitrix_installations')
      .update({
        status: 'revoked',
        access_token: null,
        refresh_token: null,
        application_token: null,
        // Reset flags para garantir re-registro em nova instalação
        pay_systems_registered: false,
        robots_registered: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', installation.id);

    if (updateError) {
      console.error('Error updating installation:', updateError);
      throw updateError;
    }

    // Limpa pay systems associados
    const { error: paySystemError } = await supabase
      .from('bitrix_pay_systems')
      .delete()
      .eq('installation_id', installation.id);

    if (paySystemError) {
      console.error('Error deleting pay systems:', paySystemError);
    }

    console.log(`Uninstall processed for domain: ${auth.domain}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-uninstall:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### 4.3 bitrix-payment-iframe (Interface Principal + Lazy Registration)

Esta é a função mais complexa, responsável por:
1. Renderizar a interface do app dentro do Bitrix24
2. Lazy Registration de Pay Systems e Robots
3. Processamento de pagamentos
4. Auto-reparo de configurações

```typescript
// supabase/functions/bitrix-payment-iframe/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_DOMAIN = Deno.env.get('APP_DOMAIN') || 'your-app.com';

// Chamada à API do Bitrix24
async function callBitrixApi(
  endpoint: string, 
  accessToken: string, 
  method: string, 
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const url = `${endpoint}${method}`;
  console.log(`Calling Bitrix API: ${url}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken }),
  });
  
  const data = await response.json();
  
  if (data.error) {
    console.error(`Bitrix API error: ${data.error} - ${data.error_description}`);
  }
  
  return data;
}

// Registro de Pay Systems
async function registerPaySystems(
  clientEndpoint: string,
  accessToken: string,
  installationId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; registered: string[] }> {
  const registered: string[] = [];
  
  // 1. Buscar tipos de pessoa disponíveis
  const personTypeResult = await callBitrixApi(
    clientEndpoint, accessToken, 'sale.persontype.list', {}
  );
  
  const personTypes = personTypeResult.result as Array<{ ID: string }> || [];
  const personTypeId = personTypes[0]?.ID || '1';
  
  console.log(`Using PERSON_TYPE_ID: ${personTypeId}`);
  
  // 2. Registrar o handler
  const handlerUrl = `${SUPABASE_URL}/functions/v1/bitrix-payment-process`;
  
  const handlerResult = await callBitrixApi(
    clientEndpoint, accessToken, 'sale.paysystem.handler.add',
    {
      NAME: 'Your Connector Payments',
      CODE: 'your_connector_payments',
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
          },
        },
      },
    }
  );
  
  const handlerId = handlerResult.result as string;
  
  if (handlerResult.error && handlerResult.error !== 'ERROR_HANDLER_ALREADY_EXIST') {
    console.error('Error registering handler:', handlerResult.error);
    return { success: false, registered };
  }
  
  // 3. Criar métodos de pagamento
  const paymentMethods = [
    { code: 'pix', name: 'PIX' },
    { code: 'boleto', name: 'Boleto Bancário' },
    { code: 'credit_card', name: 'Cartão de Crédito' },
  ];
  
  for (const method of paymentMethods) {
    const paySystemResult = await callBitrixApi(
      clientEndpoint, accessToken, 'sale.paysystem.add',
      {
        NAME: `Your Connector - ${method.name}`,
        PSA_NAME: `Your Connector - ${method.name}`,
        CODE: `your_connector_${method.code}`,
        SORT: 100,
        ACTIVE: 'Y',
        ENTITY_REGISTRY_TYPE: 'ORDER',
        PERSON_TYPE_ID: personTypeId,
        ACTION_FILE: handlerUrl,
        HANDLER: handlerId || 'your_connector_payments',
        RESULT_FILE: handlerUrl,
      }
    );
    
    if (paySystemResult.result) {
      registered.push(method.code);
      
      // Salvar no banco
      await supabase
        .from('bitrix_pay_systems')
        .upsert({
          installation_id: installationId,
          payment_method: method.code,
          pay_system_id: paySystemResult.result as string,
          handler_id: handlerId,
          is_active: true,
        }, {
          onConflict: 'installation_id,payment_method',
        });
    }
  }
  
  // 4. Atualizar flag
  await supabase
    .from('bitrix_installations')
    .update({ pay_systems_registered: true })
    .eq('id', installationId);
  
  return { success: true, registered };
}

// Registro de Robots de Automação
async function registerAutomationRobots(
  clientEndpoint: string,
  accessToken: string,
  installationId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; registered: string[] }> {
  const handlerUrl = `${SUPABASE_URL}/functions/v1/bitrix-robot-handler`;
  
  const robots = [
    {
      CODE: 'your_connector_create_charge',
      NAME: 'Your Connector: Criar Cobrança',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        payment_method: {
          Name: 'Método de Pagamento',
          Type: 'select',
          Options: { pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão' },
          Required: 'Y',
          Default: 'pix',
        },
        amount: {
          Name: 'Valor (R$)',
          Type: 'double',
          Required: 'Y',
        },
        customer_name: {
          Name: 'Nome do Cliente',
          Type: 'string',
          Required: 'Y',
        },
        customer_document: {
          Name: 'CPF/CNPJ',
          Type: 'string',
          Required: 'Y',
        },
        customer_email: {
          Name: 'Email',
          Type: 'string',
          Required: 'N',
        },
        due_days: {
          Name: 'Dias para Vencimento',
          Type: 'int',
          Default: 7,
        },
      },
      RETURN_PROPERTIES: {
        charge_id: { Name: 'ID da Cobrança', Type: 'string' },
        payment_url: { Name: 'Link de Pagamento', Type: 'string' },
        pix_code: { Name: 'Código PIX', Type: 'string' },
        boleto_url: { Name: 'URL do Boleto', Type: 'string' },
        status: { Name: 'Status', Type: 'string' },
        error: { Name: 'Erro', Type: 'string' },
      },
    },
    {
      CODE: 'your_connector_check_payment',
      NAME: 'Your Connector: Verificar Pagamento',
      HANDLER: handlerUrl,
      AUTH_USER_ID: 1,
      USE_SUBSCRIPTION: 'Y',
      PROPERTIES: {
        charge_id: {
          Name: 'ID da Cobrança',
          Type: 'string',
          Required: 'Y',
        },
      },
      RETURN_PROPERTIES: {
        status: { Name: 'Status', Type: 'string' },
        payment_date: { Name: 'Data do Pagamento', Type: 'string' },
        error: { Name: 'Erro', Type: 'string' },
      },
    },
  ];
  
  const registered: string[] = [];
  
  for (const robot of robots) {
    const result = await callBitrixApi(
      clientEndpoint, accessToken, 'bizproc.robot.add', robot
    );
    
    if (result.result || result.error === 'ERROR_ACTIVITY_ALREADY_INSTALLED') {
      registered.push(robot.CODE);
      console.log(`Robot registered: ${robot.CODE}`);
    } else if (result.error) {
      console.error(`Error registering robot ${robot.CODE}:`, result.error);
    }
  }
  
  // Atualizar flag
  await supabase
    .from('bitrix_installations')
    .update({ robots_registered: true })
    .eq('id', installationId);
  
  return { success: true, registered };
}

// Verificar e reparar robots
async function ensureAutomationRobots(
  clientEndpoint: string,
  accessToken: string,
  installationId: string,
  supabase: ReturnType<typeof createClient>,
  forceRepair: boolean = false
): Promise<{ repaired: boolean; registered: string[] }> {
  const expectedRobots = ['your_connector_create_charge', 'your_connector_check_payment'];
  
  // Listar robots existentes
  const listResult = await callBitrixApi(
    clientEndpoint, accessToken, 'bizproc.robot.list', {}
  );
  
  const existingRobots = (listResult.result as Array<{ CODE: string }> || [])
    .map(r => r.CODE);
  
  console.log('Existing robots:', existingRobots);
  
  const missingRobots = expectedRobots.filter(code => !existingRobots.includes(code));
  
  if (missingRobots.length === 0 && !forceRepair) {
    console.log('All robots present');
    return { repaired: false, registered: [] };
  }
  
  console.log(`Missing robots: ${missingRobots.join(', ')}, repairing...`);
  
  // Re-registrar robots
  const result = await registerAutomationRobots(
    clientEndpoint, accessToken, installationId, supabase
  );
  
  return { repaired: true, registered: result.registered };
}

serve(async (req) => {
  const url = new URL(req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validação GET
    if (req.method === 'GET' && !url.searchParams.has('settings')) {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    // Validação POST vazio
    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Parse dados
    const params = new URLSearchParams(bodyText);
    const domain = params.get('DOMAIN') || '';
    const authId = params.get('AUTH_ID') || '';
    const memberId = params.get('member_id') || params.get('MEMBER_ID') || '';
    
    const isSettings = url.searchParams.get('settings') === 'true';
    const isRepair = url.searchParams.get('repair') === 'true';
    
    // Contexto de pagamento
    const paymentId = params.get('PAYMENT_ID');
    const amount = params.get('PAYMENT_SHOULD_PAY') || params.get('PS_SUM');
    const isPaymentContext = !!paymentId && !!amount;
    
    console.log('Context:', { domain, memberId, isSettings, isRepair, isPaymentContext });
    
    if (!domain || !authId) {
      return new Response('<html><body>Missing domain or auth</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const clientEndpoint = `https://${domain}/rest/`;
    
    // Buscar instalação
    const { data: installation } = await supabase
      .from('bitrix_installations')
      .select('*')
      .eq('domain', domain)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!installation) {
      return new Response(`
        <html>
        <head><script src="https://${domain}/bitrix/js/rest/bx24.min.js"></script></head>
        <body>
          <h2>Instalação não encontrada</h2>
          <p>Por favor, reinstale o aplicativo.</p>
        </body>
        </html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    
    // Lazy Registration: Pay Systems
    if (!installation.pay_systems_registered) {
      console.log('Registering pay systems...');
      await registerPaySystems(clientEndpoint, authId, installation.id, supabase);
    }
    
    // Lazy Registration: Robots
    if (!installation.robots_registered) {
      console.log('Registering robots...');
      await registerAutomationRobots(clientEndpoint, authId, installation.id, supabase);
    }
    
    // Auto-reparo se solicitado ou fora de contexto de pagamento
    if (isRepair || (!isPaymentContext && installation.robots_registered)) {
      await ensureAutomationRobots(clientEndpoint, authId, installation.id, supabase, isRepair);
    }
    
    // Decidir qual interface renderizar
    if (isPaymentContext) {
      // Renderizar checkout de pagamento
      return renderPaymentCheckout(domain, paymentId!, amount!, params);
    } else if (isSettings) {
      // Renderizar configurações
      return renderSettingsPage(domain, installation);
    } else {
      // Renderizar dashboard
      return renderDashboard(domain, installation);
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    
    return new Response(`<html><body>Error: ${errorMessage}</body></html>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});

// Funções de renderização (simplificadas)
function renderPaymentCheckout(domain: string, paymentId: string, amount: string, params: URLSearchParams) {
  return new Response(`
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://${domain}/bitrix/js/rest/bx24.min.js"></script>
      <style>
        body { font-family: system-ui; padding: 20px; }
        .payment-form { max-width: 400px; margin: 0 auto; }
        /* Adicione seu CSS */
      </style>
    </head>
    <body>
      <div class="payment-form">
        <h2>Pagamento</h2>
        <p>Valor: R$ ${parseFloat(amount).toFixed(2)}</p>
        <!-- Seu formulário de pagamento -->
      </div>
    </body>
    </html>
  `, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function renderSettingsPage(domain: string, installation: Record<string, unknown>) {
  return new Response(`
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://${domain}/bitrix/js/rest/bx24.min.js"></script>
      <style>body { font-family: system-ui; padding: 20px; }</style>
    </head>
    <body>
      <h2>Configurações</h2>
      <p>Configure sua API Key aqui.</p>
      <!-- Seu formulário de configuração -->
    </body>
    </html>
  `, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function renderDashboard(domain: string, installation: Record<string, unknown>) {
  return new Response(`
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://${domain}/bitrix/js/rest/bx24.min.js"></script>
      <style>body { font-family: system-ui; padding: 20px; }</style>
    </head>
    <body>
      <h2>Dashboard</h2>
      <p>Bem-vindo ao seu conector!</p>
      <!-- Seu dashboard -->
    </body>
    </html>
  `, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}
```

---

## 5. Sistema de Pagamentos Nativos (Pay Systems)

### 5.1 Conceitos

O Bitrix24 permite registrar sistemas de pagamento nativos que aparecem no:
- Sales Center
- Faturas
- Checkout de Negócios

### 5.2 Fluxo de Registro

```
1. sale.paysystem.handler.add  →  Registra o handler (define a URL de callback)
2. sale.paysystem.add         →  Cria o método de pagamento específico
```

### 5.3 Estrutura do Handler

```typescript
{
  NAME: 'Nome do Conector',
  CODE: 'codigo_unico',
  SORT: 100,
  SETTINGS: {
    CURRENCY: ['BRL'],
    CLIENT_TYPE: 'b2c',
    IFRAME_DATA: {
      ACTION_URI: 'https://sua-url.com/payment-process',
      FIELDS: {
        PAYMENT_ID: { CODE: 'PAYMENT_ID' },
        PAYMENT_SHOULD_PAY: { CODE: 'PAYMENT_SHOULD_PAY' },
        PS_SUM: { CODE: 'PS_SUM' },
        BUYER_PERSON_FIRST_NAME: { CODE: 'BUYER_PERSON_FIRST_NAME' },
        BUYER_PERSON_LAST_NAME: { CODE: 'BUYER_PERSON_LAST_NAME' },
        BUYER_PERSON_EMAIL: { CODE: 'BUYER_PERSON_EMAIL' },
        BUYER_PERSON_PHONE: { CODE: 'BUYER_PERSON_PHONE' },
      },
    },
  },
}
```

### 5.4 Campos Disponíveis

| Campo | Descrição |
|-------|-----------|
| `PAYMENT_ID` | ID único do pagamento |
| `PAYMENT_SHOULD_PAY` | Valor a pagar |
| `PS_SUM` | Valor total |
| `BUYER_PERSON_*` | Dados do comprador |
| `ORDER_*` | Dados do pedido |
| `PAYMENT_*` | Dados do pagamento |

### 5.5 Person Type Dinâmico

Importante: Cada portal pode ter IDs diferentes para tipos de pessoa. Sempre consulte:

```typescript
const result = await callBitrixApi(endpoint, token, 'sale.persontype.list', {});
const personTypeId = result.result[0]?.ID || '1';
```

---

## 6. Robots de Automação

### 6.1 Conceitos

Robots são ações automatizadas que podem ser usadas em:
- Workflows de Negócios (Deals)
- Workflows de Leads
- Workflows customizados
- Smart Processes

### 6.2 Estrutura de um Robot

```typescript
{
  // Identificação
  CODE: 'seu_conector_acao',           // Código único (snake_case)
  NAME: 'Seu Conector: Nome da Ação',  // Nome exibido na UI
  
  // Handler
  HANDLER: 'https://sua-url.com/robot-handler',
  AUTH_USER_ID: 1,                     // ID do usuário para execução
  USE_SUBSCRIPTION: 'Y',               // Usar modelo de assinatura
  
  // Parâmetros de entrada
  PROPERTIES: {
    campo_texto: {
      Name: 'Nome do Campo',
      Type: 'string',
      Required: 'Y',                   // 'Y' ou 'N'
      Default: 'valor padrão',
    },
    campo_numero: {
      Name: 'Valor',
      Type: 'double',                  // int, double, string
      Required: 'Y',
    },
    campo_select: {
      Name: 'Opção',
      Type: 'select',
      Options: { 
        opcao1: 'Opção 1', 
        opcao2: 'Opção 2' 
      },
      Required: 'Y',
      Default: 'opcao1',
    },
    campo_data: {
      Name: 'Data',
      Type: 'date',
      Required: 'N',
    },
    campo_bool: {
      Name: 'Ativo?',
      Type: 'bool',
      Default: 'Y',
    },
  },
  
  // Valores de retorno
  RETURN_PROPERTIES: {
    resultado_id: { Name: 'ID do Resultado', Type: 'string' },
    status: { Name: 'Status', Type: 'string' },
    erro: { Name: 'Mensagem de Erro', Type: 'string' },
  },
}
```

### 6.3 Tipos de Campo Suportados

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `string` | Texto simples | Nome, Email |
| `int` | Número inteiro | Quantidade, Dias |
| `double` | Número decimal | Valor, Porcentagem |
| `bool` | Sim/Não | Ativo |
| `date` | Data | Vencimento |
| `datetime` | Data e hora | Agendamento |
| `select` | Seleção única | Status |
| `text` | Texto longo | Descrição |
| `user` | Usuário Bitrix | Responsável |
| `file` | Arquivo | Anexo |

### 6.4 Handler de Robots

```typescript
// supabase/functions/bitrix-robot-handler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RobotRequest {
  code: string;                          // Código do robot
  event_token: string;                   // Token para resposta
  document_id: string[];                 // [tipo, entidade, id]
  document_type: string[];               // Tipo do documento
  workflow_id: string;                   // ID do workflow
  properties: Record<string, unknown>;   // Parâmetros de entrada
  ts: number;
  auth: {
    domain: string;
    member_id: string;
    access_token: string;
  };
}

async function callBitrixApi(endpoint: string, token: string, method: string, params: Record<string, unknown> = {}) {
  const response = await fetch(`${endpoint}${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: token }),
  });
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validação
    if (req.method === 'GET') {
      return new Response('OK', { headers: corsHeaders });
    }
    
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    if (!bodyText) {
      return new Response('OK', { headers: corsHeaders });
    }
    
    // Parse
    let robotRequest: RobotRequest;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyText);
      
      // Parse complexo do formato Bitrix
      const authStr = params.get('auth');
      const propertiesStr = params.get('properties');
      
      robotRequest = {
        code: params.get('code') || '',
        event_token: params.get('event_token') || '',
        document_id: JSON.parse(params.get('document_id') || '[]'),
        document_type: JSON.parse(params.get('document_type') || '[]'),
        workflow_id: params.get('workflow_id') || '',
        properties: propertiesStr ? JSON.parse(propertiesStr) : {},
        ts: parseInt(params.get('ts') || '0'),
        auth: authStr ? JSON.parse(authStr) : {},
      };
    } else {
      robotRequest = JSON.parse(bodyText);
    }
    
    console.log('Robot request:', robotRequest.code);
    
    const { code, event_token, properties, auth } = robotRequest;
    const clientEndpoint = `https://${auth.domain}/rest/`;
    
    // Processar baseado no código do robot
    let returnValues: Record<string, unknown> = {};
    
    switch (code) {
      case 'your_connector_create_charge':
        returnValues = await handleCreateCharge(properties);
        break;
        
      case 'your_connector_check_payment':
        returnValues = await handleCheckPayment(properties);
        break;
        
      default:
        returnValues = { error: `Robot não reconhecido: ${code}` };
    }
    
    // Enviar resposta ao Bitrix via bizproc.event.send
    await callBitrixApi(clientEndpoint, auth.access_token, 'bizproc.event.send', {
      EVENT_TOKEN: event_token,
      RETURN_VALUES: returnValues,
      LOG_MESSAGE: returnValues.error ? `Erro: ${returnValues.error}` : 'Sucesso',
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Robot handler error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Handlers específicos
async function handleCreateCharge(properties: Record<string, unknown>) {
  try {
    // Sua lógica de criação de cobrança
    const result = {
      charge_id: 'CHARGE_123',
      payment_url: 'https://pay.example.com/123',
      status: 'pending',
    };
    
    return result;
  } catch (error) {
    return { error: String(error) };
  }
}

async function handleCheckPayment(properties: Record<string, unknown>) {
  try {
    // Sua lógica de verificação
    return {
      status: 'confirmed',
      payment_date: new Date().toISOString(),
    };
  } catch (error) {
    return { error: String(error) };
  }
}
```

---

## 7. Sistema de Auto-Reparo

### 7.1 Conceito

O sistema de auto-reparo garante que Pay Systems e Robots estejam sempre registrados, mesmo após:
- Reinstalação do app
- Falhas parciais de registro
- Exclusão manual no portal

### 7.2 Lazy Registration

Registro sob demanda na primeira abertura do app:

```typescript
// No bitrix-payment-iframe
if (!installation.pay_systems_registered) {
  await registerPaySystems(clientEndpoint, authId, installation.id, supabase);
}

if (!installation.robots_registered) {
  await registerAutomationRobots(clientEndpoint, authId, installation.id, supabase);
}
```

### 7.3 Verificação e Reparo

```typescript
async function ensureAutomationRobots(
  clientEndpoint: string,
  accessToken: string,
  installationId: string,
  supabase: ReturnType<typeof createClient>,
  forceRepair: boolean = false
): Promise<{ repaired: boolean; registered: string[] }> {
  
  // Lista esperada de robots
  const expectedRobots = [
    'your_connector_create_charge',
    'your_connector_check_payment',
  ];
  
  // Buscar robots existentes
  const listResult = await callBitrixApi(
    clientEndpoint, accessToken, 'bizproc.robot.list', {}
  );
  
  const existingRobots = (listResult.result as Array<{ CODE: string }> || [])
    .map(r => r.CODE);
  
  // Identificar faltantes
  const missingRobots = expectedRobots.filter(
    code => !existingRobots.includes(code)
  );
  
  // Se todos presentes e não forçado, retorna
  if (missingRobots.length === 0 && !forceRepair) {
    return { repaired: false, registered: [] };
  }
  
  console.log(`Repairing robots: ${missingRobots.join(', ')}`);
  
  // Deletar e re-registrar os faltantes
  for (const code of missingRobots) {
    await callBitrixApi(clientEndpoint, accessToken, 'bizproc.robot.delete', { CODE: code });
  }
  
  // Re-registrar
  const result = await registerAutomationRobots(
    clientEndpoint, accessToken, installationId, supabase
  );
  
  return { repaired: true, registered: result.registered };
}
```

### 7.4 Parâmetro de Reparo Manual

```typescript
// URL: /functions/v1/bitrix-payment-iframe?repair=true

const isRepair = url.searchParams.get('repair') === 'true';

if (isRepair) {
  await ensureAutomationRobots(
    clientEndpoint, authId, installation.id, supabase, true  // force = true
  );
}
```

---

## 8. Autenticação e Configuração do Tenant

### 8.1 Fluxo de Vinculação

```
1. Usuário instala app (bitrix-install)
   → Instalação criada sem tenant_id

2. Usuário abre app pela primeira vez
   → Interface detecta ausência de vínculo
   → Exibe tela de login/cadastro

3. Usuário faz login ou cadastro
   → Sistema vincula installation.tenant_id = user.id
   → Vinculação pode ser automática via member_id ou domain
```

### 8.2 Vinculação Automática via Trigger

```sql
-- Trigger para vincular instalação no cadastro
CREATE OR REPLACE FUNCTION public.link_bitrix_installation_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bitrix_domain text;
BEGIN
  -- Buscar domínio dos metadados do usuário
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

-- Associar trigger ao auth.users
CREATE TRIGGER on_auth_user_created_link_bitrix
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_bitrix_installation_on_signup();
```

### 8.3 Configuração de API Key Externa

```typescript
// supabase/functions/bitrix-config/index.ts

serve(async (req) => {
  // ... parse request
  
  const { api_key, environment, member_id, tenant_id } = requestData;
  
  // Validar API Key antes de salvar
  const baseUrl = environment === 'production' 
    ? 'https://api.external-service.com' 
    : 'https://sandbox.api.external-service.com';
  
  const validationResponse = await fetch(`${baseUrl}/v1/validate`, {
    headers: { 'Authorization': `Bearer ${api_key}` },
  });
  
  if (!validationResponse.ok) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'API Key inválida' 
    }), { status: 400 });
  }
  
  // Salvar configuração
  const { error } = await supabase
    .from('external_api_configurations')
    .upsert({
      tenant_id,
      api_key,
      environment,
      is_active: true,
    }, { onConflict: 'tenant_id' });
  
  if (error) throw error;
  
  return new Response(JSON.stringify({ success: true }));
});
```

---

## 9. Webhooks Bidirecionais

### 9.1 Registro Automático de Webhook

```typescript
async function registerWebhook(
  apiKey: string,
  baseUrl: string,
  webhookUrl: string
): Promise<{ webhookId: string; authToken: string }> {
  
  // Gerar token de autenticação
  const authToken = crypto.randomUUID();
  
  // Registrar webhook na API externa
  const response = await fetch(`${baseUrl}/v1/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: [
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_REFUNDED',
      ],
      authToken,
    }),
  });
  
  const data = await response.json();
  
  return {
    webhookId: data.id,
    authToken,
  };
}
```

### 9.2 Handler de Webhook

```typescript
// supabase/functions/your-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    
    console.log('Webhook received:', webhookData.event);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Validar token (se configurado)
    const authToken = req.headers.get('your-auth-token');
    // ... validação
    
    const { event, payment } = webhookData;
    
    // Mapear status
    const statusMap: Record<string, string> = {
      'PAYMENT_CONFIRMED': 'confirmed',
      'PAYMENT_RECEIVED': 'received',
      'PAYMENT_OVERDUE': 'overdue',
      'PAYMENT_REFUNDED': 'refunded',
    };
    
    const newStatus = statusMap[event];
    
    if (!newStatus) {
      console.log('Event not mapped:', event);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Atualizar transação
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: newStatus,
        payment_date: event.includes('RECEIVED') ? new Date().toISOString() : null,
      })
      .eq('asaas_id', payment.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating transaction:', updateError);
      throw updateError;
    }
    
    // Notificar Bitrix24 (se aplicável)
    if (transaction?.bitrix_entity_id && transaction?.bitrix_entity_type) {
      await notifyBitrix(transaction);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function notifyBitrix(transaction: Record<string, unknown>) {
  // Buscar instalação vinculada
  // Atualizar deal/invoice no Bitrix
  // ... implementação
}
```

---

## 10. Boas Práticas e Patterns

### 10.1 Parsing Robusto de Dados

O Bitrix24 pode enviar dados em múltiplos formatos:

```typescript
function parseBitrixRequest(contentType: string, bodyText: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  
  // JSON
  if (contentType.includes('application/json')) {
    return JSON.parse(bodyText);
  }
  
  // Form URL-encoded
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(bodyText);
    
    for (const [key, value] of params.entries()) {
      // Notação PHP array: auth[access_token]
      const match = key.match(/^(\w+)\[(\w+)\]$/);
      if (match) {
        const [, parent, child] = match;
        if (!data[parent]) data[parent] = {};
        (data[parent] as Record<string, string>)[child] = value;
      } else {
        // Tentar parse JSON para valores complexos
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }
  }
  
  return data;
}
```

### 10.2 Tratamento de Erros

```typescript
try {
  const result = await callBitrixApi(endpoint, token, method, params);
  
  if (result.error) {
    // Erros conhecidos que podem ser ignorados
    const ignorableErrors = [
      'ERROR_HANDLER_ALREADY_EXIST',
      'ERROR_ACTIVITY_ALREADY_INSTALLED',
    ];
    
    if (!ignorableErrors.includes(result.error)) {
      console.error(`Bitrix API error: ${result.error}`);
      throw new Error(result.error_description || result.error);
    }
  }
  
  return result;
} catch (error) {
  // Log detalhado
  console.error('API call failed:', {
    method,
    params,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

### 10.3 Headers CORS Obrigatórios

Sempre inclua em todas as Edge Functions:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// E no início do handler
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

### 10.4 Validação de Marketplace

O Bitrix24 faz chamadas de validação periódicas. Sempre trate:

```typescript
// GET request = validação
if (req.method === 'GET') {
  return new Response('<html><body>OK</body></html>', {
    headers: { ...corsHeaders, 'Content-Type': 'text/html' },
  });
}

// POST com body vazio = validação
if (!bodyText || bodyText.trim() === '') {
  return new Response('<html><body>OK</body></html>', {
    headers: { ...corsHeaders, 'Content-Type': 'text/html' },
  });
}
```

### 10.5 Gerenciamento de Tokens

```typescript
// supabase/functions/bitrix-refresh-token/index.ts

async function refreshBitrixToken(
  refreshToken: string,
  domain: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = Deno.env.get('BITRIX_CLIENT_ID')!;
  const clientSecret = Deno.env.get('BITRIX_CLIENT_SECRET')!;
  
  const response = await fetch(`https://${domain}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  return response.json();
}

// Executar periodicamente (cron ou similar)
async function refreshExpiringTokens() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Buscar tokens expirando em 1 hora
  const { data: installations } = await supabase
    .from('bitrix_installations')
    .select('*')
    .eq('status', 'active')
    .lt('expires_at', new Date(Date.now() + 3600000).toISOString());
  
  for (const installation of installations || []) {
    try {
      const tokens = await refreshBitrixToken(
        installation.refresh_token,
        installation.domain
      );
      
      await supabase
        .from('bitrix_installations')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('id', installation.id);
        
      console.log(`Token refreshed for ${installation.domain}`);
    } catch (error) {
      console.error(`Failed to refresh token for ${installation.domain}:`, error);
      
      await supabase
        .from('bitrix_installations')
        .update({ status: 'expired' })
        .eq('id', installation.id);
    }
  }
}
```

### 10.6 Logging Estruturado

```typescript
async function logIntegrationEvent(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  action: string,
  status: 'success' | 'error',
  details: {
    entityType?: string;
    entityId?: string;
    requestData?: Record<string, unknown>;
    responseData?: Record<string, unknown>;
    errorMessage?: string;
  }
) {
  await supabase.from('integration_logs').insert({
    tenant_id: tenantId,
    action,
    status,
    entity_type: details.entityType,
    entity_id: details.entityId,
    request_data: details.requestData,
    response_data: details.responseData,
    error_message: details.errorMessage,
  });
}
```

---

## 11. Checklist de Deploy

### 11.1 Segredos Necessários

Configure no Supabase (Secrets):

| Nome | Descrição |
|------|-----------|
| `BITRIX_CLIENT_ID` | Client ID do app no marketplace |
| `BITRIX_CLIENT_SECRET` | Client Secret do app |
| `APP_DOMAIN` | Domínio da sua aplicação (ex: app.seudominio.com) |

### 11.2 Edge Functions

Ordem de deploy recomendada:

1. `bitrix-install` - Instalação
2. `bitrix-uninstall` - Desinstalação
3. `bitrix-payment-iframe` - Interface principal
4. `bitrix-robot-handler` - Handler de robots
5. `bitrix-refresh-token` - Refresh de tokens
6. `your-webhook` - Webhook da API externa

### 11.3 Configuração do supabase/config.toml

```toml
[project]
project_id = "seu-project-id"

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

[functions.your-webhook]
verify_jwt = false
```

### 11.4 Teste de Fluxo Completo

1. **Instalação**
   - [ ] App instala sem erros
   - [ ] Registro de instalação no banco
   - [ ] BX24.installFinish() executa

2. **Lazy Registration**
   - [ ] Pay Systems registrados na primeira abertura
   - [ ] Robots registrados na primeira abertura
   - [ ] Flags atualizados no banco

3. **Pagamentos**
   - [ ] Checkout abre corretamente
   - [ ] Pagamento processa
   - [ ] Webhook atualiza status

4. **Automações**
   - [ ] Robots aparecem no editor de workflow
   - [ ] Execução retorna valores corretos
   - [ ] Erros tratados adequadamente

5. **Desinstalação**
   - [ ] Tokens limpos
   - [ ] Status marcado como 'revoked'
   - [ ] Flags resetados

---

## 12. Templates de Código

### 12.1 Template de Robot

```typescript
// Definição do Robot
const robot = {
  CODE: 'seu_conector_acao',
  NAME: 'Seu Conector: Ação',
  HANDLER: `${SUPABASE_URL}/functions/v1/seu-robot-handler`,
  AUTH_USER_ID: 1,
  USE_SUBSCRIPTION: 'Y',
  PROPERTIES: {
    // Seus campos de entrada
    campo1: {
      Name: 'Campo 1',
      Type: 'string',
      Required: 'Y',
    },
  },
  RETURN_PROPERTIES: {
    // Seus campos de retorno
    resultado: { Name: 'Resultado', Type: 'string' },
    error: { Name: 'Erro', Type: 'string' },
  },
};

// Handler
async function handleRobot(properties: Record<string, unknown>) {
  try {
    // Sua lógica aqui
    return {
      resultado: 'sucesso',
    };
  } catch (error) {
    return {
      error: String(error),
    };
  }
}
```

### 12.2 Template de Pay System

```typescript
// Registro do Handler
const handler = {
  NAME: 'Seu Conector',
  CODE: 'seu_conector',
  SORT: 100,
  SETTINGS: {
    CURRENCY: ['BRL'],
    CLIENT_TYPE: 'b2c',
    IFRAME_DATA: {
      ACTION_URI: `${SUPABASE_URL}/functions/v1/seu-payment-process`,
      FIELDS: {
        PAYMENT_ID: { CODE: 'PAYMENT_ID' },
        PAYMENT_SHOULD_PAY: { CODE: 'PAYMENT_SHOULD_PAY' },
        // ... campos necessários
      },
    },
  },
};

// Criação do Pay System
const paySystem = {
  NAME: 'Seu Conector - Método',
  CODE: 'seu_conector_metodo',
  ACTIVE: 'Y',
  ENTITY_REGISTRY_TYPE: 'ORDER',
  PERSON_TYPE_ID: personTypeId, // Dinâmico!
  HANDLER: handlerId,
};
```

### 12.3 Template de Webhook Handler

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    
    console.log('Webhook received:', webhookData.event);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Sua lógica de processamento
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 12.4 Template de Edge Function Base

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
    // Validação de marketplace (GET ou POST vazio)
    if (req.method === 'GET') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    const bodyText = await req.text();
    
    if (!bodyText || bodyText.trim() === '') {
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Parse de dados
    const contentType = req.headers.get('content-type') || '';
    let data: Record<string, unknown>;
    
    if (contentType.includes('application/json')) {
      data = JSON.parse(bodyText);
    } else {
      data = Object.fromEntries(new URLSearchParams(bodyText));
    }
    
    // Inicializar Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Sua lógica aqui
    console.log('Request data:', data);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

## 13. Troubleshooting

### 13.1 Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `ERROR_HANDLER_ALREADY_EXIST` | Handler já registrado | Ignorar e continuar |
| `ERROR_ACTIVITY_ALREADY_INSTALLED` | Robot já instalado | Ignorar e continuar |
| `PERSON_TYPE_NOT_FOUND` | ID de tipo de pessoa inválido | Consultar `sale.persontype.list` primeiro |
| `ACCESS_DENIED` | Token expirado ou escopo insuficiente | Renovar token ou verificar escopos |
| `QUERY_LIMIT_EXCEEDED` | Muitas requisições | Implementar rate limiting |

### 13.2 Debug de Tokens

```typescript
// Verificar validade do token
async function debugToken(domain: string, accessToken: string) {
  const result = await callBitrixApi(
    `https://${domain}/rest/`,
    accessToken,
    'profile',
    {}
  );
  
  console.log('Token debug:', {
    valid: !result.error,
    user: result.result?.NAME,
    error: result.error,
  });
  
  return result;
}
```

### 13.3 Logs Úteis

```typescript
// Adicione em pontos críticos
console.log('[CONTEXT]', {
  function: 'bitrix-payment-iframe',
  domain,
  memberId,
  isPaymentContext,
  timestamp: new Date().toISOString(),
});

// Para requests Bitrix
console.log('[BITRIX API]', {
  method,
  endpoint,
  params: JSON.stringify(params).slice(0, 200),
  response: JSON.stringify(result).slice(0, 200),
});
```

### 13.4 Verificação de Instalação

```sql
-- Verificar instalações ativas
SELECT 
  domain, 
  member_id, 
  status, 
  pay_systems_registered, 
  robots_registered,
  expires_at,
  updated_at
FROM bitrix_installations
WHERE status = 'active'
ORDER BY updated_at DESC;
```

---

## Conclusão

Este guia cobre todos os aspectos necessários para criar conectores Bitrix24 profissionais e robustos. Ao seguir estas práticas e utilizar os templates fornecidos, você pode acelerar significativamente o desenvolvimento de novas integrações.

### Recursos Adicionais

- [Documentação Oficial Bitrix24 REST API](https://dev.1c-bitrix.ru/rest_help/)
- [Bitrix24 Marketplace Vendors](https://vendors.bitrix24.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

*Documento criado para acelerar o desenvolvimento de conectores Bitrix24 usando Lovable + Supabase.*
