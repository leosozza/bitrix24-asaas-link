## Problem

The three dropdowns ("A Receber", "Em Atraso", "Recebidas") in the new Bitrix24 invoice integration card stay empty — `listBitrixInvoiceStages()` returns nothing.

Root cause: `crm.category.stage.list` for SmartInvoice (entityTypeId=31) either needs explicit category iteration or returns a different shape than what the helper currently parses. There is also no logging, so we can't see what Bitrix actually returns.

## Fix

### 1. Make `supabase/functions/_shared/bitrix-invoice.ts → listBitrixInvoiceStages` robust

Try multiple Bitrix endpoints in order until one returns stages:

1. `crm.category.stage.list` with `entityTypeId: 31` (current behavior, fixed parsing).
2. If empty: list categories via `crm.category.list { entityTypeId: 31 }`, then call `crm.category.stage.list` for each `categoryId` and merge.
3. If still empty: fall back to `crm.status.list { filter: { ENTITY_ID: "DYNAMIC_31_STAGE_<categoryId>" } }` per category (legacy shape: `STATUS_ID`, `NAME`, `SEMANTICS`).

Normalize every result to `{ statusId, name, semantics, sort, categoryId }` and drop duplicates by `statusId`. Add `console.log` lines tagged `[BitrixInvoice]` for each attempt + the count returned, so the edge-function logs reveal which path produced data.

### 2. Surface errors to the UI

In `supabase/functions/bitrix-payment-iframe/index.ts → case 'get_invoice_stages'`:

- Return `{ success: true, stages, debug }` where `debug` includes the strategy used and last Bitrix error (if any). Keep `success: true` even when empty so the toast message can be specific: "Nenhum estágio de Fatura encontrado no Bitrix" instead of a generic error.
- In the client `ensureInvoiceStagesLoaded`, when `stages.length === 0` show a clear toast and render a `<option disabled>` placeholder explaining the issue, so the user sees feedback instead of an empty select.

### 3. No DB or schema changes

Only the two files above are touched. No migrations.

## Files

- `supabase/functions/_shared/bitrix-invoice.ts` — rewrite `listBitrixInvoiceStages` with fallbacks + logging.
- `supabase/functions/bitrix-payment-iframe/index.ts` — enrich `get_invoice_stages` response and the front-end toast/placeholder when stages are empty.

## Validation

After deploy:
1. Hit the function via curl with a real `memberId` and confirm `stages.length > 0` and that logs show which strategy succeeded.
2. Reload the iframe (Ctrl+Shift+R) in Bitrix24 → open Configurações → confirm dropdowns are populated and the ✓ marker appears on stages whose `semantics` matches P/F/S.
3. Select one stage per dropdown, click "Salvar integração de Faturas", reload and confirm the values persist.
