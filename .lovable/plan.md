## Diagnóstico

O código da Edge Function `bitrix-payment-iframe` **já contém o novo layout** (cabeçalho com lápis, card Asaas resumido, botão "Atualizar Integração" no topo, modais, etc. — linhas 3722–3893). Mesmo assim, o iframe dentro do Bitrix continua mostrando o layout antigo (forms inline "Salvar Empresa", "Salvar Configuração", botão "Reparar Integração Bitrix (robôs + campos)" no fim, etc.). Essas strings **não existem mais no código fonte** — só podem vir de uma versão antiga em execução.

Hipóteses prováveis (em ordem):

1. **ACTION_URI registrada no install aponta para `APP_DOMAIN` (frontend) e não para `SUPABASE_URL`** (`bitrix-install/index.ts` linha 111). O Bitrix está carregando o iframe a partir do domínio do frontend, que pode estar servindo uma build antiga via SPA, ou um proxy. Isso explica também por que mudanças na Edge Function nunca chegam ao usuário.
2. **Cache do Bitrix Marketplace** (o wrapper `/marketplace/app/...` faz cache do HTML do iframe interno).
3. **Edge Function não redeployou** (menos provável — auto-deploy roda no save).

## Plano de correção

### Passo 1 — Apontar `ACTION_URI` para a Edge Function
Em `supabase/functions/bitrix-install/index.ts` linha 111, trocar:
```ts
ACTION_URI: `${appDomain}/functions/v1/bitrix-payment-iframe`,
```
por:
```ts
ACTION_URI: `${Deno.env.get('SUPABASE_URL')}/functions/v1/bitrix-payment-iframe`,
```
Mesmo padrão já usado em `bitrix-robot-handler` (linha 275) e nos webhooks (regra registrada na memória).

### Passo 2 — Re-registrar o app no Bitrix
A `ACTION_URI` só é gravada em `app.install`. Para installations existentes (Delivery Real) precisamos reenviar via `app.update` ou pelo botão "Atualizar Integração". Vamos:

- Adicionar uma chamada `app.update` no handler `repair_integration` (dentro de `bitrix-payment-iframe`) que faz `BX.callMethod('app.update', { ACTION_URI: <novo> })`.
- Assim, clicar em "Reparar Integração" (ou "Atualizar Integração" no novo layout) corrige a URL sem precisar reinstalar.

### Passo 3 — Cache-buster no iframe
Append `?v=<timestamp_deploy>` na ACTION_URI para garantir que o Bitrix carregue versão nova mesmo se houver cache CDN/marketplace.

### Passo 4 — Verificação
1. Salvar a Edge Function `bitrix-install` (auto-deploy).
2. No tenant Delivery Real, abrir o iframe atual e clicar em "Reparar Integração Bitrix" (botão antigo ainda visível porque é o que está rodando).
3. O `repair_integration` rodará o `app.update` e atualizará a ACTION_URI.
4. Recarregar o app no menu do Bitrix → deve aparecer o **novo layout** (cabeçalho com lápis, card Asaas resumido, "↻ Atualizar Integração" no topo, Configuração Fiscal colapsada, "Teste de Integração" movido para aba Integrações).

### Arquivos a editar
- `supabase/functions/bitrix-install/index.ts` — trocar `appDomain` por `SUPABASE_URL` na `ACTION_URI` + cache-buster.
- `supabase/functions/bitrix-payment-iframe/index.ts` — adicionar `app.update` no início do `repair_integration` para corrigir installations existentes.

### Fora de escopo
- Nenhuma mudança visual nova — o layout novo já está implementado, só precisa ser carregado.
- Nenhuma mudança em frontend React (`DashboardSettings.tsx` já foi refeito numa entrega anterior).
