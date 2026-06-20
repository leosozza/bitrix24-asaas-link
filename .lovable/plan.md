
# Sistema de Contratos ConnectPay + Robot Bizproc

Geração de contratos com templates múltiplos, PDF, link público, assinatura digital simples, **robot de automação Bitrix** e **campos customizados na entidade CRM** atualizados automaticamente.

## 1. Banco de dados

**`contract_templates`** — tenant_id, name, body_html (com placeholders `{{cliente_nome}}`, `{{parcelas_tabela}}`, etc.), variables jsonb, is_default. RLS por tenant.

**`contracts`** — tenant_id, template_id, asaas_subscription_id?, asaas_customer_id?, bitrix_entity_type/id?, dados do cliente, total_value, contract_term, payment_schedule jsonb `[{n,tipo,vencimento,valor,metodo}]`, rendered_html, pdf_storage_path, public_token (uuid), status (`draft|sent|viewed|signed|canceled`), signed_at, signed_ip, signed_user_agent, signature_hash, signature_name. RLS por tenant.

**Storage bucket** `contracts` (privado) com signed URLs para PDFs.

## 2. Edge Functions

**`contract-generate`** (auth) — recebe template+cliente+schedule (ou puxa do Asaas via `/subscriptions/{id}/payments`), renderiza HTML, gera PDF server-side com `npm:@react-pdf/renderer`, salva no bucket, retorna `{contract_id, public_url, pdf_signed_url}`. Se vier de Bitrix (entity_type/id), também grava nos campos CRM (ver §5).

**`contract-public`** (no auth) — GET `?token=` registra `viewed_at` e renderiza HTML público. POST `action=sign` registra IP/UA/timestamp, gera SHA256, regenera PDF com bloco "Assinado por X em DD/MM HH:MM • IP", status=`signed`, e **dispara update dos campos Bitrix** (campo "Contrato Assinado" → Sim).

**`bitrix-contract-robot`** (no auth, recebe POST do bizproc) — payload Bitrix bizproc padrão (event_token, document_id, properties: template_id, billing_type, valor, parcelas etc.), chama `contract-generate` internamente, responde imediato 200 OK e usa `bizproc.event.send` para retornar resultado (link + pdf) ao workflow após geração.

## 3. Robot Bizproc + Campos CRM (Bitrix)

**Robot** "ConnectPay: Gerar Contrato" — registrado via `bizproc.robot.add` (lazy registration, padrão masterguide):
- **Parâmetros:** template (lista), tipo_pagamento (PIX/Boleto/Cartão), valor_total, qtd_parcelas, dia_vencimento, enviar_email (S/N), enviar_whatsapp (S/N)
- **Retorno:** `contract_url` (string), `contract_pdf_url` (string), `contract_id` (string)
- **Handler URL:** `contract-bizproc-robot`
- **USE_SUBSCRIPTION:** Y (workflow espera resposta async)

**Campos customizados** criados via `userfieldconfig.add` / `crm.deal.userfield.add` na instalação (lazy, idempotente) — tanto em Deal quanto em Lead:
- `UF_CRM_CONTRATO_PDF` (file)
- `UF_CRM_CONTRATO_LINK` (string)
- `UF_CRM_CONTRATO_ASSINADO` (enum Sim/Não, default Não)
- `UF_CRM_CONTRATO_ID` (string, oculto)

**Auto-criação** na função `bitrix-install` + endpoint manual de reparo em `bitrix-iframe-management-hub` ("Recriar campos de contrato").

**Atualização automática:**
- Após `contract-generate` com entity vinculada → seta `UF_CRM_CONTRATO_PDF` (upload file via `disk.folder.uploadfile` + attach) + `UF_CRM_CONTRATO_LINK` + `UF_CRM_CONTRATO_ID` + assinado=Não, via `crm.deal.update` / `crm.lead.update`
- Após `contract-public` sign → atualiza `UF_CRM_CONTRATO_ASSINADO=Sim` + posta timeline activity "Contrato assinado por X"

## 4. Frontend Dashboard

**`/dashboard/contracts`** (sidebar item novo) — lista com filtros, botão "Novo contrato" abre wizard:
1. Template
2. Cliente (auto-fill se vier de assinatura/CRM)
3. Pagamento: toggle "Importar de assinatura Asaas" OU formulário manual (entradas N×valor + recorrentes N×valor×método) → preview tabela
4. Preview HTML
5. Gera → mostra link copiar + download PDF + botões enviar email/WhatsApp

**`/dashboard/contracts/templates`** — CRUD templates com editor (TipTap), painel lateral com placeholders disponíveis, marcar padrão.

## 5. Página pública `/contrato/:token`

Renderiza HTML estilizado (logo tenant, dados, cláusulas, **tabela de parcelas** replicando o print: header cinza, `# | TIPO | VENCIMENTO | VALOR | MÉTODO`, badges coloridos PIX/BOLETO/CARTÃO). Botão "Assinar": modal pede nome completo + checkbox "Li e aceito" → POST sign → mostra confirmação com IP/timestamp + download PDF assinado.

## 6. Integração Bitrix CRM (aba)

Adicionar botão "Gerar contrato" na aba Asaas (`bitrix-crm-detail-tab`) — abre wizard pré-preenchido com contato/empresa/deal.

## 7. Componentes compartilhados

`<PaymentScheduleTable>` usado em preview, página pública e PDF (estilo do print).

## Arquivos

**Migrations:** tables + RLS + GRANTs + bucket
**Edge functions (novas):**
- `contract-generate/index.ts`
- `contract-public/index.ts`
- `contract-bizproc-robot/index.ts`
**Edge functions (editar):**
- `bitrix-install/index.ts` — criar campos CRM + registrar robot
- `bitrix-iframe-management-hub/index.ts` (ou tool de reparo) — botão recriar campos/robot
- `bitrix-crm-detail-tab/index.ts` — botão gerar contrato
**Frontend:**
- páginas: `DashboardContracts.tsx`, `DashboardContractTemplates.tsx`, `PublicContract.tsx`
- components: `ContractWizard.tsx`, `PaymentScheduleTable.tsx`, `TemplateEditor.tsx`, `ContractStatusBadge.tsx`
- hooks: `useContracts.ts`, `useContractTemplates.ts`
- editar: `App.tsx` (rotas), `DashboardSidebar.tsx`

**Seed:** template padrão (versão genérica do Delivery Real com placeholders) inserido para tenants existentes.
