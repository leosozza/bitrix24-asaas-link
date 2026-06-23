
# Auditoria de Submissão — Bitrix24 Marketplace

Análise feita contra a documentação oficial (`apidocs.bitrix24.com/market`) e o `LOVABLE_BITRIX24_MASTERGUIDE.md` do projeto. Abaixo o que **já está OK**, o que **precisa de correção antes de submeter**, e o que será **ajustado no código**.

---

## 1. O que já está conforme

- **OAuth + handlers de ciclo de vida** presentes: `bitrix-install`, `bitrix-uninstall`, `bitrix-refresh-token`.
- **Uninstall trata corretamente** validação do marketplace (GET e POST vazio retornam `200 OK` em HTML) e limpa tokens + flags de re-registro.
- **Pay System Handler** (`asaas_payments`) com `IFRAME_DATA` correto e CODES mapeados (PIX/Boleto/Cartão).
- **Robots de Bizproc** registrados (cobrança, verificar pagamento, assinatura, cancelar, NFSe).
- **Multi-tenant com RLS** e vinculação por `member_id` + `tenant_id` via trigger.
- **APP_DOMAIN / BITRIX_CLIENT_ID / BITRIX_CLIENT_SECRET** usados via env, sem hardcode.
- **Webhooks Asaas** registrados via `SUPABASE_URL` (não pelo APP_DOMAIN), evitando falhas de domínio.
- **Auto-reparo / lazy registration** de pay systems e robots já implementado.

---

## 2. Bloqueadores para a moderação — precisam ser corrigidos

### 2.1 `config.toml` incompleto — endpoints Bitrix com JWT ainda obrigatório

Edge functions chamadas pelo Bitrix mas SEM `verify_jwt = false`:

- `bitrix-contract-robot` (callback de Bizproc — vai falhar 401 em produção)
- `bitrix-contract-fields`
- `bitrix-contract-setup`
- `bitrix-invoice-stages`
- `thoth-asaas-webhook` (webhook externo Asaas)

> Sem essas linhas, na primeira instalação real o Bitrix recebe 401 e o app é rejeitado.

### 2.2 `index.html` com metadados padrão

- `<title>conector Asaas</title>` (não pode ficar minúsculo / genérico).
- `<meta name="author" content="Lovable" />` — moderação reclama de marca de terceiros.
- `og:image` ainda aponta para `lovable.dev/opengraph-image-p98pqg.png`.
- Falta `<meta name="viewport">` com `viewport-fit=cover` opcional, e falta `<html lang="pt-BR">`.

### 2.3 CSP / Headers de iframe

O masterguide define o conjunto de domínios Bitrix24 obrigatório (`*.bitrix24.com`, `.com.br`, `.de`, `.eu`, `.ru`, `.pl`, `.in`, `.kz`, `.ua`, `.by`). Precisamos confirmar que **todas** as functions que respondem HTML para iframe (`bitrix-payment-iframe`, `bitrix-crm-detail-tab`) enviam `Content-Security-Policy: frame-ancestors` cobrindo toda essa lista, **e** a meta-tag CSP no HTML retornado.

### 2.4 Política de uninstall — apagar dados sensíveis

Hoje o `bitrix-uninstall` apenas zera tokens. A regra do marketplace exige que, em desinstalação, **dados pessoais do portal sejam removidos ou anonimizados**. Precisamos:
- Marcar `bitrix_installations.status = 'revoked'` (já feito) **e**
- Apagar `bitrix_pay_systems`, `bitrix_crm_links`, transações órfãs sem `paid_at`, configurações de webhook, e tokens armazenados em qualquer tabela auxiliar.

### 2.5 Tela de instalação (placement DEFAULT)

O Bitrix exige que ao instalar o app o usuário seja recebido por uma tela explicando o que o app faz e o estado da configuração. Validar que a rota `/` dentro do iframe:
- Mostra logo + nome do app + breve descrição
- Indica claramente se a integração Asaas ainda precisa de API key
- Tem botão "Configurar" levando à página de Settings

