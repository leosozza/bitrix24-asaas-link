## Objetivo

Adicionar, na configuração da integração Asaas, uma opção (toggle) para sincronizar **Faturas do Bitrix24 (SmartInvoice / entityTypeId = 31)** com as cobranças do Asaas.

Quando ativado:
- Cada nova cobrança Asaas (criada via robô, contrato ou Pay System) também cria uma **Fatura no Bitrix24** vinculada ao Deal/Contato/Cliente.
- Quando o webhook Asaas confirma o pagamento (`PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`), a Fatura no Bitrix é atualizada para o status **"Convertido / Pago"** (`stageId` final do SmartInvoice).

Quando desativado: nada muda no fluxo atual.

## Mudanças

### 1. Banco (migration)
Adicionar em `asaas_configurations`:
- `sync_bitrix_invoices boolean default false`
- `bitrix_invoice_paid_stage_id text` (opcional — stage usada como "Pago/Convertido"; default detectado automaticamente)

Adicionar em `transactions`:
- `bitrix_invoice_id bigint` (id da fatura SmartInvoice criada no Bitrix)

### 2. UI — `src/pages/DashboardIntegrations.tsx` (e/ou `DashboardSettings.tsx`)
Dentro do card de configuração Asaas, novo bloco **"Integração com Faturas do Bitrix24"**:
- Switch "Criar Fatura no Bitrix24 para cada cobrança"
- Quando ligado: select carregado via `crm.item.fields` + `crm.category.stage.list` para escolher qual stage representa "Pago/Convertido" (auto-seleciona a stage com semântica `S` (success) se houver).
- Texto explicativo: "Ao criar uma cobrança Asaas, geraremos automaticamente uma Fatura vinculada ao Deal/Contato. Quando o cliente pagar, a Fatura será marcada como Convertida."

### 3. Edge Functions

**Novo helper** `supabase/functions/_shared/bitrix-invoice.ts`:
- `createBitrixInvoice({ endpoint, token, dealId, contactId, companyId, amount, title, dueDate, asaasPaymentId })` → usa `crm.item.add` com `entityTypeId=31`, popula `parentId2` (deal), `contactId`, `companyId`, `opportunity` (valor), `title`, `accountNumber` (id Asaas).
- `markBitrixInvoicePaid({ endpoint, token, invoiceId, paidStageId })` → `crm.item.update` com `stageId`.

**Pontos de integração (criação)** — após criar cobrança no Asaas, se `sync_bitrix_invoices = true`, criar fatura e salvar `bitrix_invoice_id` em `transactions`:
- `supabase/functions/bitrix-payment-process/index.ts`
- `supabase/functions/bitrix-subscription-process/index.ts`
- `supabase/functions/_shared/asaas-contract-billing.ts` (cobranças de contratos)
- `supabase/functions/bitrix-contract-robot/index.ts` (caminho do robô)

**Ponto de integração (atualização para pago)** — `supabase/functions/asaas-webhook/index.ts`:
- Nos eventos `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`, se a `transaction` tiver `bitrix_invoice_id` e a config tiver `sync_bitrix_invoices = true`, chamar `markBitrixInvoicePaid` com `bitrix_invoice_paid_stage_id`.
- Em `PAYMENT_REFUNDED` / `PAYMENT_DELETED`: opcional — voltar a fatura para stage "Cancelado" (fora do escopo desta versão, ficará só logado).

### 4. Logs
Registrar em `integration_logs` as ações `bitrix_invoice_create` e `bitrix_invoice_mark_paid` (sucesso/erro), sem quebrar o fluxo principal se a chamada Bitrix falhar (apenas loga).

## Detalhes técnicos

- API Bitrix usada: **SmartInvoice universal** (`crm.item.add` / `crm.item.update` com `entityTypeId=31`) — substitui `crm.invoice.add` (deprecated).
- Stages da fatura são lidas via `crm.category.stage.list?entityTypeId=31` (não há `categoryId` em SmartInvoice na maioria dos portais — usar `entityTypeId=31` direto).
- Vínculo com Deal: campo `parentId2` em SmartInvoice corresponde ao Deal pai.
- O campo `opportunity` carrega o valor; `currencyId` = `BRL`.
- `accountNumber` recebe o `id` do payment Asaas para rastreabilidade.
- Idempotência: ao criar, se `transactions.bitrix_invoice_id` já existir, pular criação.

## Fora do escopo
- Sincronização reversa (Fatura criada no Bitrix → cobrança Asaas).
- Mapeamento de impostos/itens da fatura — usaremos uma linha única com o valor total.
