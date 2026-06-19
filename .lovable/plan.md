## Objetivo

Finalizar a contratação e pagamento dos planos ConnectPay. O cliente poderá escolher um plano (no cadastro OU via "Fazer Upgrade" nas Configurações), informar CPF/CNPJ e método de pagamento (PIX ou Cartão), e será redirecionado para a fatura do Asaas (`invoiceUrl`) para concluir o pagamento. O webhook Asaas já existente (`thoth-asaas-webhook`) ativa a assinatura automaticamente.

## Fluxos de usuário

### A) No cadastro (novo cliente)
1. Landing → CTA do plano leva para `/auth?plan=<id>&action=signup`.
2. Após criar conta (trigger `handle_new_user` já cria trial Pro de 14 dias).
3. Se houver `?plan=` na URL, exibe modal de checkout direto após login.
4. Cliente pode também clicar "Continuar com Trial" para pular.

### B) Upgrade depois do trial
1. Em `/dashboard/settings`, botão **Fazer Upgrade** abre o mesmo modal de checkout, listando os 3 planos ativos.
2. Cliente escolhe plano e segue o mesmo fluxo.

### Checkout (modal compartilhado)
Passo 1 — Escolher plano (cards Starter/Pro/Enterprise com preço e features).
Passo 2 — Dados de cobrança: CPF/CNPJ (validação básica), telefone (pré-preenchido do perfil).
Passo 3 — Método: **PIX** (padrão) ou **Cartão de crédito**.
Passo 4 — Confirmar → chama edge function → recebe `invoiceUrl` → abre em nova aba e mostra tela "Aguardando pagamento" com botão "Já paguei / Atualizar status".

## Mudanças técnicas

### Backend — edge function `subscription-checkout` (nova, pública para usuários autenticados)
Ação única: `create_checkout`. Recebe `{ plan_id, cpf_cnpj, billing_type, phone? }`.

Reaproveita a lógica existente em `admin-tenant-management/create_asaas_subscription` mas:
- Roda como o próprio tenant (valida JWT, não exige super_admin).
- Atualiza/cria customer no Asaas Thoth24 (busca por CPF/CNPJ, cria se não existir).
- Cria assinatura mensal no Asaas com `value = plan.price`, `cycle: 'MONTHLY'`, `nextDueDate = hoje + 1 dia`.
- Busca a 1ª fatura da assinatura (`GET /subscriptions/{id}/payments`) para obter o `invoiceUrl` retornável.
- Atualiza `tenant_subscriptions`: `plan_id`, `asaas_customer_id`, `asaas_subscription_id`, status mantém `trial` até o webhook confirmar pagamento (e então vira `active`).
- Salva CPF/CNPJ e telefone em `profiles` se ainda não houver.
- Retorna `{ subscription_id, invoice_url, payment_id }`.

Garantia: registra o webhook Thoth24 se ainda não estiver (chama `registerThothWebhook` na primeira execução do tenant — já é idempotente após o fix anterior).

### Webhook `thoth-asaas-webhook` (já existe)
Sem alteração funcional necessária. Apenas confirmar que, ao receber `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, ele:
- Encontra `tenant_subscriptions` pelo `asaas_subscription_id`.
- Atualiza `status='active'`, `current_period_start/end` para o ciclo de 30 dias.
- Em `PAYMENT_OVERDUE` → `past_due`. Em `SUBSCRIPTION_DELETED` → `canceled`.

### Frontend
- **`src/components/checkout/PlanCheckoutModal.tsx`** (novo): wizard de 3 passos (plano → dados → método → confirmação) usando `Dialog`, `RadioGroup`, `Input` com máscara CPF/CNPJ.
- **`src/hooks/usePlans.ts`** (novo): `useQuery` para `subscription_plans where is_active=true`.
- **`src/hooks/useCheckout.ts`** (novo): `useMutation` que chama `supabase.functions.invoke('subscription-checkout', { body })` e retorna `invoice_url`.
- **`src/components/landing/Pricing.tsx`**: trocar `<Link to="/auth">` por `<Link to={`/auth?plan=${plan.id}`}>` e carregar planos dinamicamente do banco (substitui o array hardcoded). Mantém visual atual.
- **`src/pages/Auth.tsx`**: ao logar/cadastrar com `?plan=` no querystring, redireciona para `/dashboard/settings?checkout=<plan_id>`.
- **`src/pages/DashboardSettings.tsx`**: o botão **Fazer Upgrade** (linha 580) abre `PlanCheckoutModal`. Lê `?checkout=` para abrir automaticamente.
- Tela final do modal: "Pagamento gerado" com `invoiceUrl` (botão "Abrir fatura Asaas" em nova aba) + "Atualizar status" que refaz query da `tenant_subscriptions`.

### Banco
Adicionar colunas se faltarem em `profiles`: `cpf_cnpj text` (já existe `phone`). Migração simples com GRANTs.

## Estrutura visual do modal

```text
┌─ Contratar plano ──────────────────────────┐
│ ① Plano   ② Dados   ③ Pagamento   ④ OK     │
├────────────────────────────────────────────┤
│ [Starter R$97]  [Pro R$247 ★]  [Ent R$497] │
│                                            │
│ CPF/CNPJ: [___.___.___-__]                 │
│ Telefone: [(__) _____-____]                │
│                                            │
│ Forma de pagamento:                        │
│  (•) PIX     ( ) Cartão de crédito         │
│                                            │
│           [Cancelar]   [Continuar]         │
└────────────────────────────────────────────┘
```

## Itens fora deste plano
- Tela interna de QR PIX embutida (decisão: usa `invoiceUrl` do Asaas).
- Boleto como método (decisão: só PIX e Cartão).
- Trocas de plano com proração (upgrade troca o `plan_id`; ciclo segue o próximo vencimento).
