## Entrada parcelada (na aba Pagamentos Asaas)

Adicionar a possibilidade de **parcelar a entrada** em N cobranças individuais, com data editável por parcela. Aplica-se a qualquer modo (À vista / Parcelado / Recorrente) sempre que houver "Entrada > 0".

### UI (dentro da seção "Entrada" já existente)

Quando o usuário preenche **Valor da entrada** (>0), aparece:

- Checkbox: **"Parcelar entrada"**
- Se marcado:
  - Campo: **Nº de parcelas da entrada** (default 1, min 1, max 24)
  - Campo: **Valor de cada parcela** (auto: `entrada / N`, último ajustado para fechar centavos) — somente leitura, mas recalculado ao vivo
  - Tabela de pré-visualização das parcelas da entrada:

```text
#  | Valor    | Vencimento (date picker)
1  | 1.000,00 | [21/06/2026]
2  | 1.000,00 | [21/07/2026]
3  | 1.000,00 | [21/08/2026]
```

  - Vencimento da parcela 1 = "Data de início" do formulário; demais = parcela 1 + N meses (mensal por padrão) — todas editáveis individualmente pelo usuário.

### Comportamento de cálculo

- `entradaTotal = valor digitado`
- `valoresEntrada = splitInstallmentValues(entradaTotal, nParcelasEntrada)` (mesma função já criada — última parcela absorve diferença de centavos)
- `saldo = valorTotal - entradaTotal` (segue alimentando o fluxo À vista / Parcelado / Recorrente como hoje)

### Criação no Asaas

Para cada linha da tabela de entrada, **um `POST /payments` individual** com:
- `value` = valor daquela parcela
- `dueDate` = data escolhida pelo usuário naquela linha
- `description` = `"<descrição base> - Entrada <i>/<N>"`
- `billingType` = método selecionado

Continuam sendo criadas DEPOIS as cobranças do saldo (parcelado, à vista única ou subscription), como já funciona hoje.

### Persistência no Deal

- Reaproveitar o campo já criado `UF_CRM_ASAAS_INSTALLMENTS_JSON`: prefixar as parcelas da entrada antes das parcelas do saldo, marcando `type: "entry"` vs `type: "balance"` em cada item:

```json
[
  {"type":"entry","n":1,"id":"pay_xxx","value":1000,"dueDate":"2026-06-21","url":"..."},
  {"type":"entry","n":2,"id":"pay_yyy","value":1000,"dueDate":"2026-07-21","url":"..."},
  ...
  {"type":"balance","n":1,"id":"pay_zzz","value":...,"dueDate":"...","url":"..."}
]
```

- Os campos resumo (`UF_CRM_ASAAS_CHARGE_*`) continuam apontando para a **primeira cobrança gerada** (entrada parcela 1), como hoje.

### Mudanças técnicas

Tudo em `supabase/functions/bitrix-payment-iframe/index.ts`:

1. `generateCrmPaymentTabPage()` — adicionar checkbox + input N + tabela dinâmica com inputs `date` por linha. JS atualiza valores ao mudar entrada/N e datas ao mudar data de início.
2. Handler `crm_tab_create` — antes do bloco atual de entrada única:
   - Se `entryInstallments && entryInstallments.length > 0`, iterar e fazer `POST /payments` para cada item usando `value` e `dueDate` recebidos do front.
   - Caso contrário, manter comportamento atual (1 cobrança de entrada).
3. Payload do front passa a enviar `entryInstallments: [{ value, dueDate }, ...]` em vez de (ou além de) `entryValue` simples. Manter retrocompatibilidade: se vier só `entryValue`, tratar como 1 parcela.
4. Montagem do `installmentsJson` final concatena entradas + saldo com o campo `type`.

### Fora de escopo

- Editar valor individual de cada parcela da entrada (só data é editável; valores são distribuídos automaticamente).
- Descrição/observação por parcela.
- Reprocessar/recriar entrada após criada (cancela e cria de novo via UI atual).

### Validação após implementar

1. Abrir aba "Pagamentos Asaas" em um Deal.
2. Total R$ 10.000, Entrada R$ 3.000, **Parcelar entrada = 3**, datas 21/06, 21/07, 21/08; saldo Parcelado 7x semanal.
3. Verificar no Asaas: 3 cobranças de R$ 1.000 nas datas escolhidas + 7 cobranças do saldo.
4. Verificar no Deal: `UF_CRM_ASAAS_INSTALLMENTS_JSON` com 10 itens (3 `entry` + 7 `balance`).
