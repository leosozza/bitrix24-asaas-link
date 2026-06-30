
## Objetivo

1. Garantir que o telefone vindo do Bitrix entre no campo **Celular (`mobilePhone`)** do Asaas, e não em **Fone (`phone`)**.
2. Adicionar uma opção no conector para o tenant escolher se o Asaas envia (ou não) as cobranças por **e-mail / WhatsApp / SMS** ao cliente final.

---

## 1. Phone → mobilePhone

A maior parte do código já usa `mobilePhone`, mas há um ponto que ainda usa `phone`:

- `supabase/functions/bitrix-crm-detail-tab/index.ts` (função `findOrCreateAsaasCustomer`, ~linha 114):  
  trocar `phone: (phone || '').replace(/\D/g, '')` por `mobilePhone: (phone || '').replace(/\D/g, '')`.

Também verificar/uniformizar:
- `bitrix-payment-iframe`: já usa `mobilePhone` ✅
- `asaas-contract-billing` / `contract-public`: payload já aceita `mobilePhone` ✅
- `subscription-checkout` e `admin-tenant-management`: já usam `mobilePhone` ✅

Nenhuma mudança de schema; só ajuste no edge function acima.

---

## 2. Toggle "Notificações do Asaas"

### Banco de dados

Migração em `asaas_configurations`:
- Adicionar coluna `customer_notifications_enabled boolean not null default true`.

### Backend (edge functions)

Em todos os pontos onde criamos cliente no Asaas, ler `customer_notifications_enabled` da `asaas_configurations` do tenant e enviar:

```
notificationDisabled: !customer_notifications_enabled
```

no payload de criação/atualização do customer (Asaas aplica em todas as cobranças desse cliente — email, WhatsApp e SMS).

Pontos a atualizar:
- `supabase/functions/bitrix-payment-iframe/index.ts` → `findOrCreateAsaasCustomerSimple`
- `supabase/functions/bitrix-payment-process/index.ts` → `findOrCreateCustomer`
- `supabase/functions/bitrix-crm-detail-tab/index.ts` → `findOrCreateAsaasCustomer`
- `supabase/functions/contract-public/index.ts` → propagar no `customerPayload` antes de chamar `ensureAsaasCustomer`
- `supabase/functions/subscription-checkout/index.ts` e `admin-tenant-management/index.ts` → idem

Como envolve várias funções, criar um helper compartilhado em `supabase/functions/_shared/asaas-contract-billing.ts` (ou novo `_shared/asaas-config.ts`) para buscar a flag uma única vez por tenant.

### Frontend

Em `src/pages/DashboardSettings.tsx`, na seção "Configuração Asaas", adicionar um `<Switch>`:

- **Label:** "Enviar cobranças por e-mail/WhatsApp via Asaas"
- **Descrição:** "Quando ativo, o Asaas envia automaticamente notificações de cobrança (e-mail, WhatsApp e SMS) ao cliente final. Desative se você prefere enviar pelo seu próprio fluxo no Bitrix24."
- Persiste em `asaas_configurations.customer_notifications_enabled`.
- Default: ligado (mantém comportamento atual).

⚠️ Importante: a flag só se aplica a **novos** clientes criados a partir daí. Clientes já existentes no Asaas mantêm a configuração anterior — adicionar nota explicativa abaixo do switch. (Opcionalmente, no `ensureAsaasCustomer` já existe um PATCH best-effort em clientes encontrados; podemos atualizar `notificationDisabled` lá também — incluído no escopo.)

---

## Validação

- Criar cobrança via iframe checkout com um contato Bitrix que tenha telefone → conferir no painel Asaas que o número aparece em **Celular**.
- Desativar o switch nas configurações, criar nova cobrança → cliente recém-criado no Asaas deve aparecer com "Notificações desativadas".
- Reativar → próximo cliente novo volta a receber notificações.

## Arquivos tocados

- migration nova (coluna `customer_notifications_enabled`)
- `supabase/functions/_shared/asaas-contract-billing.ts` (helper)
- `supabase/functions/bitrix-payment-iframe/index.ts`
- `supabase/functions/bitrix-payment-process/index.ts`
- `supabase/functions/bitrix-crm-detail-tab/index.ts`
- `supabase/functions/contract-public/index.ts`
- `supabase/functions/subscription-checkout/index.ts`
- `supabase/functions/admin-tenant-management/index.ts`
- `src/pages/DashboardSettings.tsx`
