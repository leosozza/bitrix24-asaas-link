# ThothAI - API de Integração WhatsApp

## Visão Geral

O ThothAI é um conector de WhatsApp que permite integração com múltiplos providers (Evolution API, W-API, Meta Cloud API) através de uma API unificada.

**Base URL**: `https://api.thoth24.com/v1` (produção)  
**Sandbox URL**: `https://sandbox.thoth24.com/v1` (testes)

**Contato**: contato@thoth24.com | (11) 97865-9280

---

## Autenticação

Todas as requisições devem incluir o header de autenticação:

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Obter API Key

1. Acesse o painel em `https://app.thoth24.com`
2. Vá em **Configurações** → **API Keys**
3. Clique em **Gerar Nova Chave**
4. Copie e armazene a chave com segurança

---

## Endpoints

### 1. Sessões / Instâncias

#### 1.1 Criar Sessão WhatsApp

```http
POST /sessions
```

**Request Body:**
```json
{
  "name": "minha-sessao",
  "provider": "evolution",
  "webhook_url": "https://meusite.com/webhook",
  "webhook_events": ["message", "status", "connection"]
}
```

**Providers disponíveis:**
- `evolution` - Evolution API (recomendado)
- `wapi` - W-API
- `meta` - Meta Cloud API (requer Business Verification)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "session_id": "sess_abc123",
    "name": "minha-sessao",
    "status": "disconnected",
    "provider": "evolution",
    "created_at": "2025-01-08T10:00:00Z"
  }
}
```

---

#### 1.2 Obter QR Code

```http
GET /sessions/{session_id}/qrcode
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "qrcode": "data:image/png;base64,iVBORw0KGgo...",
    "qrcode_text": "2@abc123...",
    "expires_in": 60,
    "status": "waiting_scan"
  }
}
```

**Status possíveis:**
- `waiting_scan` - Aguardando leitura do QR
- `connecting` - QR lido, conectando
- `connected` - Sessão ativa
- `disconnected` - Desconectado

---

#### 1.3 Verificar Status da Sessão

```http
GET /sessions/{session_id}/status
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session_id": "sess_abc123",
    "status": "connected",
    "phone": "5511999999999",
    "name": "João Silva",
    "profile_pic": "https://...",
    "connected_at": "2025-01-08T10:05:00Z"
  }
}
```

---

#### 1.4 Listar Sessões

```http
GET /sessions
```

**Query Parameters:**
- `status` (opcional): `connected`, `disconnected`, `all`
- `page` (opcional): número da página (default: 1)
- `limit` (opcional): itens por página (default: 20, max: 100)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "session_id": "sess_abc123",
        "name": "minha-sessao",
        "status": "connected",
        "phone": "5511999999999"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

---

#### 1.5 Desconectar Sessão

```http
POST /sessions/{session_id}/disconnect
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sessão desconectada com sucesso"
}
```

---

#### 1.6 Deletar Sessão

```http
DELETE /sessions/{session_id}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sessão removida com sucesso"
}
```

---

### 2. Mensagens

#### 2.1 Enviar Mensagem de Texto

```http
POST /messages/text
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "text": "Olá! Esta é uma mensagem de teste.",
  "preview_url": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_xyz789",
    "status": "sent",
    "timestamp": "2025-01-08T10:10:00Z"
  }
}
```

---

#### 2.2 Enviar Imagem

```http
POST /messages/image
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "image_url": "https://exemplo.com/imagem.jpg",
  "caption": "Legenda da imagem (opcional)"
}
```

**Ou com Base64:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "image_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "filename": "foto.jpg",
  "caption": "Legenda da imagem"
}
```

---

#### 2.3 Enviar Documento/Arquivo

```http
POST /messages/document
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "document_url": "https://exemplo.com/arquivo.pdf",
  "filename": "contrato.pdf",
  "caption": "Segue o contrato para assinatura"
}
```

---

#### 2.4 Enviar Áudio

```http
POST /messages/audio
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "audio_url": "https://exemplo.com/audio.mp3",
  "ptt": true
}
```

> `ptt: true` envia como mensagem de voz (bolinha verde)

---

#### 2.5 Enviar Localização

```http
POST /messages/location
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "name": "Av. Paulista, 1000",
  "address": "São Paulo, SP"
}
```

---

#### 2.6 Enviar Contato

```http
POST /messages/contact
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "contact": {
    "name": "João Silva",
    "phone": "5511988888888",
    "email": "joao@email.com"
  }
}
```

---

#### 2.7 Enviar Botões (Interativo)

```http
POST /messages/buttons
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "body": "Escolha uma opção:",
  "footer": "Thoth24",
  "buttons": [
    { "id": "btn_1", "text": "Opção 1" },
    { "id": "btn_2", "text": "Opção 2" },
    { "id": "btn_3", "text": "Opção 3" }
  ]
}
```

> Máximo de 3 botões por mensagem

---

#### 2.8 Enviar Lista

