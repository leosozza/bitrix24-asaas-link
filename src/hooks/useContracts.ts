import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  body_html: string;
  variables: unknown;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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
      const payload = {
        tenant_id: u.user.id,
        name: input.name || "Novo template",
        description: input.description ?? null,
        body_html: input.body_html || "",
        is_default: !!input.is_default,
      };
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
