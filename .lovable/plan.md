## Visual "Word-like" para o editor de templates

Transformar a área de edição do template (aba Contratos → editar template) em uma visualização tipo página A4 do Word, mantendo toda a lógica atual.

### Onde mexer
- `src/components/contracts/ContractTemplateEditor.tsx` (editor TipTap usado no dashboard)
- `src/index.css` (estilos globais `.docx-page` para a página)
- `src/pages/DashboardContractTemplates.tsx` (ajustar largura do Dialog para caber a folha A4 + painéis laterais)

### Mudanças visuais (somente UI)
1. **Folha A4 simulada** envolvendo o `EditorContent`:
   - Fundo cinza claro (`bg-muted/40`) na área externa, com padding vertical.
   - Página branca centralizada: `width: 21cm`, `min-height: 29.7cm`, `padding: 2.5cm 2cm`, `box-shadow: 0 4px 24px rgba(0,0,0,.12)`, borda sutil, cantos levemente arredondados.
   - Tipografia padrão de documento: `font-family: "Times New Roman", Georgia, serif`, `font-size: 12pt`, `line-height: 1.5`, `color: #1a1a1a`.
   - Régua opcional no topo (linha fina com marcações a cada 1cm) — incluída como detalhe visual estático.

2. **Toolbar estilo Word**:
   - Fundo levemente diferente (`bg-card`), sombra inferior sutil, sticky no topo da área do editor, alinhada à largura da folha.
   - Agrupar botões com separadores verticais já existentes (manter ícones atuais).
   - Adicionar um pequeno seletor de zoom (75% / 100% / 125%) que aplica `transform: scale()` na folha — puramente visual.

3. **Modo HTML**: manter como está, mas envolver o `<textarea>` no mesmo container cinza (sem a folha), para consistência.

4. **Quebra de página visual** (opcional, leve): linha tracejada horizontal a cada ~29,7cm de conteúdo via `background-image` repetido na área externa — apenas indicativo, não força quebra real.

5. **Painel lateral** (Blocos prontos / Variáveis): manter à direita, mas com visual mais "ribbon-like" — cabeçalhos em caixa alta, fundo `bg-card`, separadores.

6. **Diálogo**: aumentar `max-w-7xl` para acomodar a folha A4 (~794px) + 2 painéis laterais sem espremer. Em telas menores, a folha encolhe proporcionalmente via `max-width: 100%`.

### Estilos `.docx-page` (resumo)
```css
.docx-canvas { background: #e5e7eb; padding: 24px 0; overflow: auto; }
.docx-page {
  width: 21cm; min-height: 29.7cm;
  margin: 0 auto; padding: 2.5cm 2cm;
  background: #fff; color: #1a1a1a;
  font-family: "Times New Roman", Georgia, serif;
  font-size: 12pt; line-height: 1.5;
  box-shadow: 0 4px 24px rgba(0,0,0,.12);
  border: 1px solid #d1d5db; border-radius: 2px;
}
.docx-page :is(h1,h2,h3) { font-family: inherit; color: #111; }
.docx-page table { border-collapse: collapse; width: 100%; }
.docx-page table td, .docx-page table th { border: 1px solid #cbd5e1; padding: 6px 8px; }
```
A classe `prose` do EditorContent é substituída por `.docx-page` para o look de documento (sem cores do tema escuro dentro da folha — a folha é sempre clara, como Word).

### Fora de escopo
- Editor visual da aba iframe do Bitrix (continua HTML textarea + preview) — esta mudança é só no dashboard React.
- Paginação real / quebras forçadas.
- Cabeçalho/rodapé com numeração de páginas.
- Exportação para `.docx`.

### Resultado
Ao abrir "Editar template" no dashboard, o usuário vê uma folha branca A4 centralizada com sombra, fonte serifada, margens visíveis e toolbar no topo — sensação de estar editando um documento no Word.
