
# Plano único: Asaas Pay by Thoth24 — R$ 249/mês, transações ilimitadas

Simplificar a oferta do conector para um único plano ao invés de Starter/Pro/Enterprise.

## 1. Banco de dados (migration)

Migration em `supabase/migrations/`:

- Desativar todos os planos atuais (`UPDATE subscription_plans SET is_active = false`).
- Inserir (ou atualizar via upsert por nome) o plano único:
  - `name`: `Pro` (mantém compatibilidade com `handle_new_user` que procura por `lower(name) = 'pro'`)
  - `price`: `249.00`
  - `transaction_limit`: `-1` (convenção para "ilimitado"; UI já pode tratar)
  - `features`: lista enxuta (ver seção 4)
  - `is_active`: `true`
- Migrar assinaturas existentes de outros planos para o novo `plan_id` do Pro, preservando `status`, datas e uso.

## 2. Tratamento de "ilimitado" (`transaction_limit = -1`)

Atualizar leituras do limite para exibir/agir como ilimitado quando `< 0`:

- `src/pages/admin/AdminTenants.tsx` e `AdminPlans.tsx`: mostrar "Ilimitado" quando `-1`.
- `src/components/checkout/PlanCheckoutModal.tsx`: idem no card.
- Qualquer gate por limite em edge functions (checar `admin-tenant-management`, `subscription-checkout`, webhooks) — se houver bloqueio quando `transactions_used >= transaction_limit`, ignorar quando limite `< 0`.

## 3. Landing page — `src/components/landing/Pricing.tsx`

Substituir a grade de 3 planos por um único card centralizado:

- Título: "Plano único, sem surpresas"
- Preço: `R$ 249/mês`
- Destaque: "Transações ilimitadas"
- Features finais (seção 4)
- CTA: `Começar Agora` → `/auth?plan=pro`
- Manter layout responsivo (card centralizado, largura máx ~480px).

## 4. Features do plano (sugestão inicial)

- Transações ilimitadas
- PIX, Boleto e Cartão de crédito
- Assinaturas recorrentes
- Split de pagamentos
- Emissão automática de NFSe
- Automações Bizproc (5 robôs Asaas)
- Contratos digitais
- Usuários Bitrix24 ilimitados
- Suporte prioritário

(Podem ser ajustadas antes de aplicar.)

## 5. Modal de checkout — `PlanCheckoutModal.tsx`

Como só há um plano ativo:

- Pular o passo 1 (seleção de plano) quando `plans.length === 1`, indo direto para dados do cliente.
- Ajustar contador de passos ("Passo X de 2").
- Manter fallback caso o admin reative múltiplos planos no futuro.

## 6. Admin

- `AdminPlans.tsx`: continua funcional (edita o plano único). Adicionar dica: use `-1` em "Limite de transações/mês" para ilimitado.
- `AdminTenants.tsx`: coluna/label de uso mostra `41 / Ilimitado` quando `-1`.

## Detalhes técnicos

- Mantemos o `name = 'Pro'` para não quebrar `handle_new_user` (trial de 14 dias no Pro).
- Nenhuma coluna nova é adicionada; `-1` é convenção in-code para ilimitado.
- Migration é idempotente (usa upsert por `lower(name) = 'pro'`).
- Sem mudanças em RLS, grants ou edge functions além dos gates de limite.

## Arquivos a alterar

- `supabase/migrations/<novo>.sql` (novo)
- `src/components/landing/Pricing.tsx`
- `src/components/checkout/PlanCheckoutModal.tsx`
- `src/pages/admin/AdminTenants.tsx`
- `src/pages/admin/AdminPlans.tsx`
- Edge functions com gate de limite (a confirmar durante a implementação)
