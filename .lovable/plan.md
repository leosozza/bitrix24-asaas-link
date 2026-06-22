## Objetivo

1. Transformar a página **Faturas** em uma visualização por abas:
   - **A Receber** — cobranças pendentes ainda dentro do prazo
   - **Em Atraso** — cobranças pendentes com vencimento ultrapassado
   - **Recebidas** — cobranças pagas/confirmadas

2. Nas **Configurações → Asaas → Integração com Faturas do Bitrix24**, permitir escolher qual **etapa do funil de Faturas (SmartInvoice)** representa cada estado, e mover a fatura no Bitrix automaticamente conforme o status muda no Asaas.

## Mudanças

### Banco de dados (migração)
Adicionar em `asaas_configurations`:
- `bitrix_invoice_pending_stage_id text` — etapa "A Receber"
- `bitrix_invoice_overdue_stage_id text` — etapa "Em Atraso"
- (já existe `bitrix_invoice_paid_stage_id` — etapa "Recebidas")

### Página Faturas (`src/pages/DashboardInvoices.tsx`)
Reescrever para mostrar abas (componente `Tabs`) usando dados da tabela `transactions` que possuem `bitrix_invoice_id` (e/ou todas as cobranças Asaas, a confirmar):
- **A Receber**: `status = 'pending'` AND `due_date >= hoje`
- **Em Atraso**: `status = 'pending'` AND `due_date < hoje`
- **Recebidas**: `status = 'confirmed'`

Cada aba mostra tabela com cliente, valor, vencimento, método, link da cobrança e link da fatura no Bitrix (se houver). Manter o botão atual de "Nova Nota Fiscal" como ação secundária, ou mover NFSe para outra página — **a confirmar com o usuário**.

### Configurações Asaas (`src/pages/DashboardSettings.tsx`)
Na seção "Integração com Faturas do Bitrix24", substituir o único select por **três selects**, um para cada estado:
- Etapa "A Receber" → `bitrix_invoice_pending_stage_id`
- Etapa "Em Atraso" → `bitrix_invoice_overdue_stage_id`
- Etapa "Recebidas/Pago" → `bitrix_invoice_paid_stage_id`

Os três usam a mesma lista carregada via `bitrix-invoice-stages` (auto-sugerir por `semantics`: `P`=processo→A Receber, `F`=falha→Em Atraso, `S`=sucesso→Recebidas).

### Edge functions
- **`bitrix-payment-process`**: ao criar a SmartInvoice, já definir o `stageId` para `bitrix_invoice_pending_stage_id` (se configurado).
- **`asaas-webhook`**:
  - `PAYMENT_OVERDUE` → mover invoice para `bitrix_invoice_overdue_stage_id`.
  - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → mover para `bitrix_invoice_paid_stage_id` (já implementado).

## Pergunta antes de implementar

A página **Faturas** hoje gerencia **NFSe (notas fiscais de serviço)**. O que você quer:

- **(A)** Substituir a página atual: as abas A Receber / Em Atraso / Recebidas listam as **cobranças Asaas/Faturas do Bitrix**, e a parte de NFSe vai para outra página (ex.: "Notas Fiscais").
- **(B)** Manter NFSe nesta página e **adicionar uma 4ª aba "Notas Fiscais"**, com as 3 primeiras sendo as cobranças.
- **(C)** Outro arranjo (descreva).

Confirmando essa escolha, eu sigo com a implementação completa acima.
