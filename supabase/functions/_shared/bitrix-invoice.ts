// Helpers for Bitrix24 SmartInvoice (entityTypeId = 31) integration.
// Uses the universal crm.item.* methods (crm.invoice.* is deprecated).

import { callBitrix } from "./bitrix-api.ts";

const SMART_INVOICE_ENTITY_TYPE_ID = 31;

export interface BitrixInvoiceCreateInput {
  endpoint: string;
  token: string;
  title: string;
  amount: number;
  dueDate?: string; // YYYY-MM-DD
  dealId?: number | string | null;
  contactId?: number | string | null;
  companyId?: number | string | null;
  asaasPaymentId?: string;
  assignedById?: number | string | null;
  stageId?: string | null;
}

/**
 * Create a SmartInvoice in Bitrix24 and return its numeric id (or null on failure).
 * Failures are logged but never thrown — invoice sync must never break the main charge flow.
 */
export async function createBitrixInvoice(input: BitrixInvoiceCreateInput): Promise<number | null> {
  try {
    const fields: Record<string, unknown> = {
      title: input.title,
      opportunity: input.amount,
      currencyId: "BRL",
    };
    if (input.dealId) fields.parentId2 = Number(input.dealId) || input.dealId;
    if (input.contactId) fields.contactId = Number(input.contactId) || input.contactId;
    if (input.companyId) fields.companyId = Number(input.companyId) || input.companyId;
    if (input.assignedById) fields.assignedById = Number(input.assignedById) || input.assignedById;
    if (input.dueDate) {
      // SmartInvoice expects ISO; YYYY-MM-DD is fine for Bitrix DateTime fields
      fields.ufCrm_SMART_INVOICE_DUE_DATE = input.dueDate;
    }
    if (input.asaasPaymentId) {
      fields.accountNumber = input.asaasPaymentId;
    }
    if (input.stageId) {
      fields.stageId = input.stageId;
    }

    const res = await callBitrix(input.endpoint, "crm.item.add", {
      entityTypeId: SMART_INVOICE_ENTITY_TYPE_ID,
      fields,
    }, input.token);

    if (res?.error) {
      console.error("[BitrixInvoice] create error:", res.error, res.error_description);
      return null;
    }
    const id = res?.result?.item?.id ?? res?.result?.id;
    return id ? Number(id) : null;
  } catch (e) {
    console.error("[BitrixInvoice] create exception:", e);
    return null;
  }
}

/** Move a SmartInvoice to a stage (typically the "Pago/Convertido" stage). */
export async function updateBitrixInvoiceStage(
  endpoint: string,
  token: string,
  invoiceId: number | string,
  stageId: string,
): Promise<boolean> {
  try {
    const res = await callBitrix(endpoint, "crm.item.update", {
      entityTypeId: SMART_INVOICE_ENTITY_TYPE_ID,
      id: invoiceId,
      fields: { stageId },
    }, token);
    if (res?.error) {
      console.error("[BitrixInvoice] update stage error:", res.error, res.error_description);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[BitrixInvoice] update stage exception:", e);
    return false;
  }
}

/** Fetch SmartInvoice stages from Bitrix. */
export async function listBitrixInvoiceStages(
  endpoint: string,
  token: string,
): Promise<Array<{ statusId: string; name: string; semantics?: string | null; sort?: number }>> {
  // Try crm.item.fields → stages live in crm.category.stage.list
  const res = await callBitrix(endpoint, "crm.category.stage.list", {
    entityTypeId: SMART_INVOICE_ENTITY_TYPE_ID,
  }, token);
  const items = res?.result?.items || res?.result || [];
  return (Array.isArray(items) ? items : []).map((s: any) => ({
    statusId: s.statusId || s.STATUS_ID || s.id,
    name: s.name || s.NAME || s.statusId,
    semantics: s.semantics ?? s.SEMANTICS ?? null,
    sort: s.sort ?? s.SORT ?? 0,
  })).filter((s: any) => s.statusId);
}
