## Problema

A coluna **Uso** mostra `0/500` para todos os tenants porque `tenant_subscriptions.transactions_used` nunca é incrementado em lugar nenhum do código (nem por trigger, nem pelos webhooks/edge functions que inserem em `transactions`). O valor fica preso no DEFAULT 0 da criação.

## Solução

Calcular o uso **ao vivo** a partir da tabela `transactions`, contando as transações de cada tenant dentro do período atual da assinatura (`current_period_start` → `current_period_end`). Sem migrações, sem triggers, sem risco de dessincronia.

### Mudanças

1. **`supabase/functions/admin-tenant-management/index.ts` — case `list_tenants`**
   - Após carregar `subs`, para cada subscription rodar uma contagem:
     ```ts
     supabase.from('transactions')
       .select('id', { count: 'exact', head: true })
       .eq('tenant_id', sub.tenant_id)
       .gte('created_at', sub.current_period_start)
       .lte('created_at', sub.current_period_end + 'T23:59:59');
     ```
   - Executar em paralelo com `Promise.all` para todos os tenants.
   - Sobrescrever `subscription.transactions_used` com o count real antes de devolver para o front.
   - Considerar apenas transações com `status` relevante (`confirmed`, `received`, `pending`) — confirmar lista olhando os status já usados em `asaas-webhook`. Default: contar todas exceto `cancelled`/`refunded`/`failed`.

2. **`supabase/functions/admin-tenant-management/index.ts` — case `get_tenant`**
   - Aplicar a mesma contagem por período no `transactions_count` retornado, para o drawer/detalhe ficar consistente.

3. **`src/pages/DashboardSettings.tsx`** (visão do próprio tenant)
   - Em vez de ler `sub.transactions_used`, fazer a mesma contagem no client (já tem RLS por tenant) usando `current_period_start`/`current_period_end`.
   - Mesma lógica em `bitrix-payment-iframe` (linhas ~2629/2644) para o painel embedded.

### Fora de escopo

- Não vamos criar trigger de incremento agora (mais frágil: reset por período, rollback em refund, etc.). Se quiser persistir o contador depois, dá pra adicionar numa segunda iteração.
- Não vamos alterar schema nem migrações.

### Validação

- Abrir `/admin/tenants` no mobile → coluna **Uso** deve refletir o número real de transações do período (ex.: `3 / 500`).
- Tenant sem transações continua `0 / 500`.
- Drawer de detalhe e `DashboardSettings` mostram o mesmo número.

Posso aplicar?