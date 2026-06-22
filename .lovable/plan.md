## Reestruturar diálogo de edição do template

O problema: o diálogo tem 3 colunas (`[1fr_260px_280px]`) — editor + Mapeamento Bitrix + Cobrança Asaas — que espremem a folha A4 (21cm ≈ 794px) e tornam o contrato ilegível.

### Solução: layout em abas com folha em destaque

**1) Diálogo full-screen (ou quase)**
- `DashboardContractTemplates.tsx`: `DialogContent` passa de `max-w-7xl` para `max-w-[98vw] w-[98vw] h-[95vh]` com `p-0` e flex column.
- Cabeçalho fixo no topo (nome + descrição + ações Salvar/Cancelar/Pré-visualizar/Padrão).

**2) Layout de 2 áreas com mapeadores em painel lateral colapsável**
```
┌─────────────────────────────────────────────────────────┐
│ Editar template · [Nome] [Descrição]    [Salvar][X]     │
├──────────────────────────────────────┬──────────────────┤
│                                      │ ▸ Mapeamentos    │ ← drawer
│         FOLHA A4 (centralizada)      │   (Bitrix 0/8)   │   colapsável
│         + ribbon + blocos/variáveis  │   (Asaas 0/8)    │   (toggle)
│                                      │                  │
└──────────────────────────────────────┴──────────────────┘
```
- Botão **"Mapeamentos"** no header alterna o painel lateral direito (300px) — fechado por padrão para dar foco total ao documento.
- Quando fechado: a folha A4 ocupa toda a largura útil (~95vw), com canvas centralizada e bastante respiro.
- Quando aberto: painel à direita com **abas** "Bitrix" e "Asaas", scroll vertical próprio.

**3) Ajustes no ContractTemplateEditor**
- Default zoom passa de `1` para `1` mas com folha cabendo confortavelmente; manter botões 60/75/100/125%.
- Canvas: `max-height` recalculado para `calc(95vh - 240px)` (mais altura disponível).
- Manter a barra horizontal de Blocos+Variáveis já adicionada.

### Arquivos a editar
- `src/pages/DashboardContractTemplates.tsx` — substituir o `DialogContent` grid de 3 colunas por: header sticky + área principal com folha + drawer lateral colapsável contendo `BitrixFieldMapper` e `AsaasBillingFieldMapper` em abas (`Tabs` do shadcn).
- `src/index.css` — ajustar `.docx-canvas` max-height para o novo layout.

### Fora de escopo
- Alterar a lógica dos mapeadores ou do editor.
- Mudar o look "Word" da folha (mantém serifa, sombra, margens).

### Resultado
Folha A4 do contrato fica **claramente legível**, ocupando o centro de um diálogo amplo. Os mapeamentos ficam acessíveis num painel lateral que abre só quando necessário, sem competir por espaço com o documento.
