// Shared helpers for creating Asaas customers, charges and subscriptions linked to contracts.

export type AsaasEnv = "production" | "sandbox";

export function asaasBase(env: string): string {
  return env === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

function digits(s: string | null | undefined): string {
  return (s || "").replace(/\D+/g, "");
}

export interface AsaasCustomerPayload {
  name?: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

async function asaasFetch(env: string, apiKey: string, path: string, init?: RequestInit) {
  const r = await fetch(`${asaasBase(env)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init?.headers || {}),
    },
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!r.ok) {
    const msg = body?.errors?.[0]?.description || body?.message || `Asaas HTTP ${r.status}`;
    throw new Error(`[Asaas] ${msg}`);
  }
  return body;
}

/** Find a customer by cpfCnpj, or create one. Returns the asaas customer id. */
export async function ensureAsaasCustomer(env: string, apiKey: string, payload: AsaasCustomerPayload): Promise<string> {
  const cpfCnpj = digits(payload.cpfCnpj);
  if (!cpfCnpj) throw new Error("cpfCnpj é obrigatório para criar cliente no Asaas");

  // Search first
  const search = await asaasFetch(env, apiKey, `/customers?cpfCnpj=${cpfCnpj}&limit=1`);
  const existing = search?.data?.[0];
  if (existing?.id) {
    // Best-effort patch with newer data
    try {
      await asaasFetch(env, apiKey, `/customers/${existing.id}`, {
        method: "POST",
        body: JSON.stringify({ ...payload, cpfCnpj }),
      });
    } catch (_) { /* non-fatal */ }
    return existing.id;
  }

  const created = await asaasFetch(env, apiKey, `/customers`, {
    method: "POST",
    body: JSON.stringify({ ...payload, cpfCnpj }),
  });
  return created.id;
}

export interface CreateChargeInput {
  customerId: string;
  value: number;
  billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
}

export async function createAsaasCharge(env: string, apiKey: string, input: CreateChargeInput) {
  const payload: Record<string, unknown> = {
    customer: input.customerId,
    billingType: input.billingType,
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
  };
  if (input.installmentCount && input.installmentCount > 1) {
    payload.installmentCount = input.installmentCount;
    payload.installmentValue = input.installmentValue ?? input.value;
    delete payload.value;
  }
  return await asaasFetch(env, apiKey, `/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface CreateSubscriptionInput {
  customerId: string;
  value: number;
  nextDueDate: string;
  billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  cycle?: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
  description?: string;
  externalReference?: string;
  endDate?: string;
  maxPayments?: number;
}

export async function createAsaasSubscription(env: string, apiKey: string, input: CreateSubscriptionInput) {
  const payload: Record<string, unknown> = {
    customer: input.customerId,
    billingType: input.billingType,
    value: input.value,
    nextDueDate: input.nextDueDate,
    cycle: input.cycle || "MONTHLY",
    description: input.description,
    externalReference: input.externalReference,
  };
  if (input.endDate) payload.endDate = input.endDate;
  if (input.maxPayments) payload.maxPayments = input.maxPayments;
  return await asaasFetch(env, apiKey, `/subscriptions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAsaasPayment(env: string, apiKey: string, paymentId: string) {
  return await asaasFetch(env, apiKey, `/payments/${paymentId}`);
}
