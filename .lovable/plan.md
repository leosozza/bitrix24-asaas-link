## Fase 1 — Adicionar 3 novas abas no iframe Bitrix

Hoje o dock tem: Overview · Transações · Assinaturas · Faturas · Integrações · Configurações. Vamos adicionar **Notificações**, **Segurança** e **Plano** entre Faturas e Integrações.

### Aba "Plano" 💳

Layout (espelha o que você mostrou):
- Card "Plano e Uso" — plano atual, validade, badge `Trial`/`Ativo`, barra de transações usadas / limite (vem de `tenant_subscriptions` + `subscription_plans`).
- Grid de planos disponíveis (`SELECT * FROM subscription_plans WHERE is_active = true`) com nome, preço, transações/mês, lista de `features`, e botão **Assinar / Fazer Upgrade / Plano atual**.

**Como funciona a contratação dentro do iframe:**
Como o próprio app já é um conector Asaas e a plataforma (Thoth24) tem conta Asaas master, gera-se a cobrança da assinatura pela **conta Asaas da plataforma** (nova secret `PLATFORM_ASAAS_API_KEY` + `PLATFORM_ASAAS_ENV`) — não pela conta Asaas do tenant. Fluxo:
1. Usuário clica "Assinar Pro" → modal escolhe forma de pagamento (PIX / Boleto / Cartão recorrente).
2. Edge function `bitrix-plan-subscribe` cria customer + subscription mensal no Asaas da plataforma.
3. Atualiza `tenant_subscriptions` para `pending_payment` com `plan_id` e `asaas_subscription_id` (nova coluna).
4. Quando o webhook `asaas-webhook` recebe `PAYMENT_CONFIRMED` para a subscription da plataforma, marca `tenant_subscriptions.status = 'active'` e estende `current_period_end`.
5. PIX/Boleto: modal mostra QR code / linha digitável; Cartão: redireciona para checkout do Asaas (link de pagamento), volta com sucesso.

Novos campos:
- `tenant_subscriptions`: `asaas_customer_id text`, `asaas_subscription_id text`, `payment_method text`, `last_payment_url text`.
- Nova secret a pedir depois: `PLATFORM_ASAAS_API_KEY`, `PLATFORM_ASAAS_ENV`.

### Aba "Notificações" 🔔

Toggles iguais ao mockup:
- Notificações por email (transações)
- Alertas de pagamento (pagamento confirmado)
- Relatórios semanais

Persistência em nova tabela `notification_preferences` (PK = `tenant_id`) com colunas `email_transactions bool`, `payment_alerts bool`, `weekly_reports bool`. GRANTs + RLS (`auth.uid() = tenant_id`).

Wire-up real (envio dos e-mails) fica como step futuro — agora só salva as preferências e o backend já lê para decidir se notifica.

### Aba "Segurança" 🛡️

- **Alterar senha** → modal com senha atual + nova + confirmação → `supabase.auth.updateUser({ password })` (no iframe não temos sessão Supabase nativa; vamos fazer via edge function `bitrix-security` que aceita `current_password`, valida com `signInWithPassword` e chama `admin.updateUserById`).
- **Excluir conta** → modal de confirmação digitando o nome da empresa → edge function `bitrix-security` action `delete_account` (chama `auth.admin.deleteUser` + cascata pelas FKs).

### Mudanças no edge function `bitrix-payment-iframe/index.ts`

- HTML: 3 novas `dock-tab` + 3 novos `<div id="tab-plan|notifications|security">`.
- `switchTab`: cases novos chamando `loadPlan()`, `loadNotifications()`, `loadSecurity()`.
- Novas actions no roteador: `get_plan`, `list_plans`, `subscribe_plan`, `get_notifications`, `save_notifications`, `change_password`, `delete_account`.
- Modais de assinatura, alterar senha e excluir conta.

### Arquivos

- `supabase/functions/bitrix-payment-iframe/index.ts` (UI + actions).
- Migração: tabela `notification_preferences` + colunas em `tenant_subscriptions`.
- (Mais tarde, ao ativar pagamento da plataforma) edge function nova `bitrix-plan-subscribe` ou consolidada dentro do iframe.

## Fase 2 (depois) — Aba "Admin" para `leonardo.zogbi@gmail.com`

- Aparece só para usuários com `user_roles.role = 'admin'`. Seed: garantir que o `user_id` cujo email é `leonardo.zogbi@gmail.com` tenha role admin.
- Listagem de tenants (profiles + tenant_subscriptions + bitrix_installations + uso do mês).
- Ações: mudar plano de um tenant, suspender/reativar assinatura, conceder trial estendido, ver últimas transações, ver logs.
- Tudo via edge function `bitrix-admin` com `has_role(auth.uid(), 'admin')` em cada action.

Fica fora do escopo agora; criamos o gancho de role admin já na Fase 1 (apenas a verificação, sem UI).

## Pergunta antes de implementar

Para a aba Plano você quer que a cobrança da assinatura do plano seja feita **pela conta Asaas da plataforma Thoth24** (precisarei pedir as chaves Asaas master numa próxima mensagem), ou **por enquanto deixar como "Solicitar contato comercial"** (botão que abre WhatsApp/email e a ativação é manual no admin)?

Aguardo essa resposta junto com a aprovação para construir.
