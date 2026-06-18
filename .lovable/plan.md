## Objetivo

Estender o conector para que **todos os robôs Asaas** (cobrança avulsa, assinatura, NFSe) usem o payload correto da API do Asaas e que o conector **crie e preencha automaticamente** todos os campos personalizados (`UF_CRM_*`) no Deal do Bitrix — sem o usuário precisar criar nada.

## 1. Robôs — alinhar campos ao payload Asaas

`supabase/functions/bitrix-install/index.ts` e `supabase/functions/bitrix-payment-iframe/index.ts` (definições espelhadas):

### `asaas_create_charge` (cobrança avulsa — `POST /payments`)
Adicionar campos opcionais:
- `description` — string, "Descrição da Cobrança"
- `external_reference` — string, "Referência Externa" (default: ID do Deal)
- `installment_count` — int, "Nº de Parcelas (cartão)" (default vazio)
- `interest_percent` — double, "Juros ao mês (%)" (default 0)
- `fine_percent` — double, "Multa por atraso (%)" (default 0)
- `discount_value` — double, "Desconto (R$)" (default 0)
- `discount_due_days` — int, "Validade do desconto (dias antes do venc.)" (default 0)
Renomear label `amount` → "Valor da Cobrança (R$)".

### `asaas_create_subscription` (`POST /subscriptions`)
- Adicionar `description` (string, "Descrição da Assinatura").
- Adicionar `end_date` (string ISO, "Data Final — opcional").
- Adicionar `max_payments` (int, "Máx. cobranças — opcional").
- Renomear `amount` → "Valor da Assinatura (R$)".

### `asaas_create_invoice` (NFSe)
Já cobre; sem mudança nesta fase.

## 2. Handler — enviar payload Asaas correto

`supabase/functions/bitrix-robot-handler/index.ts`:

### `asaas_create_charge` — `POST /payments` com:
```text
customer, billingType, value, dueDate,
description, externalReference,
installmentCount (se cartão e >1),
discount: { value, dueDateLimitDays } (se discount_value > 0),
fine: { value: fine_percent } (se > 0),
interest: { value: interest_percent } (se > 0)
```

### `asaas_create_subscription` — `POST /subscriptions` com:
```text
customer, billingType, value, cycle, nextDueDate,
description, endDate, maxPayments, externalReference
```

Persistir `description` em `transactions.description` e `subscriptions.description`.

## 3. Auto-criar campos UF_CRM no Deal

Nova função `ensureDealAsaasFields(clientEndpoint, accessToken)` em `bitrix-payment-iframe/index.ts`, executada uma vez (flag nova `deal_fields_registered` em `bitrix_installations`), idempotente (ignora `ERROR_USERFIELD_ALREADY_EXISTS`).

Cria via `crm.deal.userfield.add`:

**Cobrança / pagamento avulso**
| FIELD_NAME                       | USER_TYPE_ID | LABEL                        |
| -------------------------------- | ------------ | ---------------------------- |
| `UF_CRM_ASAAS_CHARGE_ID`         | string       | ID Cobrança Asaas            |
| `UF_CRM_ASAAS_CHARGE_URL`        | string       | Link de Pagamento            |
| `UF_CRM_ASAAS_CHARGE_STATUS`     | string       | Status Cobrança              |
| `UF_CRM_ASAAS_CHARGE_VALUE`      | double       | Valor da Cobrança            |
| `UF_CRM_ASAAS_BILLING_TYPE`      | string       | Forma de Pagamento           |
| `UF_CRM_ASAAS_DUE_DATE`          | date         | Data de Vencimento           |
| `UF_CRM_ASAAS_PAID_AT`           | date         | Data do Pagamento            |
| `UF_CRM_ASAAS_PIX_CODE`          | string       | PIX Copia-Cola               |
| `UF_CRM_ASAAS_BOLETO_URL`        | string       | URL do Boleto                |
| `UF_CRM_ASAAS_INVOICE_URL`       | string       | Fatura Asaas                 |

