

## Plano: Placement CRM Detail Tab + Badges de Cobranca

Este plano cobre 3 areas: (1) revisar o pay system existente, (2) criar placements CRM_XXX_DETAIL_TAB para acompanhamento de pagamentos em Lead/Deal/SPA, e (3) registrar badges no kanban do CRM para status de cobranca.

---

### 1. Revisao do Pay System (Validacao)

O sistema de pagamento nativo esta correto. Pontos verificados:

- `sale.paysystem.handler.add` com modo `IFRAME_DATA` e `ACTION_URI` apontando para `bitrix-payment-iframe` -- OK
- `sale.paysystem.add` cria 3 metodos (PIX, Boleto, Cartao) vinculados ao handler `asaas_payments` -- OK
- `ENTITY_REGISTRY_TYPE: 'ORDER'` -- OK para faturas/pedidos
- `BX_REST_HANDLER: 'asaas_payments'` -- referencia correta ao handler registrado
- Campos mapeados (PAYMENT_ID, PAYMENT_AMOUNT, CUSTOMER_NAME, etc.) -- OK
- Webhook do Asaas chama `sale.paysystem.pay.payment` para marcar como pago -- OK

**Nenhuma correcao necessaria no pay system.**

---

### 2. Criar Placements CRM Detail Tab

Registrar abas em Lead, Deal e SPA (Smart Process) que exibem um painel de acompanhamento financeiro da entidade.

#### 2.1 Nova Edge Function: `bitrix-crm-detail-tab`

Criar `supabase/functions/bitrix-crm-detail-tab/index.ts` que:

- Recebe POST do Bitrix24 com `PLACEMENT`, `PLACEMENT_OPTIONS` (contendo o `ID` da entidade), `DOMAIN`, `AUTH_ID`, `member_id`
- Identifica o tipo de entidade (Lead=1, Deal=2, SPA=dynamic) a partir do `PLACEMENT`
- Busca no banco de dados as transacoes vinculadas a essa entidade (`bitrix_entity_type` + `bitrix_entity_id`)
- Calcula metricas: total cobrado, total recebido, total em aberto, numero de parcelas/cobrancas, status geral
- Permite gerar novo link de pagamento diretamente (chamando `bitrix-payment-process` ou criando cobranca via Asaas)
- Renderiza HTML com dashboard financeiro da entidade + botao "Gerar Cobranca"

**Dados exibidos na aba:**
- Resumo: Valor total cobrado, Valor recebido, Valor em aberto, Qtd de cobrancas
- Lista de cobrancas vinculadas com status, valor, metodo, data
- Botao "Gerar Link de Pagamento" que abre formulario inline (valor, metodo, CPF/CNPJ, nome, email)
- Link copiavel do pagamento gerado

#### 2.2 Registro dos Placements (Lazy Registration)

Adicionar na funcao `registerPaySystemsLazy` (ou em uma nova funcao `registerPlacements`) chamadas a `placement.bind` para:

```text
CRM_LEAD_DETAIL_TAB    -> "Pagamentos Asaas"
CRM_DEAL_DETAIL_TAB    -> "Pagamentos Asaas"
CRM_DYNAMIC_XXX_DETAIL_TAB -> (para cada SPA configurado)
```

O `HANDLER` aponta para a nova edge function:
`https://prpvoabbenonecgzufhb.supabase.co/functions/v1/bitrix-crm-detail-tab`

O registro sera feito no fluxo lazy da `bitrix-payment-iframe`, junto com pay systems e robots.

#### 2.3 Adicionar coluna de controle

Adicionar coluna `placements_registered` (boolean, default false) na tabela `bitrix_installations` para controlar o registro lazy dos placements.

#### 2.4 Vincular transacoes a entidades CRM

Atualmente `transactions` ja tem `bitrix_entity_type` e `bitrix_entity_id`. Precisamos garantir que ao criar cobranças via:
- Robot `asaas_create_charge`: salvar o entity_type (lead/deal) e entity_id
- Payment iframe (checkout): ja salva `bitrix_entity_type: 'invoice'` e `bitrix_entity_id`
- Nova aba CRM Detail Tab: ao gerar cobranca, salvar o tipo e ID da entidade

---

### 3. Badges no Kanban do CRM

Usar a API `crm.activity.configurable.add` com `badgeCode` e `crm.activity.badge.add` para exibir badges visuais no kanban.

