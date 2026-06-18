import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminTenant {
  id: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  bitrix_domain: string | null;
  created_at: string;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    transactions_used: number;
    trial_ends_at: string | null;
    asaas_subscription_id: string | null;
    asaas_customer_id: string | null;
    cancel_at_period_end: boolean;
    canceled_at: string | null;
    notes: string | null;
  } | null;
  plan: {
    id: string;
    name: string;
    price: number;
    transaction_limit: number;
  } | null;
  bitrix: { domain: string; status: string } | null;
}

export interface AdminPlan {
  id: string;
  name: string;
  price: number;
  transaction_limit: number;
  features: string[] | null;
  is_active: boolean;
}

async function call(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('admin-tenant-management', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const data = await call('list_tenants');
      return {
        tenants: (data.tenants || []) as AdminTenant[],
        plans: (data.plans || []) as AdminPlan[],
      };
    },
  });
}

export const adminApi = {
  changePlan: (tenant_id: string, plan_id: string) => call('change_plan', { tenant_id, plan_id }),
  extendTrial: (tenant_id: string, days: number) => call('extend_trial', { tenant_id, days }),
  cancel: (tenant_id: string, immediate: boolean) => call('cancel_subscription', { tenant_id, immediate }),
  reactivate: (tenant_id: string) => call('reactivate', { tenant_id }),
  updateNotes: (tenant_id: string, notes: string) => call('update_notes', { tenant_id, notes }),
  updatePlan: (plan_id: string, patch: Partial<AdminPlan>) => call('update_plan_details', { plan_id, ...patch }),
  createAsaasSubscription: (tenant_id: string, cpf_cnpj: string, billing_type: string) =>
    call('create_asaas_subscription', { tenant_id, cpf_cnpj, billing_type }),
  registerWebhook: () => call('register_webhook'),
};
