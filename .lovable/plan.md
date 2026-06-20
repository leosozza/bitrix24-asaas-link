# 5 Templates de contrato + mapeamento de campos do Bitrix

## Objetivo

1. Pré-carregar **5 templates prontos**, incluindo o **Delivery Real** (do .docx anexado) com a seção de pagamento adicionada, o modelo **azul "Pacheco e Lacerda"** e o estilo **"Italnet" Telecom**.
2. No **editor de template**, permitir mapear cada placeholder a um **campo do Bitrix** (padrão ou UF_CRM_*) de Deal/Lead/Contact/Company.
3. Ao gerar contrato a partir de uma entidade Bitrix, os valores são buscados via REST e o contrato é preenchido automaticamente.

---

## Os 5 templates

1. **Delivery Real — Consultoria/Serviços** (baseado no .docx enviado: tabela de DADOS CONTRATUAIS, 11 cláusulas + Anexo I, **agora com a Cláusula 4 expandida para incluir `{{parcelas_tabela}}`** mostrando vencimentos, valores e forma de pagamento)
2. **Prestação de Serviços — Azul Elegante** (header azul listrado, blocos CONTRATANTE/CONTRATADO lado a lado)
3. **Provedor de Internet / Telecom** (numeração hierárquica 1, 1.1, 2, 2.1...)
4. **Assinatura Recorrente / SaaS** (renovação automática, política de cancelamento, SLA)
5. **Venda de Produto / Licença** (entrega, garantia, suporte)

Todos com placeholders Mustache `{{...}}` e o bloco de evidência da assinatura eletrônica é injetado pela função `contract-public` (já implementado).

### Adição de pagamento ao template Delivery Real

A Cláusula 4 atual é genérica. Será expandida para:

```text
CLÁUSULA 4 – VALORES E PAGAMENTO

Valor total contratado: {{valor_total}}
Quantidade de parcelas: {{qtd_parcelas}}
Forma de pagamento conforme cronograma abaixo:

{{parcelas_tabela}}    ← tabela renderizada # / TIPO / VENCIMENTO / VALOR / MÉTODO

Em caso de inadimplência:
• multa de 2% sobre o valor em aberto;
• juros de 1% ao mês pró-rata;
• possibilidade de suspensão dos serviços após 7 dias de atraso.
```

---

## Mapeamento de campos do Bitrix

### UI (editor de template)

Painel "Campos do Bitrix" como 3ª coluna do editor:

```text
Placeholder              Origem (Bitrix)
─────────────────────────────────────────────────
{{cliente_nome}}    ←   Deal → CONTACT_ID → NAME + LAST_NAME
{{cliente_doc}}     ←   Contact → UF_CRM_CPF
{{cliente_email}}   ←   Contact → EMAIL[0].VALUE
{{cliente_empresa}} ←   Company → TITLE
{{cliente_endereco}}←   Company → ADDRESS
{{valor_total}}     ←   Deal → OPPORTUNITY
{{vendedor}}        ←   Deal → ASSIGNED_BY (resolvido para nome)
{{prazo_contrato}}  ←   Deal → UF_CRM_PRAZO
```

Para cada placeholder detectado no `body_html`, o usuário escolhe:
- **Entidade origem** (Deal | Lead | Contact | Company)
- **Campo** (lista carregada dinamicamente via REST do Bitrix)

Salvo no template como:
```json
"bitrix_field_map": {
  "{{cliente_doc}}": { "entity": "contact", "field": "UF_CRM_CPF" },
  "{{cliente_empresa}}": { "entity": "company", "field": "TITLE" }
}
```

### Geração a partir do CRM

Quando o `ContractWizard` recebe `prefill.bitrix_entity_type + bitrix_entity_id`:
1. Após escolher template, botão **"Buscar dados do Bitrix"** aparece no passo 2.
2. Backend (`bitrix-contract-fields?action=resolve`) busca a entidade, resolve relacionadas (Deal→Contact/Company), aplica `bitrix_field_map`, devolve `{ customer, extra_vars, mapped_count }`.
3. UI preenche os campos e mostra "X campos vindos do Bitrix".

---

## Mudanças técnicas

### 1. Migration
- `contract_templates`: adicionar `bitrix_field_map jsonb NOT NULL DEFAULT '{}'`
- `contract_templates`: adicionar `cover_style text` (chave do estilo visual, ex: `delivery_real` / `blue_elegant`)

### 2. Edge functions

**`contract-templates-seed`** (auth)
- Cria os 5 templates para o tenant logado se não existirem.
- Botão "Carregar 5 modelos prontos" na página de templates.

**`bitrix-contract-fields`** (auth)
- `action: "list_fields", entity_type: deal|lead|contact|company` → usa `crm.<entity>.fields` e retorna `[{ id, label, type }]`.
- `action: "resolve", template_id, entity_type, entity_id` → busca entidade + relacionadas, aplica mapping, devolve `{ customer, extra_vars }`.

### 3. Frontend

**`DashboardContractTemplates.tsx`**
- Botão "Carregar 5 modelos prontos" (visível se < 5 templates).
- Editor ganha **3ª coluna "Bitrix"** com `BitrixFieldMapper`:
  - Detecta placeholders no `body_html` via regex `{{(\w+)}}`
  - Para cada um: dois Selects (Entidade + Campo) populados via React Query
  - Indicador "X de Y mapeados"
- Botão "Pré-visualizar" abre nova aba com HTML renderizado com dados de exemplo.

**`ContractWizard.tsx`**
- Quando `prefill.bitrix_entity_type` existe e o template tem `bitrix_field_map`, mostra botão **"Buscar dados do Bitrix"** no passo 2.
- Toast: "X campos preenchidos automaticamente".

**`hooks/useContracts.ts`**
- `useBitrixEntityFields(entityType)`
- `useResolveBitrixContract()`
- `useSeedTemplates()`

### 4. Renderer
- `_shared/contract-renderer.ts` já suporta `<style>` embutido — sem mudanças.
- Cada template traz CSS próprio com `-webkit-print-color-adjust: exact` para preservar cores em PDF.

---

## Arquivos

**Editar:**
- `src/pages/DashboardContractTemplates.tsx`
- `src/components/contracts/ContractWizard.tsx`
- `src/hooks/useContracts.ts`

**Criar:**
- `supabase/migrations/<ts>_template_bitrix_field_map.sql`
- `supabase/functions/contract-templates-seed/index.ts`
- `supabase/functions/bitrix-contract-fields/index.ts`
- `supabase/functions/_shared/contract-default-templates.ts` (HTML+CSS dos 5 modelos, incluindo Delivery Real completo com Cláusula 4 expandida)
- `src/components/contracts/BitrixFieldMapper.tsx`

---

## Fora de escopo

- Sem editor WYSIWYG nesta entrega (segue textarea HTML + botão "Pré-visualizar").
- Não criamos campos UF_CRM_* automaticamente no Bitrix — o tenant mapeia para os que já existem na conta dele.
- Os placeholders do .docx (`{ContactName}`, `{CompanyUfCrm1781051230426}`, etc.) são convertidos para nossos placeholders Mustache (`{{cliente_nome}}`, `{{cliente_doc}}`); o tenant configura o mapeamento Bitrix para apontar para os UF_CRM corretos da conta dele.
