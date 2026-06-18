## Fase 2 — Gerenciamento de Tenants e Planos Contratados

Painel super-admin (você/Thoth24) para ver e gerenciar todos os tenants do ConnectPay, com trial automático de 14 dias do Pro e cobrança recorrente via Asaas.

### 1. Banco de dados

**Migration** (única, com aprovação):

- Estender `tenant_subscriptions`:
  - `trial_ends_at timestamptz` (default `now() + 14 days`)
  - `asaas_subscription_id text` (id da assinatura no Asaas Thoth24)
  - `asaas_customer_id text`
  - `cancel_at_period_end boolean default false`
  - `canceled_at timestamptz`
  - `notes text` (anotações do admin)
- Adicionar valor `'past_due'` ao enum `subscription_status` se faltar.
- Atualizar `handle_new_user()` para, após criar profile, criar `tenant_subscriptions` com:
  - `plan_id` = Pro
  - `status` = `'trial'`
  - `trial_ends_at` = `now() + 14 days`
  - `current_period_end` = mesma data
- Adicionar role `'super_admin'` ao enum `app_role` (se não existir).
- RLS:
  - `tenant_subscriptions`: política extra `super_admin` pode SELECT/UPDATE em tudo (via `has_role`).
  - `subscription_plans`: super_admin pode UPDATE (editar preço/limite/features).
  - `profiles`: super_admin pode SELECT todos.
- GRANTs já existem; só adicionar onde faltar para super_admin.
- Seed: marcar seu próprio user como `super_admin` (vou pedir o email na fase de implementação).

### 2. Edge function `admin-tenant-management`

Ações (todas validam `has_role(super_admin)` via JWT):

- `list_tenants` — retorna profiles + subscription + plano + uso atual.
- `change_plan` — troca plano de um tenant; ajusta assinatura no Asaas (cancela antiga, cria nova com novo valor).
- `cancel_subscription` — `cancel_at_period_end=true` ou cancelamento imediato; cancela no Asaas.
- `extend_trial` — adiciona N dias em `trial_ends_at` e `current_period_end`.
- `reactivate` — reativa assinatura cancelada.
- `create_asaas_subscription` — ao fim do trial (ou ação manual), cria customer + subscription no **Asaas do Thoth24** (usa secret `THOTH_ASAAS_API_KEY` — vou pedir via `add_secret`).
- `reset_usage` — zera `transactions_used` no início de cada período.

Webhook `thoth-asaas-webhook` para eventos da nossa própria conta Asaas: `PAYMENT_CONFIRMED` → `status='active'`, novo período; `PAYMENT_OVERDUE` → `'past_due'`; `SUBSCRIPTION_DELETED` → `'canceled'`.

### 3. Cron (pg_cron)

- Diário 03:00: marca como `expired` trials vencidos sem assinatura; envia para cobrança quem optou por continuar.
- Diário 03:10: reseta `transactions_used` quando entra novo período.

### 4. Frontend — Painel Admin

Rota nova `/admin` protegida por `ProtectedRoute` + check `has_role('super_admin')` (redireciona se não for).

Páginas:

- **`/admin`** — Visão geral:
  - Cards: total de tenants, em trial, ativos, inadimplentes, cancelados, MRR estimado.
  - Gráfico simples de novos tenants nos últimos 30 dias.
- **`/admin/tenants`** — Tabela:
  - Colunas: empresa, email, plano atual, status (badge colorido), trial até, próximo vencimento, transações usadas/limite, MRR, ações.
  - Filtros: status, plano, busca por nome/email.
  - Ações por linha (dropdown): Ver detalhes, Trocar plano, Estender trial, Cancelar, Reativar, Adicionar nota.
- **`/admin/tenants/:id`** — Detalhe:
  - Dados do tenant + instalação Bitrix vinculada.
  - Histórico de pagamentos (do Asaas Thoth24).
  - Logs de uso (transações por mês).
  - Notas internas.
- **`/admin/plans`** — Gerenciar planos:
  - Editar nome, preço, transaction_limit, features, is_active dos 3 planos existentes.

### 5. Estrutura de arquivos

```text
src/
  pages/
    admin/
      AdminLayout.tsx
      AdminOverview.tsx
      AdminTenants.tsx
      AdminTenantDetail.tsx
      AdminPlans.tsx
  components/admin/
    TenantTable.tsx
    TenantActionsMenu.tsx
    ChangePlanDialog.tsx
    ExtendTrialDialog.tsx
    PlanEditCard.tsx
  hooks/
    useIsSuperAdmin.ts
    useAdminTenants.ts
supabase/functions/
  admin-tenant-management/index.ts
  thoth-asaas-webhook/index.ts
```

Adicionar item "Admin" no `DashboardSidebar` visível só para super_admins.

### Detalhes técnicos

- Cobrança via Asaas próprio do Thoth24 — separado da conta Asaas que cada cliente conecta no produto. Secret nova: `THOTH_ASAAS_API_KEY` + `THOTH_ASAAS_ENV` (`sandbox`/`production`).
- Trial: ao criar usuário, já entra com plano Pro status `trial` por 14 dias. Sem cartão. Ao expirar, status vira `expired` e o frontend mostra modal bloqueante pedindo escolha de plano.
- Enforcement de limite NÃO entra nesta fase (você marcou apenas Painel Admin). Fica como fase 3.
- Toda ação admin grava em `integration_logs` com `action='admin_*'` para auditoria.

### Fora de escopo (próximas fases)

- Auto-serviço do tenant (upgrade/downgrade pelo próprio cliente).
- Checkout público com cartão para tenant pagar.
- Enforcement automático de limite de transações.
- Emissão de NFSe das mensalidades cobradas.