**Assinatura**
| FIELD_NAME                          | USER_TYPE_ID | LABEL                  |
| ----------------------------------- | ------------ | ---------------------- |
| `UF_CRM_ASAAS_SUBSCRIPTION_ID`      | string       | ID Assinatura Asaas    |
| `UF_CRM_ASAAS_SUBSCRIPTION_URL`     | string       | URL Assinatura         |
| `UF_CRM_ASAAS_SUBSCRIPTION_STATUS`  | string       | Status Assinatura      |
| `UF_CRM_ASAAS_SUBSCRIPTION_VALUE`   | double       | Valor Assinatura       |
| `UF_CRM_ASAAS_NEXT_DUE`             | date         | Próximo Vencimento     |
| `UF_CRM_ASAAS_CYCLE`                | string       | Ciclo                  |

**NFSe**
| FIELD_NAME                       | USER_TYPE_ID | LABEL                      |
| -------------------------------- | ------------ | -------------------------- |
| `UF_CRM_ASAAS_INVOICE_ID`        | string       | ID NFSe                    |
| `UF_CRM_ASAAS_INVOICE_NUMBER`    | string       | Número da NFSe             |
| `UF_CRM_ASAAS_INVOICE_PDF`       | string       | PDF da NFSe                |
| `UF_CRM_ASAAS_INVOICE_STATUS`    | string       | Status NFSe                |

Migração:
```sql
ALTER TABLE public.bitrix_installations
  ADD COLUMN IF NOT EXISTS deal_fields_registered boolean NOT NULL DEFAULT false;
```

`bitrix-install` e o Repair Tool resetam essa flag (junto com `pay_systems_registered` / `robots_registered`).

## 4. Preencher os campos no Deal após cada robô

No handler, quando `targetEntityType === 'deal'` e `targetEntityId` existir, chamar `crm.deal.update` (best-effort, erro só loga):

- **`asaas_create_charge`** → `UF_CRM_ASAAS_CHARGE_ID`, `_URL`, `_STATUS`, `_VALUE`, `_BILLING_TYPE`, `_DUE_DATE`, `_PIX_CODE`, `_BOLETO_URL`, `_INVOICE_URL`.
- **`asaas_check_payment`** → atualiza `_STATUS` e `_PAID_AT`.
- **`asaas_create_subscription`** → todos os `UF_CRM_ASAAS_SUBSCRIPTION_*` + `_NEXT_DUE` + `_CYCLE` + `_BILLING_TYPE` + `_VALUE`.
- **`asaas_cancel_subscription`** → atualiza `_SUBSCRIPTION_STATUS = canceled`.
- **`asaas_create_invoice`** → `UF_CRM_ASAAS_INVOICE_ID`, `_NUMBER`, `_PDF`, `_STATUS`.

Para Lead/Contact: por enquanto continua só timeline + activity, sem criar UF (escopo confirmado: só Deal).

## 5. Webhook sincroniza status

`supabase/functions/asaas-webhook/index.ts`: nos eventos `PAYMENT_RECEIVED/CONFIRMED/OVERDUE/REFUNDED` e `SUBSCRIPTION_*`, se a `transaction` tiver `bitrix_entity_type='deal'` + `bitrix_entity_id`, chamar `crm.deal.update` atualizando os campos de status correspondentes — usando o `access_token` da `bitrix_installations` (refresh se necessário, reutilizando lógica existente).

## Resultado

- Cada robô envia ao Asaas exatamente os campos que a API espera, com descrição, juros, multa, desconto, parcelas, etc. configuráveis no designer.
- No primeiro uso (ou após Repair), todos os ~20 campos `UF_CRM_ASAAS_*` aparecem no Deal automaticamente.
- Após cada execução de robô e a cada evento do webhook, o Deal alvo fica com os dados da cobrança/assinatura/NFSe preenchidos sem trabalho manual.

## Não incluído

- UF_CRM para Lead/Contact/Company (só Deal).
- UI no dashboard para customizar quais campos são criados.
