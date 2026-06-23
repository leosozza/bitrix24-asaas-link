// Shared definition for the "Asaas Pay by Thoth24: Gerar Contrato" Bizproc robot.
// Used by bitrix-contract-setup, bitrix-payment-iframe (ensure/register), etc.

export const CONTRACT_ROBOT_CODE = "asaas_contract_generate";

export function buildContractRobotParams(
  templates: Array<{ id: string; name: string }>,
  supabaseUrl: string,
) {
  const templateOptions: Record<string, string> = {};
  for (const t of templates) templateOptions[t.id] = t.name;
  if (Object.keys(templateOptions).length === 0) {
    templateOptions["__default__"] = "Template padrão";
  }

  return {
    CODE: CONTRACT_ROBOT_CODE,
    HANDLER: `${supabaseUrl}/functions/v1/bitrix-contract-robot`,
    AUTH_USER_ID: 1,
    USE_SUBSCRIPTION: "Y",
    NAME: "Asaas Pay by Thoth24: Gerar Contrato",
    PROPERTIES: {
      template_id: { Name: "Template do contrato", Type: "select", Required: "Y", Options: templateOptions },
      payment_total: { Name: "Valor total (R$)", Type: "double", Required: "Y" },
      payment_qty: { Name: "Qtd parcelas", Type: "int", Default: 1 },
      payment_method: {
        Name: "Método (PIX/BOLETO/CREDIT_CARD)",
        Type: "select",
        Options: { PIX: "PIX", BOLETO: "Boleto", CREDIT_CARD: "Cartão", UNDEFINED: "Cliente escolhe" },
        Default: "PIX",
      },
      payment_start: { Name: "Início (YYYY-MM-DD)", Type: "string" },
      payment_interval_days: { Name: "Intervalo (dias)", Type: "int", Default: 30 },
      asaas_auto_charge: { Name: "Criar cobrança Asaas automaticamente", Type: "bool", Default: "Y" },
      asaas_charge_mode: {
        Name: "Tipo de cobrança",
        Type: "select",
        Options: { unica: "Única", parcelada: "Parcelada", assinatura_mensal: "Assinatura mensal" },
        Default: "parcelada",
      },
      asaas_subscription_cycle: {
        Name: "Ciclo (assinatura)",
        Type: "select",
        Options: { MONTHLY: "Mensal", WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", YEARLY: "Anual" },
        Default: "MONTHLY",
      },
    },
    RETURN_PROPERTIES: {
      contract_url: { Name: "Link do contrato", Type: "string" },
      contract_pdf_url: { Name: "Link PDF", Type: "string" },
      contract_id: { Name: "ID do contrato", Type: "string" },
      payment_link: { Name: "Link de pagamento Asaas", Type: "string" },
      subscription_id: { Name: "ID da assinatura Asaas", Type: "string" },
    },
  };
}

export async function loadTenantContractTemplates(
  admin: any,
  tenantId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data } = await admin
    .from("contract_templates")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");
  return (data || []) as Array<{ id: string; name: string }>;
}
