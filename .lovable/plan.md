## Objetivo

Integrar o fluxo de **contratos** com **cobrança Asaas**, fechando o ciclo: mapear campos de cobrança no template → gerar cobrança/assinatura ao assinar → atualizar contrato e Bitrix via webhook.

---

## 1. Mapeamento de campos de cobrança Asaas no editor de template

Hoje o `BitrixFieldMapper` mapeia placeholders genéricos do contrato (`{{cliente_nome}}`, etc.). Agora adicionamos um segundo bloco no editor: **"Campos de cobrança Asaas"**, com chaves fixas exigidas pela API do Asaas:

| Campo Asaas      | Obrigatório | Origem Bitrix sugerida              |
| ---------------- | ----------- | ----------------------------------- |
| `name`           | sim         | Contact NAME+LAST_NAME / Company TITLE |
| `cpfCnpj`        | sim         | Contact UF_CRM_CPF / Company UF_CRM_CNPJ |
| `email`          | recomendado | Contact EMAIL[0]                    |
| `mobilePhone`    | recomendado | Contact PHONE[0]                    |
| `postalCode`     | opcional    | Company ADDRESS_POSTAL_CODE         |
| `address`        | opcional    | Company ADDRESS                     |
| `addressNumber`  | opcional    | Company ADDRESS_2                   |
| `province`       | opcional    | Company ADDRESS_CITY                |

Salvo no template em uma nova coluna JSONB **`asaas_billing_map`** (estrutura igual a `bitrix_field_map`: `{ "cpfCnpj": { entity: "contact", field: "UF_CRM_CPF" }, ... }`).

UI: novo componente `AsaasBillingFieldMapper.tsx` (reutiliza `useBitrixEntityFields`) renderizado como 4ª coluna no editor de templates, com indicador "X de 8 campos mapeados" e marcação visual para os obrigatórios.

A função `bitrix-contract-fields` (action `resolve`) passa a devolver também `asaas_billing` (objeto pronto para virar customer no Asaas).

---

## 2. Seção de pagamento no `ContractWizard` (integração Asaas)

Novo **Passo 3 – Pagamento Asaas** entre "Dados" e "Revisão":

- **Tipo de cobrança**: `unica` | `parcelada` | `assinatura_mensal` (recorrente)
- **Forma de pagamento**: `BOLETO` | `PIX` | `CREDIT_CARD` | `UNDEFINED` (cliente escolhe)
- **Valor**: pré-preenchido com `total_value` do contrato
- Se **parcelada**: nº de parcelas + vencimento da 1ª (reaproveita `PaymentScheduleTable`)
- Se **assinatura_mensal**: ciclo fixo `MONTHLY`, próxima cobrança, fim opcional (`endDate` ou `maxPayments`)
- **Dados do cliente Asaas**: pré-preenchidos por `asaas_billing` (vindo do Bitrix resolve) — campos editáveis com badge "vindo do Bitrix"
- Checkbox **"Criar cobrança automaticamente ao assinar"** (default ligado)

Persistência: novas colunas em `contracts`:
- `asaas_billing_type text` (BOLETO/PIX/...)
- `asaas_charge_mode text` (unica/parcelada/assinatura)
- `asaas_subscription_cycle text` (MONTHLY/...)
- `asaas_customer_payload jsonb`
- `auto_create_charge boolean default true`

(o campo `asaas_subscription_id` já existe)

### Geração da cobrança
Quando o contrato é assinado (em `contract-public`, hoje só marca `signed_at`), passa a:
1. Garantir/atualizar `customer` Asaas via `POST /v3/customers` (idempotente por `cpfCnpj`)
2. Conforme `asaas_charge_mode`:
   - `unica` → `POST /v3/payments`
   - `parcelada` → `POST /v3/payments` com `installmentCount`/`installmentValue`
   - `assinatura` → `POST /v3/subscriptions` (cycle MONTHLY) — grava `asaas_subscription_id`
3. Atualiza `contracts` com IDs e `invoiceUrl/bankSlipUrl`
4. Posta timeline no Bitrix com o link de pagamento (reutilizando padrão de `asaas-webhook`)

---

## 3. Webhook Asaas → status do contrato + Bitrix

Novo Edge Function público **`asaas-contract-webhook`** (`verify_jwt = false`, validado por `asaas-access-token`):

- Eventos tratados:
  - `PAYMENT_CREATED` → contract.status = `sent` (se ainda `draft`)
  - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → `paid`
  - `PAYMENT_OVERDUE` → `overdue`
  - `PAYMENT_REFUNDED` / `PAYMENT_DELETED` → `canceled`
  - `SUBSCRIPTION_DELETED` → `canceled`
- Lookup: `payment.externalReference` = `contract:<id>` (definido na criação) ou via `asaas_subscription_id`.
- Atualiza `contracts.status` + nova coluna `payment_status text` (separa status contratual de status de pagamento — `pending`/`paid`/`overdue`/`refunded`).
- Reflexo no Bitrix:
  - Atualiza timeline da entidade vinculada (`bitrix_entity_type`/`bitrix_entity_id`) com badge de status (mesmo padrão de `bitrix-timeline-tracking`).
  - Se entidade for **Deal** e evento `PAYMENT_RECEIVED` → marca o deal como `WON` (configurável).
- Idempotência via `integration_logs` (mesmo padrão do `thoth-asaas-webhook`).

Registro do webhook: o tenant configura a URL **uma vez** no painel da conta Asaas dele (mostramos no `DashboardContracts` com botão copiar). Não auto-registramos (a conta Asaas é do tenant e já é usada pelo conector principal — este webhook é endpoint separado).

---

## Arquivos

**Migrations**
- `<ts>_contract_asaas_billing.sql`:
  - `contract_templates`: + `asaas_billing_map jsonb DEFAULT '{}'`
  - `contracts`: + `asaas_billing_type`, `asaas_charge_mode`, `asaas_subscription_cycle`, `asaas_customer_payload jsonb`, `asaas_customer_id text`, `asaas_payment_id text`, `auto_create_charge bool default true`, `payment_status text default 'pending'`

**Edge functions**
- `supabase/functions/asaas-contract-webhook/index.ts` (novo, public)
- `supabase/functions/contract-public/index.ts` (editar: ao assinar, chamar criação de cobrança quando `auto_create_charge`)
- `supabase/functions/bitrix-contract-fields/index.ts` (editar: action `resolve` devolve `asaas_billing` também)
- `supabase/functions/_shared/asaas-contract-billing.ts` (novo: helpers `ensureAsaasCustomer`, `createCharge`, `createSubscription`)

**Frontend**
- `src/components/contracts/AsaasBillingFieldMapper.tsx` (novo)
- `src/components/contracts/ContractWizard.tsx` (editar: novo passo Pagamento)
- `src/components/contracts/AsaasPaymentStep.tsx` (novo)
- `src/pages/DashboardContractTemplates.tsx` (editar: incluir `AsaasBillingFieldMapper`)
- `src/pages/DashboardContracts.tsx` (editar: badge `payment_status` + bloco "URL do webhook Asaas")
- `src/hooks/useContracts.ts` (editar: tipos + campos novos)

**Config**
- `supabase/config.toml`: `[functions.asaas-contract-webhook] verify_jwt = false`

---

## Fora de escopo

- Tokenização de cartão de crédito direta no wizard (cliente paga via link `invoiceUrl` do Asaas).
- Split de pagamento por contrato (já existe módulo `transaction_splits` separado; pode ser adicionado depois).
- Renegociação/edição de cobrança após criada — apenas cancelamento via mudança de status do contrato.
