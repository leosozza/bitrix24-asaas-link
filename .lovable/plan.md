## Objetivo

Bloquear o uso do conector até que o tenant conclua a contratação (assinatura Asaas paga). Enquanto não houver assinatura ativa, o usuário vê uma **tela clara exigindo a contratação para continuar o uso**, tanto no dashboard quanto no iframe do Bitrix.

Especificamente:

1. Suspender o **Delivery Real** agora (`status='suspended'`).
2. Ao concluir checkout na Asaas e receber `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, o status volta para `active` automaticamente via webhook.
3. Frontend (dashboard + iframe Bitrix) bloqueia todas as funcionalidades quando o tenant não está `active`/`trial`, mostrando tela de exigência de contratação.

---

## Mudanças

### 1. Banco de dados (migration)

- Convenção: `tenant_subscriptions.status` passa a aceitar `'suspended'` (texto livre, sem enum — sem breaking change).
- Função `public.tenant_has_access(_user_id uuid) returns boolean` (stable, security definer, `search_path=public`):
  - `true` se `status IN ('trial','active')` **e** (`trial_ends_at > now()` OR `current_period_end >= now()`).

### 2. Ação admin: Suspender / Reativar

Em `supabase/functions/admin-tenant-management/index.ts`, `src/hooks/useAdminTenants.ts` e `src/pages/admin/AdminTenants.tsx`:

- Nova ação `suspend` (seta `status='suspended'`, guarda motivo em `notes`).
- Badge "Suspenso" no `statusBadge`.
- Item "Suspender acesso" no dropdown.

### 3. Ativação automática via webhook

Em `supabase/functions/thoth-asaas-webhook/index.ts`, quando o `externalReference` for um `tenant_id`:

- `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → `status='active'`, atualiza `current_period_start/end` e `invoice_url`.
- `PAYMENT_OVERDUE` → `status='past_due'`.
- `SUBSCRIPTION_DELETED` → `status='canceled'`.
- Registro em `integration_logs`.

### 4. Tela de exigência de contratação (o foco desta iteração)

Novo hook `src/hooks/useSubscriptionAccess.ts` — retorna `{ hasAccess, status, reason, subscription, plan }`.

Novo componente `src/components/access/SubscriptionRequiredScreen.tsx` — tela cheia com:

- Título forte: **"Contratação necessária para continuar usando o Asaas Pay by Thoth24"**.
- Subtítulo explicando o motivo conforme `status`:
  - `suspended` → "Seu acesso foi suspenso. Para retomar o uso, contrate o plano Pro."
  - `past_due` → "Sua última fatura está em aberto. Regularize o pagamento para liberar o acesso."
  - `canceled`/`expired` → "Sua assinatura foi encerrada. Contrate novamente para reativar."
  - `trial` vencido → "Seu período de teste terminou. Contrate o plano Pro para continuar."
- Resumo do plano Pro (R$ 249/mês, transações ilimitadas, lista curta de features).
- **Botão primário**: "Contratar agora" → abre `PlanCheckoutModal`.
- **Botão secundário**: "Ver fatura em aberto" quando existir `invoice_url` (past_due).
- Rodapé: contato de suporte.
- Design consistente com a landing (glassmorphism, cores Asaas/Bitrix).

Novo componente `src/components/access/SubscriptionGate.tsx` — envolve `children`. Se sem acesso, renderiza `SubscriptionRequiredScreen`; senão, `children`.

Aplicar em:
- `src/components/dashboard/DashboardLayout.tsx` (envolve o `Outlet`).
- `src/pages/BitrixPreview.tsx` (iframe Bitrix — mesma tela, compacta).
- Rotas isentas: `/admin/**` (super admin) e `/dashboard/settings` (para editar dados de cobrança).

### 5. Aviso persistente antes do bloqueio

`src/components/access/SubscriptionBanner.tsx` — banner amarelo/vermelho no topo do `DashboardLayout` quando:

- `trial` faltando ≤ 5 dias → "Seu teste termina em X dias. Contrate agora para não perder o acesso."
- `past_due` → "Fatura em aberto. Regularize para evitar suspensão."

Botão "Contratar" abre o mesmo `PlanCheckoutModal`.

### 6. Suspender Delivery Real agora

Após deploy, `UPDATE tenant_subscriptions SET status='suspended', notes='Suspenso — aguardando contratação e pagamento do plano Pro' WHERE tenant_id=<id>`.

---

## Detalhes técnicos

- Sem enum Postgres; `status` continua `text`.
- `tenant_has_access` é `security definer` com `search_path=public`.
- Gate é UX/UI; RLS existente continua sendo a barreira de dados.
- `PlanCheckoutModal` já integra com `subscription-checkout` (cria cliente + assinatura + fatura na Asaas). Webhook (passo 3) reativa após pagamento — nenhum trabalho adicional necessário.

## O que não muda

- Preços, planos, RLS, integração Bitrix, layout do admin.
- Trial de 14 dias para novos signups continua igual.
