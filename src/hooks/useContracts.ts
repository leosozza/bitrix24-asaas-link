import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BitrixFieldRef = { entity: "deal" | "lead" | "contact" | "company"; field: string };
export type BitrixFieldMap = Record<string, BitrixFieldRef>;

export interface ContractTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  body_html: string;
  variables: unknown;
  is_default: boolean;
  cover_style: string | null;
  bitrix_field_map: BitrixFieldMap;
  created_at: string;
  updated_at: string;
}

export interface BitrixField {
  id: string;
  label: string;
  type: string;
  is_custom: boolean;
}

export interface Contract {
  id: string;
  template_id: string | null;
  asaas_subscription_id: string | null;
  bitrix_entity_type: string | null;
  bitrix_entity_id: string | null;
  customer_name: string;
  customer_doc: string | null;
  customer_email: string | null;
  total_value: number;
  payment_schedule: Array<{ n: number; tipo: string; vencimento: string; valor: number; metodo: string }>;
  public_token: string;
  status: "draft" | "sent" | "viewed" | "signed" | "canceled";
  signed_at: string | null;
  signature_name: string | null;
  created_at: string;
}

export function useContractTemplates() {
  return useQuery({
    queryKey: ["contract_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContractTemplate[];
    },
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id,template_id,asaas_subscription_id,bitrix_entity_type,bitrix_entity_id,customer_name,customer_doc,customer_email,total_value,payment_schedule,public_token,status,signed_at,signature_name,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Contract[];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ContractTemplate> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const payload: Record<string, unknown> = {
        tenant_id: u.user.id,
        name: input.name || "Novo template",
        description: input.description ?? null,
        body_html: input.body_html || "",
        is_default: !!input.is_default,
        bitrix_field_map: input.bitrix_field_map ?? {},
      };
      if (input.cover_style !== undefined) payload.cover_style = input.cover_style;
      if (input.id) {
        const { error } = await supabase.from("contract_templates").update(payload).eq("id", input.id);
        if (error) throw error;
        return input.id;
      } else {
        const { data, error } = await supabase.from("contract_templates").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract_templates"] }),
  });
}

export function useSeedDefaultTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("contract-templates-seed", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; inserted: number; message?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract_templates"] }),
  });
}

export function useBitrixEntityFields(entityType: "deal" | "lead" | "contact" | "company" | null) {
  return useQuery({
    queryKey: ["bitrix_entity_fields", entityType],
    enabled: !!entityType,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("bitrix-contract-fields", {
        body: { action: "list_fields", entity_type: entityType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data.fields || []) as BitrixField[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useResolveBitrixContract() {
  return useMutation({
    mutationFn: async (input: { template_id: string; entity_type: string; entity_id: string }) => {
      const { data, error } = await supabase.functions.invoke("bitrix-contract-fields", {
        body: { action: "resolve", ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; customer: Record<string, string>; extra_vars: Record<string, string>; mapped_count: number };
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract_templates"] }),
  });
}

export function useGenerateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("contract-generate", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { contract_id: string; public_url: string; pdf_url: string; public_token: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}
