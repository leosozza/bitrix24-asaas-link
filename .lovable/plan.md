# Problema

O robô de Bizproc `asaas_contract_generate` (ConnectPay: Gerar Contrato) só é registrado quando alguém chama explicitamente `bitrix-contract-setup` (ação `setup_fields` ou `sync_robot_templates`). Os fluxos automáticos de registro de robôs — usados na instalação do app e na auto‑reparação — registram apenas os 5 robôs antigos (`asaas_create_charge`, `asaas_check_payment`, `asaas_create_subscription`, `asaas_cancel_subscription`, `asaas_create_invoice`). Resultado: no tenant Delivery Real (e em qualquer tenant que não passou pelo setup manual), o robô de gerar contrato não aparece na lista do Bizproc.

# Solução

Incluir o robô `asaas_contract_generate` em todos os pontos onde os robôs são registrados/verificados, carregando dinamicamente os templates do tenant para preencher o select `template_id`.

## Mudanças

1. **`supabase/functions/_shared/contract-robot-def.ts`** (novo)
   - Exportar uma função `buildContractRobotParams(templates, supabaseUrl)` que devolve o objeto `PROPERTIES`/`RETURN_PROPERTIES`/`HANDLER` idêntico ao já usado em `bitrix-contract-setup` (CODE `asaas_contract_generate`, handler `${SUPABASE_URL}/functions/v1/bitrix-contract-robot`).
   - Fallback `__default__` quando o tenant ainda não tem templates.

2. **`supabase/functions/bitrix-contract-setup/index.ts`**
   - Substituir o `registerRobot` local pela chamada à nova função compartilhada (sem mudar comportamento externo).

3. **`supabase/functions/bitrix-payment-iframe/index.ts`**
   - Em `registerAutomationRobots(...)`: após registrar os 5 robôs existentes, carregar os templates do tenant (`contract_templates` por `tenant_id`) e registrar também o `asaas_contract_generate` (delete + add).
   - Em `ensureAutomationRobots(...)`: adicionar `'asaas_contract_generate'` ao array `expectedRobots`, para que a verificação periódica detecte ausência e force re‑registro.

4. **`supabase/functions/bitrix-install/index.ts`**
   - No bloco que registra robôs durante a instalação, incluir o `asaas_contract_generate` (usando a função compartilhada e os templates do tenant, ou o fallback `__default__` se a instalação ainda não tiver templates).

5. **Migração manual única (via supabase--insert opcional)**
   - Para os tenants já instalados (incluindo Delivery Real `42bacd0a-...`), basta acionar o `ensureAutomationRobots` (já chamado pelo iframe na primeira abertura) — não é necessário script extra; o novo `expectedRobots` cuidará do registro.

## Observações

- Nenhuma mudança de schema.
- Nenhuma alteração no frontend.
- Comportamento do robô já existe e funciona (rota `bitrix-contract-robot`); este plano apenas garante que ele seja registrado para todos os tenants automaticamente.
