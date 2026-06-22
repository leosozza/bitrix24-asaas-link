## Objetivo
Adicionar uma aba "Contratos" no dock do iframe do Bitrix (ao lado de Notas Fiscais / Plano), permitindo listar, criar, editar e excluir templates de contrato direto de dentro do Bitrix24 — sem precisar abrir o dashboard externo.

## Onde
`supabase/functions/bitrix-payment-iframe/index.ts` — é o arquivo que renderiza o dock visto no screenshot. Hoje tem: Visão Geral, Transações, Assinaturas, Notas Fiscais, Plano, Notificações, Segurança, Integrações, Configurações. Falta **Contratos**.

## O que será feito

### 1) Novo botão "Contratos" no dock
Inserido entre **Notas Fiscais** e o separador antes de Plano, com ícone de documento (b24-style stroke SVG seguindo o padrão dos outros tabs).

### 2) Painel `tab-contracts` server-rendered
- **Header**: título "Templates de Contrato" + botão "+ Novo Template" + botão "Abrir editor avançado" (link com `BX24.openApplication` para `/dashboard/contract-templates` no app principal, para usar o TipTap completo quando o usuário quiser arrastar blocos visuais).
- **Lista**: cards com nome, descrição, badge "Padrão", contagem de variáveis Bitrix mapeadas e ações **Editar / Duplicar / Excluir**. Dados vêm de `contract_templates` filtrados por `tenant_id` da instalação (igual ao padrão usado nas outras tabs server-rendered).
- **Editor inline** (modal/painel expandido): formulário com Nome, Descrição, checkbox "Padrão", `<textarea>` grande de HTML do corpo, e duas seções colapsáveis:
  - **Blocos prontos**: botões que injetam HTML pré-pronto no textarea na posição do cursor (Cabeçalho com logo, Cláusula, Tabela de parcelas, Bloco Asaas, Partes, Assinatura, Foro).
  - **Variáveis**: chips clicáveis (`{{cliente_nome}}`, `{{cliente_doc}}`, `{{valor_total}}`, etc.) que inserem o placeholder no cursor.
- **Mapeamento Bitrix**: tabela simples — para cada chave conhecida (`cliente_nome`, `cliente_doc`, `cliente_email`, `cliente_telefone`, `cliente_endereco`, `cliente_empresa`) um `<select>` com a entidade (Deal/Lead/Contact/Company) + `<input>` para o ID do campo Bitrix (UF_CRM_xxx, EMAIL, etc.). Carrega/salva em `bitrix_field_map`.
- **Pré-visualização**: iframe `srcdoc` que renderiza o HTML do corpo em tempo real ao lado do textarea (ou em aba "Preview" do editor para caber na largura).

> Não vamos embutir TipTap aqui (é React-only). O editor inline do iframe usa textarea + ajudantes (blocos/variáveis), mantendo a edição plenamente funcional. Para WYSIWYG total, o botão "Abrir editor avançado" leva ao dashboard React.

### 3) Ações do backend (mesma edge function)
Adicionar novos `action`s ao handler POST de `bitrix-payment-iframe` (já é o hub de actions do iframe — ver memória `Iframe API Hub`):
- `contract_templates_list` → SELECT por tenant_id.
- `contract_template_save` → INSERT ou UPDATE em `contract_templates` (com `bitrix_field_map`, `asaas_billing_map`, `body_html`, `is_default`).
- `contract_template_delete` → DELETE por id + tenant_id.
- `contract_template_duplicate` → INSERT cópia.
Todos usam `SUPABASE_SERVICE_ROLE_KEY` + filtro por `tenant_id` derivado de `member_id` (mesmo padrão das outras actions). Após save/delete, dispara `sync_robot_templates` via `bitrix-contract-setup` (fire-and-forget), igual ao hook React faz.

### 4) JS client-side do iframe
- `loadContracts()` ao trocar para a aba.
- `openContractEditor(id?)`, `saveContractTemplate()`, `deleteContractTemplate(id)`, `duplicateContractTemplate(id)`.
- `insertBlock(html)` / `insertVariable(code)` usando `selectionStart/selectionEnd` do textarea.
- `updatePreview()` no `input` do textarea (debounce 250ms) atualizando `srcdoc`.
- Reusa o helper de chamada já existente (`callIframeApi(action, payload)`).

## Fora de escopo
- Drag-and-drop visual de blocos (fica só no `/dashboard/contract-templates` React).
- Upload de imagens dentro do iframe (no editor inline o usuário cola URL).
- Edição do `asaas_billing_map` aqui (continua no dashboard); a aba do iframe mostra apenas que está configurado.

## Arquivos
- **Editado**: `supabase/functions/bitrix-payment-iframe/index.ts` (novo botão de dock, painel `tab-contracts`, CSS específico, 4 novos handlers de action, JS client do editor).

Nenhuma migração nem alteração de schema — a tabela `contract_templates` já tem todos os campos necessários.
