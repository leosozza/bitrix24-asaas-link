## Objetivo

Transformar a aba **Pagamentos Asaas** (hoje vazia) numa tela operacional dentro do Deal/Lead do Bitrix24, replicando o fluxo do BomControle:

1. **Criar cobranças** sem sair do CRM: À vista, Parcelado, Recorrente — com suporte a **Entrada + Saldo Parcelado** e cálculo automático de quantidade de parcelas por período.
2. **Listar todas as cobranças** do cliente Asaas (vinculado pelo CPF/email do Contact do Deal).
3. **Preencher automaticamente** os campos `UF_CRM_ASAAS_*` do Deal.
4. **Pré-carregar** os campos do Deal quando já houver cobrança vinculada.

## UI da aba

```text
┌─ Pagamento do Contrato ─────────────────────────────────────────────┐
│ Tipo Pagamento │ Período  │ Forma Pgto │ Início    │ Fim (opc.)    │
│ [Parcelado ▾]  │ [Sem. ▾] │ [Boleto ▾] │ [25/06]   │ [25/09]       │
│                                                                     │
│ Valor Total: [R$ 2.000]   Entrada: [R$ 500]  → Saldo: R$ 1.500      │
│ Nº Parcelas: [auto 13]  (calculado: 13 semanas entre 25/06 e 25/09) │
│                                                                     │
│ Descrição: [_________________________________________________]      │
│ [+ Gerar Cobranças]                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ Cobranças do cliente (Asaas)                                        │
│ # │ Tipo │ Vencimento │ Valor │ Status │ Link │ Ações                │
│ 1   PIX    25/06/26    500,00  PAGO     [↗]   [✕]                   │
│ 2   Boleto 02/07/26    115,38  PENDENTE [↗]   [✕]                   │
│ ... (13 parcelas semanais nas próximas quartas)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Comportamento dos campos

- **Tipo Pagamento**: À vista / Parcelado / Recorrente (Assinatura)
- **Período** (default **Semanal**): Semanal, Quinzenal, Mensal, Trimestral, Semestral, Anual
- **Forma Pgto**: Boleto, PIX, Cartão, Não definido (cliente escolhe)
- **Início** (1ª cobrança): a data escolhida vira o "dia fixo" da recorrência (ex.: 25/06 = quarta → toda quarta seguinte)
- **Fim** (opcional): se preenchido com Parcelado/Recorrente, calcula `Nº Parcelas` automaticamente pelo período
- **Entrada** (opcional): cria 1 cobrança separada no valor da entrada com vencimento na data de Início; o restante (`Total - Entrada`) vira o "Saldo a Parcelar" dividido pelo `Nº Parcelas`
- **Nº Parcelas**: editável manualmente OU calculado quando `Fim` estiver preenchido

## Regras de cálculo

```text
saldo = valorTotal - entrada
valorParcela = round(saldo / numParcelas, 2)
ultimaParcela = saldo - (valorParcela * (numParcelas - 1))   // ajuste de centavos

// Quando "Fim" preenchido + período Semanal:
numParcelas = floor((dataFim - dataInicio) / 7 dias) + 1
// Demais períodos: análogo (14, 30, 90, 180, 365 dias)

