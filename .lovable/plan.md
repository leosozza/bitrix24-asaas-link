
# Corrigir Layout: Conteudo em Tela Cheia no Bitrix24

## Problema
O conteudo das paginas (Visao Geral, Transacoes, Configuracoes, etc.) esta limitado a `max-width: 960px` com `margin: 0 auto`, fazendo com que tudo apareca como um "modal pequeno" centralizado em vez de ocupar a tela cheia dentro do iframe do Bitrix24.

## Solucao
Alterar o CSS da classe `.content` no arquivo `supabase/functions/bitrix-payment-iframe/index.ts` para remover a restricao de largura maxima e permitir que o conteudo ocupe toda a largura disponivel.

## Alteracoes Tecnicas

**Arquivo:** `supabase/functions/bitrix-payment-iframe/index.ts`

1. **Linha 2000** - Alterar o estilo da classe `.content`:
   - De: `.content { padding: 24px; max-width: 960px; margin: 0 auto; }`
   - Para: `.content { padding: 24px; width: 100%; box-sizing: border-box; }`

2. Verificar se ha outras restricoes de `max-width` em containers de conteudo das abas que possam estar limitando a largura (cards de metricas, tabelas, formularios).

3. Redesplegar a edge function `bitrix-payment-iframe`.

## Resultado Esperado
Todo o conteudo do dashboard (metricas, tabelas, formularios) ocupara 100% da largura disponivel dentro do iframe, sem parecer um modal flutuante.
