## Criar campos Bitrix para dados do contrato Asaas

Adicionar criação automática de novos campos `UF_CRM_ASAAS_*` no Deal (e Lead) via `ensureDealAsaasFields` no edge function `bitrix-payment-iframe`, e gravá-los junto com `crm_tab_create`.

### Novos campos no Bitrix

| Código UF                              | Tipo        | Valores / formato                          |
| -------------------------------------- | ----------- | ------------------------------------------ |
| `UF_CRM_ASAAS_CONTRACT_START`          | `date`      | Data de início do contrato                 |
| `UF_CRM_ASAAS_CONTRACT_END`            | `date`      | Data de fim do contrato                    |
| `UF_CRM_ASAAS_ENTRY_INSTALLMENTS`      | `enumeration` (lista) | `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24` |
| `UF_CRM_ASAAS_RECURRING_INSTALLMENTS`  | `enumeration` (lista) | `1..24, 36, 48, 60`                       |
| `UF_CRM_ASAAS_CYCLE`                   | `enumeration` (lista) | `WEEKLY` (Semanal), `BIWEEKLY` (Quinzenal), `MONTHLY` (Mensal) |

### Mudanças técnicas

Tudo em `supabase/functions/bitrix-payment-iframe/index.ts`:

1. **`ensureDealAsaasFields`** — adicionar os 5 campos acima às definições criadas via `crm.deal.userfield.add` e `crm.lead.userfield.add`. Para os campos `enumeration`, enviar `LIST` com `VALUE` e `XML_ID` (usado para leitura/gravação consistente).

2. **`crm_tab_load`** — ao montar o estado inicial, ler do Deal/Lead os valores atuais desses 5 campos e devolver ao front para pré-preencher: data de início, data de fim, nº parcelas da entrada, nº parcelas recorrentes e ciclo.

3. **`generateCrmPaymentTabPage()`** — bindar os inputs existentes (Data de início, Data de fim, Nº parcelas entrada, Frequência) aos valores recebidos do load. Adicionar opção "Quinzenal" no select de frequência se ainda não existir. Nº parcelas da entrada e nº parcelas recorrentes passam a ser `<select>` com as opções da tabela acima (em vez de input numérico livre).

4. **`crm_tab_create`** — após criar cobranças no Asaas, no `crm.deal.update` / `crm.lead.update` final, gravar também:
   - `UF_CRM_ASAAS_CONTRACT_START` = `startDate`
   - `UF_CRM_ASAAS_CONTRACT_END` = `endDate` (quando recorrente; vazio caso contrário)
   - `UF_CRM_ASAAS_ENTRY_INSTALLMENTS` = ID do item da lista correspondente ao N escolhido
   - `UF_CRM_ASAAS_RECURRING_INSTALLMENTS` = ID do item da lista correspondente ao N
   - `UF_CRM_ASAAS_CYCLE` = ID do item da lista (`WEEKLY`/`BIWEEKLY`/`MONTHLY`)

   Para resolver "valor → ID do item da lista", reusar a leitura de `crm.deal.userfield.get` por `FIELD_NAME` e cachear o mapa `XML_ID → ID` por requisição.

### Ação necessária do usuário após implementar

Clicar em **"Reparar Integração Bitrix"** no dashboard uma vez para que `ensureDealAsaasFields` rode e crie os 5 novos campos no Bitrix.

### Validação

1. Reparar integração → conferir no Bitrix (Deal → Configurações → Campos personalizados) os 5 campos criados.
2. Abrir aba "Pagamentos Asaas" em um Deal limpo: campos vazios.
3. Preencher início 21/06/2026, fim 21/12/2026, ciclo Semanal, entrada parcelada 3x, recorrente 12x → criar.
4. Recarregar a aba: os 5 campos devem voltar preenchidos com os mesmos valores.
5. Conferir na ficha do Deal (fora da aba) que os 5 campos estão visíveis e preenchidos.

### Fora de escopo

- Migrar dados de Deals antigos para os novos campos.
- Tornar os campos obrigatórios na ficha do Deal.
- Sincronizar mudanças feitas diretamente nos campos do Deal de volta para o Asaas.
