## Diagnóstico

O card "Integração com Faturas do Bitrix24" **já existe no código-fonte** de `supabase/functions/bitrix-payment-iframe/index.ts` (linhas 4096–4115), mas **não está presente na versão publicada** da Edge Function.

Verificação feita agora:

```text
URL: …/functions/v1/bitrix-payment-iframe?...&PLACEMENT=DEFAULT
- "Configuração Fiscal"            → 6 ocorrências ✔ (código antigo presente)
- "Integração com Faturas"         → 0 ocorrências ✘ (código novo ausente)
- "cfg-sync-invoices" / "invoiceSync" → 0 ocorrências ✘
```

Ou seja: o deploy da última alteração da função `bitrix-payment-iframe` não foi efetivado. Por isso, mesmo abrindo a aba Configurações dentro do Bitrix24, o card não aparece — o navegador está recebendo o HTML antigo gerado pela função antiga.

A migração no banco já está aplicada (colunas `sync_bitrix_invoices`, `bitrix_invoice_pending_stage_id`, `bitrix_invoice_overdue_stage_id`, `bitrix_invoice_paid_stage_id` existem em `asaas_configurations`).

## O que vou fazer

1. **Forçar o redeploy** da Edge Function `bitrix-payment-iframe` (toque sem mudança lógica — um comentário/whitespace para disparar o pipeline de deploy automático).
2. **Validar o deploy** fazendo `curl` no endpoint da função e confirmando que o HTML servido contém:
   - `"Integração com Faturas do Bitrix24"`
   - `id="cfg-sync-invoices"`
   - `function toggleInvoiceSyncCard`
3. Se o deploy continuar não pegando, investigar erros de build da função (sintaxe / import) e corrigir.

## O que o usuário precisa fazer

Depois do redeploy confirmado:

- Dentro do Bitrix24, abrir o app Asaas e dar um **refresh forte** no iframe (Ctrl+Shift+R / Cmd+Shift+R) — o Bitrix mantém cache agressivo do HTML do iframe e pode continuar mostrando a versão antiga até o reload.
- O novo card "Integração com Faturas do Bitrix24" aparecerá entre "Configuração Fiscal" e "Split de Pagamento" na aba **Configurações**, com:
  - Toggle "Criar Fatura no Bitrix24 para cada cobrança"
  - 3 selects (A Receber / Em Atraso / Recebidas) para mapear as etapas do pipeline de SmartInvoice do Bitrix
  - Botão "Salvar integração de Faturas"

## Escopo

Apenas Edge Function `bitrix-payment-iframe`. Nada de frontend React (você confirmou que todos usam exclusivamente dentro do Bitrix24, então o painel externo `DashboardSettings` não é tocado nesta passada).
