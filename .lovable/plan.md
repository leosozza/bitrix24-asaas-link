

## Plano: Usar Icones Compativeis com Bitrix24 (b24icons) em Toda Aplicacao

### Contexto

A biblioteca oficial de icones do Bitrix24 e `@bitrix24/b24icons` (v2.0.8). Atualmente a aplicacao usa:
- **Emojis** (💳, 📄, 📋, ✅, 🔧) nas paginas HTML renderizadas dentro do Bitrix24
- **SVGs inline customizados** (icones de PIX, boleto, cartao) nas edge functions
- **`icon: { code: 'dollar' }`** nas configurable activities -- "dollar" NAO e um codigo valido do Bitrix24
- **Lucide React** no frontend dashboard (este permanece, pois o dashboard nao roda dentro do Bitrix24)

### Escopo das Alteracoes

Somente as **Edge Functions que renderizam HTML dentro do Bitrix24** (iframes e timeline) serao alteradas. O frontend React (dashboard/landing) continuara usando lucide-react pois nao e exibido dentro do Bitrix24.

---

### 1. Configurable Activity Icons (Timeline)

O campo `icon.code` nas configurable activities aceita codigos obtidos via `crm.timeline.icon.list`. O codigo `dollar` nao existe. 

**Solucao:** Registrar um icone customizado via `crm.timeline.icon.add` durante o lazy registration, e usar o codigo registrado. Alternativa: usar o icone de sistema `info` como fallback.

**Arquivos afetados:**
- `supabase/functions/bitrix-crm-detail-tab/index.ts` (linha 45)
- `supabase/functions/asaas-webhook/index.ts` (linha 139)
- `supabase/functions/bitrix-robot-handler/index.ts` (linha 382)
- `supabase/functions/bitrix-payment-process/index.ts` (linha 373)

**Mudanca:** Substituir `icon: { code: 'dollar' }` por `icon: { code: 'payment' }` -- registrado via lazy registration com `crm.timeline.icon.add` usando o SVG do b24icons `crm/crm-payment`.

**Adicionar no lazy registration** (`bitrix-payment-iframe/index.ts`):
- Chamar `crm.timeline.icon.add` com `code: 'payment'` e o `fileData` do SVG do icone `crm-payment` do b24icons
- Adicionar flag `icons_registered` na tabela `bitrix_installations`
- Migracao de banco: `ALTER TABLE bitrix_installations ADD COLUMN icons_registered boolean DEFAULT false;`

---

### 2. HTML Pages - Substituir Emojis por SVGs do b24icons

Nas paginas HTML renderizadas dentro de iframes do Bitrix24, substituir todos os emojis por SVGs inline da biblioteca b24icons.

**Mapeamento de substituicoes:**

| Local | Emoji/SVG atual | Icone b24icons (categoria/nome) |
|-------|-----------------|-------------------------------|
| Botao "Ativar Pagamentos" | ✅ | outline/circle-check |
| Botao "Reparar Webhook" | 🔧 | outline/spanner |
| Card Asaas | 💳 | outline/credit-debit-card |
| PIX gerado | ✅ | outline/circle-check |
| Copiar codigo PIX | 📋 | outline/copy |
| Visualizar boleto | 📄 | outline/document |
| Copiar linha digitavel | 📋 | outline/copy |
| Pagamento processado | ✅ | outline/circle-check |

**Arquivo afetado:** `supabase/functions/bitrix-payment-iframe/index.ts`

---

### 3. HTML Pages - Substituir SVGs Inline Customizados

Os SVGs customizados de metodos de pagamento (PIX, boleto, cartao) no `methodIcons` do dashboard serao substituidos por icones b24icons equivalentes.

| SVG atual | Icone b24icons |
|-----------|---------------|
| PIX (icone customizado) | outline/money |
| Boleto (barcode customizado) | outline/barcode |
| Cartao (card customizado) | outline/credit-debit-card |

**Arquivos afetados:**
- `supabase/functions/bitrix-payment-iframe/index.ts` (methodIcons, linhas 1898-1902)

---

### 4. SVGs do Dashboard Header e Empty State

Os SVGs inline no dashboard (`bitrix-payment-iframe`) para o header (layers icon) e empty state (grid icon) e settings (gear icon) serao trocados por icones b24icons.

| SVG atual | Icone b24icons |
|-----------|---------------|
| Header (layers) | outline/crm |
| Settings (gear) | outline/settings |
| Empty state (grid) | outline/list |

**Arquivo afetado:** `supabase/functions/bitrix-payment-iframe/index.ts`

---

### 5. Pagina de Instalacao

O SVG de checkmark na pagina de sucesso sera substituido por `outline/circle-check`.

**Arquivo afetado:** `supabase/functions/bitrix-install/index.ts`

---

### 6. Detail Tab (CRM)

O painel de pagamentos ja nao usa emojis, mas os botoes e labels de acao podem receber icones b24icons para consistencia visual.

- Botao "Gerar Cobranca" -> adicionar icone `outline/circle-plus` inline
- Link "Ver" na tabela -> adicionar icone `outline/go-to-m` inline

**Arquivo afetado:** `supabase/functions/bitrix-crm-detail-tab/index.ts`

---

### Implementacao Tecnica

Para cada SVG do b24icons, usaremos o conteudo SVG inline diretamente no HTML (copiado do repositorio `bitrix24/b24icons/src/icons/`). Como as edge functions geram HTML puro, nao ha necessidade de instalar pacotes npm -- basta embutir o SVG inline com tamanho controlado via `width`/`height` e `style`.

Exemplo:
```html
<!-- Antes -->
<button>✅ Ativar Pagamentos</button>

<!-- Depois -->
<button>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <!-- SVG path do b24icons outline/circle-check -->
  </svg>
  Ativar Pagamentos
</button>
```

---

### Resumo de Alteracoes

#### Banco de Dados
- Adicionar `icons_registered` (boolean, default false) em `bitrix_installations`

#### Edge Functions modificadas
- `bitrix-payment-iframe/index.ts` -- substituir emojis e SVGs customizados + registrar timeline icon
- `bitrix-install/index.ts` -- substituir SVG de checkmark
- `bitrix-crm-detail-tab/index.ts` -- adicionar icones b24icons nos botoes + mudar icon.code
- `asaas-webhook/index.ts` -- mudar icon.code de 'dollar' para 'payment'
- `bitrix-robot-handler/index.ts` -- mudar icon.code de 'dollar' para 'payment'
- `bitrix-payment-process/index.ts` -- mudar icon.code de 'dollar' para 'payment'

#### Ordem de Implementacao
1. Migracao de banco (1 coluna)
2. Buscar os SVGs corretos do repositorio b24icons
3. Atualizar `bitrix-payment-iframe` com lazy registration do timeline icon + substituir emojis/SVGs
4. Atualizar `bitrix-crm-detail-tab` com icones e icon.code correto
5. Atualizar `asaas-webhook`, `bitrix-robot-handler`, `bitrix-payment-process` com icon.code correto
6. Atualizar `bitrix-install` com SVG correto
7. Deploy de todas as edge functions

