

## Plano: Dashboard Completo Dentro do Iframe do Bitrix24

### Contexto

Atualmente, o dashboard administrativo do Bitrix24 (`generateDashboardPage`) mostra apenas metricas basicas e ultimas transacoes. As paginas completas (Transacoes, Assinaturas, Split, Notas Fiscais, Integracoes, Configuracoes) existem apenas no frontend React externo, que nao e acessivel dentro do Bitrix24 devido ao contexto de autenticacao.

O objetivo e mover toda a gestao para dentro do iframe do Bitrix24, usando uma **barra de navegacao superior** (sem sidebar) para alternar entre as secoes.

### Arquitetura

A abordagem sera construir um **sistema de navegacao por abas dentro do HTML do iframe**, usando JavaScript vanilla para mostrar/esconder secoes sem recarregar a pagina. Todos os dados serao carregados via chamadas `fetch` ao backend (edge functions).

```text
+----------------------------------------------------------+
| [Visao Geral] [Transacoes] [Assinaturas] [Splits]       |
| [Notas Fiscais] [Integracoes] [Configuracoes]            |
+----------------------------------------------------------+
|                                                          |
|   Conteudo da aba ativa                                  |
|                                                          |
+----------------------------------------------------------+
```

A navegacao sera renderizada como uma barra horizontal fixa no topo com botoes estilizados. Ao clicar, o JavaScript mostra o `<div>` correspondente e esconde os demais.

### Componente React (expandable-tabs)

O componente `expandable-tabs` sera instalado no projeto React (frontend) para uso futuro ou em telas que nao sejam do iframe. Dependencias: `framer-motion`, `usehooks-ts`.

Porem, dentro do iframe do Bitrix24, a navegacao sera implementada em **HTML/CSS/JS puro** (sem React), pois o iframe renderiza HTML gerado pela edge function.

### Alteracoes Detalhadas

#### 1. Instalar dependencias no projeto React
- `framer-motion`
- `usehooks-ts`

#### 2. Criar componente `src/components/ui/expandable-tabs.tsx`
- Copiar o componente fornecido pelo usuario

#### 3. Reescrever `generateDashboardPage` em `bitrix-payment-iframe`

Transformar o dashboard atual em um sistema multi-abas com 7 secoes:

| Aba | Conteudo | Dados |
|-----|----------|-------|
| Visao Geral | Metricas + ultimas transacoes (atual) | `transactions` table |
| Transacoes | Tabela completa com filtros (busca, status, metodo) + exportar | `transactions` table |
| Assinaturas | Lista com filtros + cancelar | Supabase function `asaas-webhook` / `subscriptions` |
| Split de Pagamento | CRUD de regras de split | `split_configurations` table |
| Notas Fiscais | Lista + criar + autorizar + cancelar | `invoices` table + `asaas-invoice-process` |
| Integracoes | Status Bitrix24/Asaas + conectar/desconectar | `bitrix_installations` + `asaas_configurations` |
| Configuracoes | API Key, ambiente, webhook, fiscal | `asaas_configurations` + `fiscal_configurations` |

**Estrutura HTML:**
- Barra de navegacao superior fixa com 7 botoes
- 7 divs de conteudo (apenas 1 visivel por vez)
- JavaScript para trocar abas e carregar dados via fetch
- CSS responsivo (barra empilha em mobile)

**Carregamento de dados:**
- Visao Geral: dados ja carregados no server-side (como hoje)
- Demais abas: carregados sob demanda via `fetch` ao endpoint da edge function com parametro `?tab=transactions`, `?tab=subscriptions`, etc.

#### 4. Criar endpoints de dados na edge function

Adicionar no handler principal do `bitrix-payment-iframe` suporte para requests JSON com `action`:

```text
POST /bitrix-payment-iframe
Content-Type: application/json
{ "action": "get_transactions", "memberId": "xxx", "filters": {...} }
{ "action": "get_subscriptions", "memberId": "xxx" }
{ "action": "get_splits", "memberId": "xxx" }
{ "action": "create_split", "memberId": "xxx", "data": {...} }
{ "action": "delete_split", "memberId": "xxx", "splitId": "xxx" }
{ "action": "get_invoices", "memberId": "xxx" }
{ "action": "create_invoice", "memberId": "xxx", "data": {...} }
{ "action": "authorize_invoice", "memberId": "xxx", "invoiceId": "xxx" }
{ "action": "cancel_invoice", "memberId": "xxx", "invoiceId": "xxx" }
{ "action": "get_integrations_status", "memberId": "xxx" }
{ "action": "save_config", "memberId": "xxx", "data": {...} }
{ "action": "repair_webhook", "memberId": "xxx" }
{ "action": "cancel_subscription", "memberId": "xxx", "subscriptionId": "xxx" }
```

Cada action retorna JSON com os dados para popular a aba correspondente.

#### 5. Navegacao superior (CSS/HTML)

```text
Estilo visual:
- Background branco com sombra sutil
- Botoes com icones SVG inline + texto
- Aba ativa: cor primaria (#0066cc), borda inferior
- Responsivo: scroll horizontal em telas pequenas
- Sem sidebar - tudo horizontal
```

### Ordem de Implementacao

1. Instalar `framer-motion` e `usehooks-ts` no projeto React
2. Criar `src/components/ui/expandable-tabs.tsx`
3. Criar os endpoints de dados (actions) no `bitrix-payment-iframe`
4. Reescrever `generateDashboardPage` com o sistema de abas completo
5. Implementar JS de cada aba (carregar dados, filtros, acoes CRUD)
6. Deploy da edge function
7. Testar abrindo o app no Bitrix24

### Arquivos Afetados

**Novos:**
- `src/components/ui/expandable-tabs.tsx`

**Modificados:**
- `supabase/functions/bitrix-payment-iframe/index.ts` (reescrita significativa do dashboard)
- `package.json` (novas dependencias)

### Consideracoes

- O HTML gerado sera grande (~2000+ linhas) mas sera uma unica resposta HTTP, sem necessidade de navegacao extra
- Dados carregados sob demanda via fetch para manter o carregamento inicial rapido
- A autenticacao e feita via `memberId` -- nao precisa de login Supabase dentro do iframe
- O `BX24.fitWindow()` sera chamado em cada troca de aba para ajustar a altura do iframe
- Todas as acoes CRUD (criar split, cancelar assinatura, etc.) usarao fetch para os endpoints existentes ou novos