### 2.6 Tratamento de eventos obrigatórios

A moderação verifica que o app **responde** (sem erro) aos eventos:
- `ONAPPINSTALL` ✅
- `ONAPPUNINSTALL` ✅
- `ONAPPUPDATE` ⚠️ — não tratado hoje (sugerido: tratar igual a install, fazendo refresh de scopes e re-registro lazy)

### 2.7 Scopes solicitados

Conferir no painel de Vendors que os scopes declarados são **apenas os usados**: `crm`, `placement`, `bizproc`, `sale`, `pay_system`, `user`, `task` (se aplicável). Scopes a mais reprovam.

### 2.8 Materiais do Card no Marketplace (entregar à parte do código)

- Logo 88×88 e 200×200 PNG transparente
- 4 a 6 screenshots 1280×800 (instalação, dashboard, checkout PIX, robot no designer, NFSe)
- Descrição curta (até 250 chars) + descrição longa em PT-BR e EN
- Vídeo demo de até 2 min (recomendado, não obrigatório)
- Política de privacidade pública (URL) — **obrigatório**
- Termos de uso (URL) — **obrigatório**
- Contato de suporte (email)

---

## 3. Mudanças no código (a executar quando aprovar o plano)

### Arquivo: `supabase/config.toml`
Adicionar blocos `[functions.<name>] verify_jwt = false` para:
- `bitrix-contract-robot`
- `bitrix-contract-fields`
- `bitrix-contract-setup`
- `bitrix-invoice-stages`
- `thoth-asaas-webhook`

### Arquivo: `index.html`
- `<html lang="pt-BR">`
- `<title>Asaas Pagamentos para Bitrix24</title>`
- Trocar `<meta name="author">` para `Thoth24`
- Remover `og:image` da Lovable; gerar/usar imagem própria em `/public/og-image.png`
- Atualizar `og:title`, `og:description`, `twitter:*` consistentes

### Arquivo: `supabase/functions/bitrix-uninstall/index.ts`
- Após marcar `revoked`, deletar registros em `bitrix_crm_links`, `bitrix_webhooks`, `bitrix_pay_systems` (já), `asaas_webhook_registrations` da instalação
- Manter `bitrix_installations` (auditoria) mas zerar campos PII (`access_token`, `refresh_token`, `application_token`, `client_endpoint` opcional)

### Arquivo: `supabase/functions/bitrix-install/index.ts`
- Adicionar handling de `event === 'ONAPPUPDATE'`: apenas atualizar tokens/scope e forçar re-registro lazy (`pay_systems_registered=false`, `robots_registered=false`)

### Arquivos: `supabase/functions/bitrix-payment-iframe/index.ts` e `bitrix-crm-detail-tab/index.ts`
- Auditoria de CSP: garantir lista completa de `frame-ancestors` cobrindo todos TLDs Bitrix24 documentados no masterguide §6.4

---

## 4. Validações pós-correção

1. `curl` em cada endpoint Bitrix com GET vazio → deve retornar `200` (OK / HTML)
2. `curl -X POST` com body vazio → deve retornar `200`
3. Instalação real em portal de teste → ver logs sem erro
4. Desinstalar e reinstalar → tudo re-registra automaticamente
5. Conferir `chrome devtools` no iframe → sem violação de CSP
6. `npm run build` sem erros, e validar SEO básico

---

## 5. Próximos passos sugeridos

1. Aprovar este plano para eu aplicar as correções de código (itens da seção 3).
2. Em paralelo, você prepara os materiais visuais do card (seção 2.8) — posso gerar logo/screenshots se quiser.
3. Após deploy das correções, fazemos uma rodada de validação contra um portal de teste antes de clicar em "Enviar para moderação".

Quer que eu já execute as correções de código da seção 3, ou prefere ajustar algo no escopo antes?