```http
POST /messages/list
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "body": "Selecione um produto:",
  "button_text": "Ver Produtos",
  "footer": "Thoth24",
  "sections": [
    {
      "title": "Categoria A",
      "rows": [
        { "id": "prod_1", "title": "Produto 1", "description": "R$ 99,90" },
        { "id": "prod_2", "title": "Produto 2", "description": "R$ 149,90" }
      ]
    },
    {
      "title": "Categoria B",
      "rows": [
        { "id": "prod_3", "title": "Produto 3", "description": "R$ 199,90" }
      ]
    }
  ]
}
```

---

#### 2.9 Enviar Template (Meta API)

```http
POST /messages/template
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "to": "5511999999999",
  "template_name": "pagamento_confirmado",
  "language": "pt_BR",
  "components": [
    {
      "type": "body",
      "parameters": [
        { "type": "text", "text": "João" },
        { "type": "text", "text": "R$ 150,00" },
        { "type": "text", "text": "12345" }
      ]
    }
  ]
}
```

> Templates devem ser aprovados previamente no Meta Business

---

### 3. Grupos

#### 3.1 Criar Grupo

```http
POST /groups
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "name": "Grupo de Vendas",
  "participants": [
    "5511999999999",
    "5511888888888"
  ]
}
```

---

#### 3.2 Listar Grupos

```http
GET /sessions/{session_id}/groups
```

---

#### 3.3 Adicionar Participante

```http
POST /groups/{group_id}/participants
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "participants": ["5511777777777"]
}
```

---

#### 3.4 Remover Participante

```http
DELETE /groups/{group_id}/participants
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "participants": ["5511777777777"]
}
```

---

### 4. Contatos

#### 4.1 Verificar Número no WhatsApp

```http
POST /contacts/check
```

**Request Body:**
```json
{
  "session_id": "sess_abc123",
  "phones": [
    "5511999999999",
    "5511888888888"
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      { "phone": "5511999999999", "exists": true, "jid": "5511999999999@s.whatsapp.net" },
      { "phone": "5511888888888", "exists": false, "jid": null }
    ]
  }
}
```

---

#### 4.2 Obter Foto de Perfil

```http
GET /contacts/{phone}/profile-pic?session_id={session_id}
```

---

### 5. Webhooks

#### 5.1 Estrutura do Webhook

Quando eventos ocorrem, o ThothAI envia um POST para sua `webhook_url`:

**Headers enviados:**
```http
Content-Type: application/json
X-Thoth-Signature: sha256=abc123...
X-Thoth-Event: message
```

---

#### 5.2 Evento: Nova Mensagem Recebida

```json
{
  "event": "message",
  "session_id": "sess_abc123",
  "timestamp": "2025-01-08T10:15:00Z",
  "data": {
    "message_id": "msg_incoming_123",
    "from": "5511999999999",
    "from_name": "Cliente",
    "to": "5511888888888",
    "type": "text",
    "text": "Olá, preciso de ajuda!",
    "timestamp": "2025-01-08T10:15:00Z",
    "is_group": false,
    "group_id": null
  }
}
```

---

#### 5.3 Evento: Status de Mensagem

```json
{
  "event": "status",
  "session_id": "sess_abc123",
  "timestamp": "2025-01-08T10:16:00Z",
  "data": {
    "message_id": "msg_xyz789",
    "status": "delivered",
    "to": "5511999999999"
  }
}
```

**Status possíveis:**
- `sent` - Enviada (1 check)
- `delivered` - Entregue (2 checks)
- `read` - Lida (2 checks azuis)
- `failed` - Falha no envio

---

#### 5.4 Evento: Conexão

```json
{
  "event": "connection",
  "session_id": "sess_abc123",
  "timestamp": "2025-01-08T10:17:00Z",
  "data": {
    "status": "connected",
    "phone": "5511888888888",
    "reason": null
  }
}
```

---

#### 5.5 Evento: Resposta de Botão/Lista

```json
{
  "event": "message",
  "session_id": "sess_abc123",
  "data": {
    "message_id": "msg_resp_456",
    "from": "5511999999999",
    "type": "button_response",
    "button_id": "btn_1",
    "button_text": "Opção 1",
    "context": {
      "quoted_message_id": "msg_xyz789"
    }
  }
}
```

---

#### 5.6 Validação de Assinatura

Para garantir que o webhook veio do ThothAI:

```javascript
const crypto = require('crypto');

function validateWebhook(payload, signature, secret) {
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Uso
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-thoth-signature'];
  
  if (!validateWebhook(req.body, signature, 'SEU_WEBHOOK_SECRET')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Processar evento
  console.log('Evento:', req.body.event);
  res.status(200).json({ received: true });
});
```

---

## Códigos de Erro

| Código | Erro | Descrição |
|--------|------|-----------|
| 400 | `INVALID_REQUEST` | Parâmetros inválidos ou faltando |
| 401 | `UNAUTHORIZED` | API Key inválida ou ausente |
| 403 | `FORBIDDEN` | Sem permissão para este recurso |
| 404 | `NOT_FOUND` | Recurso não encontrado |
| 409 | `CONFLICT` | Conflito (ex: sessão já existe) |
| 422 | `VALIDATION_ERROR` | Erro de validação nos dados |
| 429 | `RATE_LIMIT` | Limite de requisições excedido |
| 500 | `INTERNAL_ERROR` | Erro interno do servidor |
| 503 | `SESSION_OFFLINE` | Sessão WhatsApp desconectada |

