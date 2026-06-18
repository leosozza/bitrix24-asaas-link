## Objetivo

Reescrever a aba **Asaas** dentro de Deals/Leads/SPAs do Bitrix24 (`bitrix-crm-detail-tab`) com **4 abas internas** (Cobranças, Assinaturas, NFSe, Split) + um novo módulo **"Planejamento de Contrato"** estilo BomControle: entrada parcelada + recorrência (semanal/quinzenal/mensal) com cálculo automático de parcelas e datas, criando tudo no Asaas e sincronizando com campos personalizados do Bitrix.

## Layout

```
┌─ Métricas [Cobrado | Recebido | Em Aberto | Qtd] ────┐
├─ [Cobranças] [Planejamento] [Assinaturas] [NFSe] [Split] ─┤
│                                                          │
│  conteúdo da aba ativa                                   │
└──────────────────────────────────────────────────────────┘
```

Navegação por abas em vanilla JS (sem reload).

## Módulo "Planejamento de Contrato" (núcleo da mudança)

Formulário no topo da aba Planejamento, com **todos os campos obrigatórios marcados com asterisco e validados antes do envio**:

**Bloco 1 — Cliente** (auto-preenchido do Contato/Empresa do Deal, editável):
- Nome *, Email *, CPF/CNPJ *, Telefone

**Bloco 2 — Contrato**:
- Data de início do contrato *
- Data de fim do contrato *
- Observação das parcelas
- Forma de pagamento * (PIX / Boleto / Cartão)

**Bloco 3 — Entrada parcelada** (opcional):
- Valor da entrada (R$) — ex. 3000
- Número de parcelas da entrada (lista 1–12) — ex. 3
- Primeiro vencimento da entrada *
- Mostra preview: "3 parcelas de R$ 1.000,00"
- Tabela editável das parcelas (cada linha: nº, vencimento, valor) com botão "✏️ Editar" e "✖ Remover" igual à imagem

**Bloco 4 — Recorrência (saldo)**:
- Valor total do contrato * (ou "saldo a parcelar")
- Ciclo * (lista: **Semanal** [padrão] / Quinzenal / Mensal)
- Dia da semana (se semanal/quinzenal — ex. Quarta) ou dia do mês (se mensal)
- Calculado automaticamente a partir de Data início / Data fim / Ciclo:
  - Quantidade de cobranças
  - Valor de cada cobrança = saldo / qtd (último ajuste de centavos)
  - Primeira data = próxima ocorrência do dia escolhido a partir de Data início

**Tabela de pré-visualização** (estilo BomControle, da imagem):
| Parcela | Forma | Vencimento | Faturamento | Total | ✖ | ✏️ |

Permite editar valor/data de cada linha antes de enviar.

**Botão "Enviar ao Asaas"** — cria no Asaas:
- Cobranças da entrada → `POST /payments` (uma por parcela)
- Recorrência → `POST /subscriptions` com `nextDueDate`, `cycle` (WEEKLY/BIWEEKLY/MONTHLY), `endDate`, `value`
- Cada cobrança/assinatura gera registro em `transactions` / `subscriptions` com `bitrix_entity_*`

## Sincronização com Bitrix (Campos personalizados + Timeline)

**Auto-criação de campos personalizados** (UF_CRM_*) no Deal na primeira vez que o tenant abre a aba:
- `UF_CRM_ASAAS_CONTRACT_START` (date) — Data início contrato
- `UF_CRM_ASAAS_CONTRACT_END` (date) — Data fim contrato
- `UF_CRM_ASAAS_ENTRY_VALUE` (double) — Valor da entrada
- `UF_CRM_ASAAS_ENTRY_INSTALLMENTS` (enum 1–12) — Nº parcelas entrada
- `UF_CRM_ASAAS_RECURRING_VALUE` (double) — Valor da recorrência
- `UF_CRM_ASAAS_CYCLE` (enum WEEKLY/BIWEEKLY/MONTHLY) — Ciclo
- `UF_CRM_ASAAS_WEEKDAY` (enum SEG..DOM)
- `UF_CRM_ASAAS_PAYMENT_METHOD` (enum PIX/BOLETO/CREDIT_CARD)

