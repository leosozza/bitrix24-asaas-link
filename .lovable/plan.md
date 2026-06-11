## Problema

Hoje os robôs Asaas usam o `document_id` automático do workflow para identificar o Deal/Lead onde gravar timeline e atividade. Isso falha quando:

- O workflow roda em outra entidade (ex.: começa num Lead mas precisa criar cobrança ligada a um Deal já existente).
- O usuário quer disparar o robô de um automation que não está no contexto da entidade alvo.
- O usuário não tem como apontar manualmente "use o Deal X".

## Solução

Adicionar uma **propriedade de entrada opcional** chamada `bitrix_entity_id` (e tipo de entidade) em cada robô Asaas. Quando preenchida, o handler ignora o `document_id` do workflow e usa o ID escolhido pelo usuário para:

- Postar o comentário no timeline da entidade certa.
- Criar a activity configurável (badge de cobrança) no Deal/Lead certo.
- Gravar `bitrix_entity_id` correto na tabela `transactions`.

## Mudanças

### 1. `supabase/functions/bitrix-install/index.ts` (registro dos robôs)

Adicionar nas `PROPERTIES` dos 5 robôs (`asaas_create_charge`, `asaas_check_payment`, `asaas_create_subscription`, `asaas_cancel_subscription`, `asaas_create_invoice`):

```text
bitrix_entity_type:
  Name: 'Tipo de Entidade Bitrix'
  Type: 'select'
  Options: { deal: 'Negócio', lead: 'Lead', contact: 'Contato' }
  Default: 'deal'
  Required: 'N'

bitrix_entity_id:
  Name: 'ID do Deal/Lead/Contato (opcional)'
  Type: 'string'
  Required: 'N'
  Description: 'Se vazio, usa a entidade atual do workflow'
```

### 2. `supabase/functions/bitrix-payment-iframe/index.ts` (re-registro/repair)

Replicar as mesmas adições nas definições dos robôs (a função de repair re-registra os robôs com `bizproc.robot.update` ou delete+add).

### 3. `supabase/functions/bitrix-robot-handler/index.ts` (execução)

No início do `switch`, resolver o alvo:

```text
const propEntityId   = robotData.properties.bitrix_entity_id?.toString().trim();
const propEntityType = (robotData.properties.bitrix_entity_type || 'deal').toLowerCase();

const fallbackDocId  = robotData.document_id[2] || robotData.document_id[0] || '';
const fallbackType   = inferTypeFromDocId(robotData.document_id[1]); // CRM_DEAL → deal, CRM_LEAD → lead, etc.

const targetEntityId   = propEntityId || stripNonDigits(fallbackDocId);
const targetEntityType = propEntityId ? propEntityType : fallbackType;
```

Usar `targetEntityId` / `targetEntityType` em:

- `postTimelineComment` (mapear `deal→2`, `lead→1`, `contact→3` para `ownerTypeId`).
- `crm.activity.configurable.add` (mesmo mapeamento de `ownerTypeId`).
- `transactions.insert` (`bitrix_entity_id`, `bitrix_entity_type`).
- `externalReference` (`bitrix_${member_id}_${targetType}_${targetEntityId}`).

### 4. Auto-repair / re-registro

Após o deploy, o usuário precisa rodar o **Repair Tool** existente (ou reinstalar o app) para que os robôs sejam re-registrados com a nova propriedade. Adicionar nota no toast/log de repair: "Robôs atualizados com campo ID do Bitrix".

## Resultado

No designer do Bizproc o usuário verá no robô Asaas dois campos novos:

- "Tipo de Entidade Bitrix" (Negócio / Lead / Contato)
- "ID do Deal/Lead/Contato"

Pode deixar vazio (comportamento atual) ou apontar qualquer ID — o resultado/cobrança vai parar no lugar certo, com timeline e activity na entidade escolhida.

## Não incluído

- UI no dashboard para configurar isso (é configurado no próprio designer do Bitrix).
- Suporte a SPA dinâmicos (`DYNAMIC_xxx`) — pode ser adicionado depois se precisar.