// Vencimentos:
// Entrada → dataInicio
// Parcela 1 → dataInicio + 1 período (ou dataInicio se sem entrada)
// Parcela N → dataInicio + N * período (mantém o mesmo dia da semana)
```

## Comportamento por Tipo de Pagamento

| Tipo | Chamadas Asaas | Saída |
|---|---|---|
| À vista | `POST /payments` × 1 | 1 cobrança no valor total |
| Parcelado | `POST /payments` em loop (datas calculadas) + opcional 1 cobrança de entrada | N (+1 se entrada) cobranças individuais |
| Recorrente | opcional `POST /payments` (entrada) + `POST /subscriptions` com `cycle` do período e `nextDueDate` = data Início + 1 período | 1 assinatura (Asaas gera as cobranças automaticamente) |

> **Decisão confirmada:** Parcelado gera N pagamentos individuais com `dueDate` calculado — não usa `/installments` do Asaas (que só suporta mensal).
> **Default:** Período = Semanal.

## Carregamento da listagem

Ao abrir a aba:

1. Pega `entityType` (`deal`/`lead`) e `entityId` via `PLACEMENT_OPTIONS`.
2. Lê o Deal/Lead via `crm.deal.get` → obtém Contact vinculado → `crm.contact.get` → CPF/CNPJ + email.
3. Resolve `customerId` no Asaas via `GET /customers?cpfCnpj=...` (ou cria se não existir).
4. Lista `GET /payments?customer=<id>&limit=50` + `GET /subscriptions?customer=<id>`.
5. Renderiza tabela ordenada por vencimento.
6. Pré-preenche o formulário com valor do campo `OPPORTUNITY` do Deal.

## Preenchimento automático no Bitrix após criar

`crm.deal.update` grava:

- **À vista:** `UF_CRM_ASAAS_CHARGE_ID`, `_CHARGE_URL`, `_CHARGE_STATUS`, `_CHARGE_VALUE`, `_BILLING_TYPE`, `_DUE_DATE`, `_BOLETO_URL`/`_PIX_CODE`
- **Parcelado:** grava a **primeira parcela** nos campos `_CHARGE_*` + JSON completo com todas as parcelas em `UF_CRM_ASAAS_INSTALLMENTS_JSON` (campo novo)
- **Recorrente:** `UF_CRM_ASAAS_SUBSCRIPTION_ID`, `_SUBSCRIPTION_URL`, `_SUBSCRIPTION_STATUS`, `_SUBSCRIPTION_VALUE`, `_NEXT_DUE`, `_CYCLE` (+ campos da entrada nos `_CHARGE_*` se houver)

## Mudanças técnicas

### 1. `supabase/functions/bitrix-payment-iframe/index.ts`
- Detectar query/POST `PLACEMENT=CRM_DEAL_DETAIL_TAB` (já chega) e renderizar `renderCrmPaymentTab(entityType, entityId, memberId)`.
- HTML+JS vanilla (mesmo padrão do arquivo) com Tailwind via CDN já carregado.
- Novos handlers (chamadas JSON do front da aba para a própria edge):
  - `crm_tab_load` → `{ customer, charges[], subscriptions[], dealFields, dealValue }`
  - `crm_tab_create` → recebe payload completo `{ type, billingType, period, startDate, endDate, total, entryValue, installments, description }` e executa a lógica acima
  - `crm_tab_cancel_charge` → `DELETE /payments/{id}`
  - `crm_tab_cancel_subscription` → `DELETE /subscriptions/{id}`

### 2. Helpers novos no edge
- `addPeriod(date, period)` — soma 7/14/30/90/180/365 dias
- `calcInstallmentsBetween(start, end, period)` — calcula N
- `splitInstallmentValues(saldo, n)` — divisão com ajuste de centavos na última parcela
- `resolveOrCreateAsaasCustomer(contact)` — reutiliza helper existente

### 3. Novo campo customizado no Deal
- `UF_CRM_ASAAS_INSTALLMENTS_JSON` (string long) — adicionado ao array de `ensureDealAsaasFields`.

### 4. Sem mudanças de schema do banco
- Cobranças criadas pela aba seguem o mesmo caminho dos robôs Bizproc → registram em `transactions`/`subscriptions` automaticamente.

## Como o usuário acessa

1. Abrir um Negócio no Bitrix24 → aba **Pagamentos Asaas**.
2. Aba carrega cobranças existentes do cliente.
3. Preenche formulário → "Gerar Cobranças" → parcelas aparecem na lista e Deal fica com os campos `UF_CRM_ASAAS_*` preenchidos.

## Validação após implementação

- Rodar **Reparar Integração** uma vez (cria o novo campo `UF_CRM_ASAAS_INSTALLMENTS_JSON`).
- Abrir um Deal com Contact que tem CPF → conferir que a tabela de cobranças carrega.
- Testar 3 cenários: À vista (R$ 500), Parcelado 4x semanal com entrada de R$ 200 (Total R$ 1.000), Recorrente semanal sem fim.

## Fora do escopo

- Edição/reagendamento de parcela individual (ícone lápis do BomControle) — segunda iteração.
- Etiquetas/observação por parcela — só descrição global.
- Recálculo automático ao mudar valor após gerar (precisaria cancelar + recriar manualmente).