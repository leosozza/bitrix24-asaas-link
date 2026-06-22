## Status atual

- `supabase/functions/bitrix-contract-robot/index.ts` — **já existe**, recebe callback do Bizproc, gera o contrato e devolve `contract_url`/`pdf_url` para o workflow.
- `supabase/functions/bitrix-contract-setup/index.ts` — registra os campos UF_CRM e o robot via `bizproc.robot.add`, mas só roda quando o usuário clica num botão no dashboard. O robot hoje usa `template_id` como string livre e não tem mapeamento Asaas.
- Editor de template hoje é um `<Textarea>` de HTML puro em `DashboardContractTemplates.tsx`.

## 1) Editor visual "estilo Canva" (TipTap)

**Pacotes**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table` (+ row/cell/header), `@tiptap/extension-image`, `@tiptap/extension-text-align`, `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`.

**Novo componente**: `src/components/contracts/ContractTemplateEditor.tsx`
- Toolbar fixa: H1/H2/H3, B/I/U, alinhamento, listas, citação, cores, tabela, imagem (upload via bucket `contracts`), link, divisor, desfazer/refazer.
- Painel lateral "Blocos" (arrastar ou clicar para inserir no cursor):
  - Cabeçalho com logo, Cláusula numerada, Tabela de parcelas (`{{parcelas_tabela}}`), Bloco assinatura, Foro, Dados do contratado/contratante, Bloco pagamento Asaas.
- Painel "Variáveis": chips de placeholders Bitrix (`{{cliente_*}}`, `{{deal_*}}`) e Asaas (`{{asaas_*}}`) — clique insere `{{...}}` como nó inline com badge colorido (NodeView simples).
- Toggle "HTML avançado" cai no `<Textarea>` atual (não quebra templates existentes).
- Seletor de capa (`cover_style`: minimal / azul-elegante / telecom / saas / produto) com preview thumbnail; ao salvar grava no campo já existente `cover_style`.

**Integração**: `DashboardContractTemplates.tsx` substitui o textarea pelo `ContractTemplateEditor`, mantendo `BitrixFieldMapper` e `AsaasBillingFieldMapper`. Persistência continua em `contract_templates.body_html`.

**Iframe Bitrix**: nova rota `/iframe/contract-templates` (e novo placement opcional `CONTRACT_TEMPLATES_EDITOR` no `bitrix-iframe`) que renderiza a mesma página dentro do iframe, respeitando a regra de full width e ícones `@bitrix24/b24icons`.

## 2) Robot — auto-registro + template dropdown + Asaas

**Auto-registro na instalação**: em `supabase/functions/bitrix-install/index.ts`, após o token ficar ativo, chamar `bitrix-contract-setup` com `action: "setup_fields"` (fire-and-forget, ignora erros conhecidos). Também rodar uma vez por sessão quando o iframe principal abre, como self-healing (já é o padrão do projeto).

**Robot enriquecido** (`bitrix-contract-setup` → `registerRobot`):
- `template_id` muda para `Type: "select"` com `Options` populado pelos templates do tenant (consulta `contract_templates` antes do `bizproc.robot.add`, regrava o robot sempre que a lista muda).
- Novos campos do robot: `asaas_auto_charge` (bool), `asaas_billing_type` (select PIX/BOLETO/CREDIT_CARD/UNDEFINED), `asaas_charge_mode` (select unica/parcelada/assinatura_mensal), `asaas_subscription_cycle` (select MONTHLY/WEEKLY/YEARLY).
- `RETURN_PROPERTIES` ganha `payment_link` e `subscription_id`.

**Handler** (`bitrix-contract-robot`): lê os novos `properties[asaas_*]`, grava em `contracts.auto_create_charge`, `asaas_billing_type`, `asaas_charge_mode`, `asaas_subscription_cycle` ao chamar `contract-generate`. Quando `asaas_auto_charge=Y` e o gerador devolver `payment_url`, retorna ao Bizproc.

**Hook de re-sync**: novo endpoint `action: "sync_robot_templates"` em `bitrix-contract-setup` que regrava o robot com a lista atual de templates; chamado automaticamente após criar/editar/excluir template em `useContracts.ts`.

## 3) Aba iframe "Gerar contrato deste Deal"

- Novo placement Bitrix `CRM_DEAL_DETAIL_TOOLBAR` (ou reaproveitar `CRM_DEAL_DETAIL_TAB` já existente) com um botão/aba "Gerar contrato".
- Edge function `bitrix-crm-detail-tab` já é a porta; adicionar `mode=contract` que renderiza um mini-wizard: escolhe template, mostra dados resolvidos via `bitrix-contract-fields` (`resolve`), seleciona modo Asaas, e ao confirmar chama `contract-generate` com `bitrix_entity_type=deal`.
- Após gerar, mostra link + botão "Copiar" e atualiza os UF_CRM via `bitrix-contract-setup` (`update_entity`).

## Detalhes técnicos

- `bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-image @tiptap/extension-text-align @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-link @tiptap/extension-placeholder`.
- Upload de imagem no editor usa o bucket `contracts` já existente (path `templates/{tenant}/{uuid}.png`); precisa de policy de INSERT/SELECT para `authenticated` no bucket — adicionar migration caso ainda não exista.
- NodeView de placeholder mantém o texto serializado como `{{nome}}` para o `contract-generate` continuar funcionando sem mudanças.
- `bizproc.robot.update` para reescrever o robot quando templates mudam; se não existir, fazer `delete` + `add`.
- Nada muda em `contract_templates` schema (já tem `cover_style`, `bitrix_field_map`, `asaas_billing_map`).

## Fora de escopo

- Editor canvas livre x/y (não compatível com o renderer HTML/PDF atual).
- Versionamento/histórico de templates.
- Editor colaborativo em tempo real.