#### 3.1 Registrar Badges (na instalacao/lazy)

Chamar `crm.activity.badge.add` para cada status:

| Code | Title | Value | Type (cor) |
|------|-------|-------|------------|
| `asaas_charge_created` | Asaas | Cobranca Criada | primary (azul) |
| `asaas_charge_viewed` | Asaas | Cobranca Visualizada | warning (amarelo) |
| `asaas_charge_overdue` | Asaas | Cobranca em Atraso | failure (vermelho) |
| `asaas_charge_paid` | Asaas | Cobranca Paga | success (verde) |
| `asaas_charge_cancelled` | Asaas | Cobranca Cancelada | secondary (cinza) |

Adicionar na funcao de lazy registration, com flag `badges_registered` na tabela `bitrix_installations`.

#### 3.2 Criar Configurable Activity ao criar cobranca

Quando uma cobranca e criada (no `bitrix-robot-handler`, `bitrix-payment-process`, ou na nova aba), criar uma atividade configuravel no timeline:

```javascript
crm.activity.configurable.add({
  ownerTypeId: 2,  // 1=Lead, 2=Deal
  ownerId: dealId,
  fields: {
    completed: false,
    badgeCode: 'asaas_charge_created'
  },
  layout: {
    icon: { code: 'dollar' },
    header: { title: 'Cobranca Asaas - PIX' },
    body: {
      blocks: {
        info: {
          type: 'lineOfBlocks',
          properties: {
            blocks: {
              value: { type: 'text', properties: { value: 'R$ 1.500,00' } },
              status: { type: 'text', properties: { value: 'Pendente' } }
            }
          }
        }
      }
    },
    footer: {
      buttons: {
        view: {
          title: 'Ver Cobranca',
          action: { type: 'openRestApp', actionParams: { chargeId: 'xxx' } },
          type: 'primary'
        }
      }
    }
  }
})
```

#### 3.3 Atualizar Badge via Webhook

No `asaas-webhook`, quando o status do pagamento muda:
- **PAYMENT_RECEIVED/CONFIRMED**: Atualizar badge para `asaas_charge_paid`, marcar activity como `completed: true`
- **PAYMENT_OVERDUE**: Atualizar badge para `asaas_charge_overdue`
- **PAYMENT_REFUNDED/CANCELLED**: Atualizar badge para `asaas_charge_cancelled`, marcar como completed

Usar `crm.activity.configurable.update` para mudar o `badgeCode` e o layout.

Isso requer armazenar o `activity_id` retornado pelo Bitrix na tabela `transactions` (nova coluna `bitrix_activity_id`).

---

### Resumo de Alteracoes

#### Banco de Dados (migracao)
- Adicionar `placements_registered` (boolean, default false) em `bitrix_installations`
- Adicionar `badges_registered` (boolean, default false) em `bitrix_installations`
- Adicionar `bitrix_activity_id` (text, nullable) em `transactions`

#### Edge Functions novas
- `bitrix-crm-detail-tab/index.ts` -- renderiza a aba de pagamentos dentro de Lead/Deal/SPA

#### Edge Functions modificadas
- `bitrix-payment-iframe/index.ts` -- lazy registration de placements e badges
- `asaas-webhook/index.ts` -- criar/atualizar activities + badges quando status muda
- `bitrix-robot-handler/index.ts` -- criar activity ao gerar cobranca via robot
- `bitrix-payment-process/index.ts` -- criar activity ao processar pagamento

#### Config
- `supabase/config.toml` -- adicionar `[functions.bitrix-crm-detail-tab]` com `verify_jwt = false`

---

### Ordem de Implementacao

1. Migracao de banco (3 colunas)
2. Criar edge function `bitrix-crm-detail-tab` com HTML do painel financeiro + formulario de cobranca
3. Adicionar registro de placements e badges no lazy registration (`bitrix-payment-iframe`)
4. Modificar `asaas-webhook` para criar/atualizar activities com badges
5. Modificar `bitrix-robot-handler` para criar activity ao gerar cobranca
6. Modificar `bitrix-payment-process` para criar activity ao processar pagamento
7. Deploy de todas as edge functions
8. Testar: abrir Lead/Deal no Bitrix24 e verificar a aba "Pagamentos Asaas"