Criados via `crm.deal.userfield.add` (idempotente: checa antes com `crm.deal.userfield.list`). Flag em `bitrix_installations.custom_fields_created` para não repetir.

**Bidirecionalidade**:
- Ao abrir a aba, edge function chama `crm.deal.get` e pré-popula o formulário com os valores desses campos se já existirem.
- Ao enviar com sucesso, chama `crm.deal.update` gravando os campos com os valores submetidos.

**Timeline do negócio**:
- Sucesso: `crm.timeline.comment.add` com texto "✅ Planejamento Asaas enviado: entrada R$ X em N parcelas + recorrência semanal de R$ Y até DD/MM/AAAA. IDs: …"
- Erro: `crm.timeline.comment.add` com "❌ Falha no envio Asaas: <lista de erros do Asaas>"
- Atividade configurável com badge `asaas_contract_planned` no card do Deal.

## Abas adicionais (mantém escopo já confirmado)

- **Cobranças**: tabela + modal Nova Cobrança (valor, método, vencimento, descrição, juros, multa, desconto). Ações por linha: copiar link, reenviar (`notify`), alterar vencimento (`PUT`), cancelar (`DELETE`), reembolsar (`refund`), emitir NFSe.
- **Assinaturas**: lista de `subscriptions` filtradas por `bitrix_entity_*` + criação manual (ciclo/valor/dia). Ações: pausar, cancelar, ver cobranças geradas.
- **NFSe**: lista de `invoices`, botão emitir por cobrança confirmada, baixar PDF, cancelar. Reusa `asaas-invoice-process`.
- **Split**: visualizar/editar `split_configurations` aplicáveis ao Deal.

Auto-preenchimento de cliente (Contato/Empresa) via `crm.deal.contact.items.get` + `crm.contact.get` (Lead usa `crm.lead.get`), injetado como `window.defaultCustomer`.

## Actions no edge function (`bitrix-crm-detail-tab`)

Adicionar handlers JSON:
- `get_crm_customer`, `get_deal_fields` — leitura inicial
- `ensure_custom_fields` — cria UF_CRM_ASAAS_*
- `submit_contract_plan` — orquestra criação de cobranças+assinatura, atualiza Deal, comenta timeline
- `create_charge`, `cancel_charge`, `refund_charge`, `update_due_date`, `resend_notification`
- `create_subscription`, `cancel_subscription`, `list_subscription_payments`
- `issue_invoice`, `cancel_invoice` (proxy para `asaas-invoice-process`)
- `save_split`, `list_splits`

Helpers internos: `findOrCreateAsaasCustomer`, `calculateInstallments(start,end,cycle,weekday)`, `addTimelineComment`, `createConfigurableActivity` (já existe, estender badgeCodes).

## Schema DB

Verificar e (se faltar) adicionar via migração:
- `subscriptions.bitrix_entity_type`, `subscriptions.bitrix_entity_id` (provável que já existam — confirmar antes)
- `bitrix_installations.custom_fields_created boolean default false`
- Nova tabela `contract_plans` (opcional para histórico): tenant_id, bitrix_entity_type, bitrix_entity_id, start_date, end_date, entry_value, entry_installments, recurring_value, cycle, weekday, payment_method, asaas_subscription_id, status. RLS por tenant + grants padrão.

Migração executada antes da reescrita do edge function.

## Deploy

Redesplegar apenas `bitrix-crm-detail-tab` ao final (mais migração se aplicável).

## Fora de escopo

- Mudanças no dashboard React (admin/cliente).
- Webhook Thoth24 (já feito).
- Fluxos de automação / robots.