**Exemplo de erro:**
```json
{
  "success": false,
  "error": {
    "code": "SESSION_OFFLINE",
    "message": "A sessão WhatsApp está desconectada. Reconecte via QR Code.",
    "details": {
      "session_id": "sess_abc123",
      "last_connected": "2025-01-08T08:00:00Z"
    }
  }
}
```

---

## Rate Limits

| Plano | Requisições/min | Mensagens/dia |
|-------|-----------------|---------------|
| Starter | 60 | 1.000 |
| Pro | 300 | 10.000 |
| Enterprise | 1.000 | Ilimitado |

Headers de rate limit na resposta:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704708000
```

---

## Integração com Lovable/Supabase

### Edge Function de Exemplo

```typescript
// supabase/functions/send-whatsapp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, session_id } = await req.json();
    
    const THOTH_API_KEY = Deno.env.get('THOTH_API_KEY');
    const THOTH_API_URL = Deno.env.get('THOTH_API_URL') || 'https://api.thoth24.com/v1';
    
    const response = await fetch(`${THOTH_API_URL}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${THOTH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id,
        to,
        text: message,
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
    });

  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

### Webhook Handler

```typescript
// supabase/functions/thoth-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-thoth-signature, x-thoth-event',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('x-thoth-signature');
    const event = req.headers.get('x-thoth-event');
    const payload = await req.json();
    
    console.log(`[ThothAI] Evento recebido: ${event}`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Salvar mensagem recebida
    if (event === 'message') {
      const { error } = await supabase.from('whatsapp_messages').insert({
        message_id: payload.data.message_id,
        session_id: payload.session_id,
        from_phone: payload.data.from,
        from_name: payload.data.from_name,
        message_type: payload.data.type,
        content: payload.data.text || payload.data,
        received_at: payload.timestamp,
      });

      if (error) console.error('Erro ao salvar mensagem:', error);
    }

    // Atualizar status de mensagem enviada
    if (event === 'status') {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ status: payload.data.status })
        .eq('message_id', payload.data.message_id);

      if (error) console.error('Erro ao atualizar status:', error);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

---

## Secrets Necessários

Configure no Supabase/Lovable Cloud:

| Secret | Descrição |
|--------|-----------|
| `THOTH_API_KEY` | Chave de API do ThothAI |
| `THOTH_API_URL` | URL base da API (opcional) |
| `THOTH_WEBHOOK_SECRET` | Secret para validar webhooks |

---

## Tabelas Sugeridas

```sql
-- Tabela para armazenar sessões
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES profiles(id),
  session_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'disconnected',
  provider TEXT DEFAULT 'evolution',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para mensagens
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES profiles(id),
  session_id TEXT NOT NULL,
  message_id TEXT UNIQUE,
  direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
  from_phone TEXT,
  from_name TEXT,
  to_phone TEXT,
  message_type TEXT,
  content JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions" ON whatsapp_sessions
  FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Users manage own messages" ON whatsapp_messages
  FOR ALL USING (auth.uid() = tenant_id);
```

---

## SDKs Disponíveis

### JavaScript/TypeScript

```bash
npm install @thoth24/whatsapp-sdk
```

```typescript
import { ThothWhatsApp } from '@thoth24/whatsapp-sdk';

const thoth = new ThothWhatsApp({
  apiKey: 'sua-api-key',
  environment: 'production', // ou 'sandbox'
});

// Enviar mensagem
const result = await thoth.messages.sendText({
  sessionId: 'sess_abc123',
  to: '5511999999999',
  text: 'Olá!',
});

// Webhook handler (Express)
app.post('/webhook', thoth.webhooks.handler((event) => {
  console.log('Evento:', event.type, event.data);
}));
```

### Python

```bash
pip install thoth24-whatsapp
```

```python
from thoth24 import ThothWhatsApp

thoth = ThothWhatsApp(api_key="sua-api-key")

# Enviar mensagem
result = thoth.messages.send_text(
    session_id="sess_abc123",
    to="5511999999999",
    text="Olá!"
)
```

---

## Suporte

- **Email**: contato@thoth24.com
- **WhatsApp**: (11) 97865-9280
- **Documentação**: https://docs.thoth24.com
- **Status da API**: https://status.thoth24.com

---

## Changelog

### v1.2.0 (2025-01-08)
- Adicionado suporte a templates Meta
- Novo endpoint de verificação de números
- Melhorias no rate limiting

### v1.1.0 (2024-12-15)
- Suporte a mensagens interativas (botões/listas)
- Novo provider W-API

### v1.0.0 (2024-11-01)
- Lançamento inicial
- Suporte Evolution API e Meta Cloud API
