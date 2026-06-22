// Helpers for Bitrix24 SmartInvoice (entityTypeId = 31) integration.
// Uses the universal crm.item.* methods (crm.invoice.* is deprecated).

import { callBitrix } from "./bitrix-api.ts";

const SMART_INVOICE_ENTITY_TYPE_ID = 31;

export interface BitrixInvoiceCreateInput {
  endpoint: string;
  token: string;
  title: string;
  amount: number;
  dueDate?: string;
  dealId?: number | string | null;
  contactId?: number | string | null;
  companyId?: number | string | null;
  asaasPaymentId?: string;
  assignedById?: number | string | null;
  stageId?: string | null;
}

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
    if (input.dueDate) fields.ufCrm_SMART_INVOICE_DUE_DATE = input.dueDate;
    if (input.asaasPaymentId) fields.accountNumber = input.asaasPaymentId;
    if (input.stageId) fields.stageId = input.stageId;

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

export interface InvoiceStage {
  statusId: string;
  name: string;
  semantics: string | null;
  sort: number;
  categoryId?: number | string | null;
}

function normalizeStage(s: any): InvoiceStage | null {
  const statusId = s?.statusId || s?.STATUS_ID || s?.id || s?.ID;
  if (!statusId) return null;
  return {
    statusId: String(statusId),
    name: s?.name || s?.NAME || String(statusId),
    semantics: s?.semantics ?? s?.SEMANTICS ?? null,
    sort: Number(s?.sort ?? s?.SORT ?? 0) || 0,
    categoryId: s?.categoryId ?? s?.CATEGORY_ID ?? null,
  };
}

function dedupe(stages: InvoiceStage[]): InvoiceStage[] {
  const seen = new Set<string>();
  const out: InvoiceStage[] = [];
  for (const s of stages) {
    if (seen.has(s.statusId)) continue;
    seen.add(s.statusId);
    out.push(s);
  }
  return out.sort((a, b) => a.sort - b.sort);
}

/** Fetch SmartInvoice stages from Bitrix using multiple strategies. */
export async function listBitrixInvoiceStages(
  endpoint: string,
  token: string,
): Promise<InvoiceStage[]> {
  const collected: InvoiceStage[] = [];

  // Strategy 1: crm.category.stage.list with entityTypeId
  try {
    const res = await callBitrix(endpoint, "crm.category.stage.list", {
      entityTypeId: SMART_INVOICE_ENTITY_TYPE_ID,
    }, token);
    if (res?.error) {
      console.warn("[BitrixInvoice] strategy1 error:", res.error, res.error_description);
    } else {
      const items = res?.result?.items || res?.result || [];
      const arr = Array.isArray(items) ? items : [];
      console.log("[BitrixInvoice] strategy1 (crm.category.stage.list) returned", arr.length);
      for (const s of arr) {
        const n = normalizeStage(s);
        if (n) collected.push(n);
      }
    }
  } catch (e) {
    console.error("[BitrixInvoice] strategy1 exception:", e);
  }

  if (collected.length > 0) return dedupe(collected);

  // Strategy 2: list categories then iterate stages per category
  let categoryIds: Array<number | string> = [0];
  try {
    const catRes = await callBitrix(endpoint, "crm.category.list", {
      entityTypeId: SMART_INVOICE_ENTITY_TYPE_ID,
    }, token);
    const cats = catRes?.result?.categories || catRes?.result || [];
    if (Array.isArray(cats) && cats.length > 0) {
      categoryIds = cats.map((c: any) => c?.id ?? c?.ID ?? 0);
      console.log("[BitrixInvoice] strategy2 found categories:", categoryIds);
    } else {
      console.log("[BitrixInvoice] strategy2 no categories, defaulting to [0]");
    }
  } catch (e) {
    console.warn("[BitrixInvoice] strategy2 category.list exception:", e);
  }

  // Strategy 3: crm.status.list per category (legacy)
  for (const catId of categoryIds) {
    const entityIds = [
      `DYNAMIC_${SMART_INVOICE_ENTITY_TYPE_ID}_STAGE_${catId}`,
      `SMART_INVOICE_STAGE_${catId}`,
    ];
    for (const entityId of entityIds) {
      try {
        const res = await callBitrix(endpoint, "crm.status.list", {
          filter: { ENTITY_ID: entityId },
        }, token);
        if (res?.error) {
          console.warn(`[BitrixInvoice] strategy3 ${entityId} error:`, res.error_description);
          continue;
        }
        const arr = res?.result || [];
        const items = Array.isArray(arr) ? arr : [];
        if (items.length > 0) {
          console.log(`[BitrixInvoice] strategy3 ${entityId} returned`, items.length);
          for (const s of items) {
            const n = normalizeStage(s);
            if (n) collected.push({ ...n, categoryId: catId });
          }
          break; // found stages for this category
        }
      } catch (e) {
        console.error(`[BitrixInvoice] strategy3 ${entityId} exception:`, e);
      }
    }
  }

  const result = dedupe(collected);
  console.log("[BitrixInvoice] total stages resolved:", result.length);
  return result;
}
