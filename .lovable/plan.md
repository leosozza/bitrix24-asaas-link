## Objetivo

1. Marcar como **obrigatórios** no placement "Pagamentos Asaas" todos os campos que o Asaas exige para criar cobrança/assinatura.
2. Após cada tentativa de envio ao Asaas, **registrar no timeline do Deal/Lead**:
   - Sucesso → comentário com resumo (valor, nº cobranças, IDs Asaas, link).
   - Erro → comentário com a lista completa dos erros retornados pelo Asaas (campo + descrição).

## Campos obrigatórios (validados antes do envio)

Bloqueia o botão "Criar cobrança" e mostra borda vermelha + mensagem se faltar:

**Cliente / Contato**
- Nome (CRM já fornece)
- CPF/CNPJ (`UF_CRM_*` ou contato vinculado) — Asaas exige para criar customer
- E-mail OU telefone (pelo menos um)

**Cobrança**
- Valor total > 0
- Forma de pagamento (BOLETO / PIX / CREDIT_CARD / UNDEFINED)
- Data de vencimento (ou Data de início, no caso de recorrente/parcelado)

**Recorrente / Parcelado (quando aplicável)**
- Ciclo (Semanal / Quinzenal / Mensal) — quando recorrente
- Nº de parcelas recorrentes — quando recorrente
- Data de fim do contrato — quando recorrente
- Nº de parcelas da entrada — quando "Parcelar entrada" estiver marcado
- Valor de entrada > 0 — quando houver entrada
- Datas de cada parcela da entrada — quando entrada parcelada

**Split (quando aplicável)**
- Wallet ID destino + percentual ou valor fixo por linha

Visualmente: label com `*` vermelho, atributo `required`, validação JS antes do POST, toast listando o que falta.

## Timeline do Deal/Lead após envio

Em `bitrix-payment-iframe` → `crm_tab_create`, depois de tentar criar no Asaas:

**Em caso de sucesso** — chamar `crm.timeline.comment.add`:
```
✅ Cobrança Asaas criada
Valor total: R$ X
Cobranças geradas: N (entrada Nx + recorrente Nx)
IDs Asaas: pay_xxx, pay_yyy
Link da 1ª cobrança: https://...
```

**Em caso de erro (qualquer cobrança falhou)** — chamar `crm.timeline.comment.add`:
```
❌ Erro ao criar cobrança Asaas
Cobranças criadas com sucesso: N
Cobranças com erro: M

Erros retornados pelo Asaas:
- [campo|code] descrição completa
- [campo|code] descrição completa
...

Payload enviado: { valor, vencimento, forma }
```

Implementação:
- Nova função `addDealTimelineComment(client, entityType, entityId, comment)` que escolhe `ENTITY_TYPE = 'deal' | 'lead'`.
- `crm_tab_create` acumula `successList[]` e `errorList[]` por cobrança gerada (entrada + recorrentes). No final, monta o texto e posta 1 comentário consolidado.
- Mesmo se todas falharem, registra no timeline (o usuário precisa ver o erro lá).

## Arquivos

- `supabase/functions/bitrix-payment-iframe/index.ts`
  - `generateCrmPaymentTabPage()` — adicionar `required`, asteriscos, validação JS.
  - `handleCrmTabCreate` — acumular sucessos/erros + chamar `crm.timeline.comment.add` no final.
  - Nova helper `addDealTimelineComment`.

## Fora de escopo

- Tornar os campos `UF_CRM_ASAAS_*` obrigatórios na ficha nativa do Deal.
- Reenvio automático em caso de falha.
- Atividade tipo "tarefa" no timeline (usar somente comentário).

## Validação

1. Abrir aba sem CPF no contato → botão bloqueado, mensagem "CPF/CNPJ obrigatório".
2. Preencher tudo → enviar → no timeline do Deal aparece comentário verde de sucesso com IDs.
3. Forçar erro (ex: valor 0.01 com forma inválida) → no timeline aparece comentário vermelho com lista de erros do Asaas.
