

## Plano: Placement CRM Detail Tab + Badges de Cobranca — IMPLEMENTADO ✅

Todas as etapas foram implementadas e deployadas.

### Resumo do que foi feito:

1. **Migração de banco** ✅
   - `placements_registered` (boolean) em `bitrix_installations`
   - `badges_registered` (boolean) em `bitrix_installations`
   - `bitrix_activity_id` (text) em `transactions`
   - `lead` adicionado ao enum `bitrix_entity_type`

2. **Nova Edge Function `bitrix-crm-detail-tab`** ✅
   - Renderiza painel financeiro dentro de Lead/Deal com métricas (total cobrado, recebido, em aberto, qtd)
   - Lista de cobranças com status, valor, método, vencimento
   - Formulário inline para gerar nova cobrança via Asaas
   - Cria configurable activity com badge ao gerar cobrança

3. **Lazy Registration de Placements e Badges** ✅ (`bitrix-payment-iframe`)
   - `placement.bind` para `CRM_LEAD_DETAIL_TAB` e `CRM_DEAL_DETAIL_TAB`
   - `crm.activity.badge.add` para 5 badges: created, viewed, overdue, paid, cancelled
   - Flags `placements_registered` e `badges_registered` controlam o registro

4. **Activities + Badges no Webhook** ✅ (`asaas-webhook`)
   - `updateActivityBadge()` atualiza `crm.activity.configurable.update` com novo `badgeCode`
   - PAYMENT_CONFIRMED/RECEIVED → `asaas_charge_paid` (completed: true)
   - PAYMENT_OVERDUE → `asaas_charge_overdue`
   - PAYMENT_REFUNDED/CANCELLED → `asaas_charge_cancelled` (completed: true)

5. **Activity ao criar cobrança via Robot** ✅ (`bitrix-robot-handler`)
   - `crm.activity.configurable.add` após criar cobrança no Asaas
   - Salva `bitrix_activity_id` na transação

6. **Activity ao processar pagamento** ✅ (`bitrix-payment-process`)
   - `crm.activity.configurable.add` após processar pagamento no iframe
   - Salva `bitrix_activity_id` na transação

7. **Config** ✅
   - `[functions.bitrix-crm-detail-tab]` com `verify_jwt = false` no `supabase/config.toml`
