import { AdminLayout } from './AdminLayout';
import { useAdminTenants, adminApi } from '@/hooks/useAdminTenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Sparkles, CheckCircle2, AlertCircle, XCircle, DollarSign, Webhook, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminOverview() {
  const { data, isLoading, refetch } = useAdminTenants();
  const [registering, setRegistering] = useState(false);
  const [testing, setTesting] = useState(false);

  const tenants = data?.tenants || [];
  const stats = {
    total: tenants.length,
    trial: tenants.filter(t => t.subscription?.status === 'trial').length,
    active: tenants.filter(t => t.subscription?.status === 'active').length,
    past_due: tenants.filter(t => t.subscription?.status === 'past_due').length,
    canceled: tenants.filter(t => t.subscription?.status === 'canceled' || t.subscription?.status === 'expired').length,
    mrr: tenants
      .filter(t => t.subscription?.status === 'active')
      .reduce((sum, t) => sum + (Number(t.plan?.price) || 0), 0),
  };

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    try {
      const result = await adminApi.registerWebhook();
      toast.success('Webhook registrado no Asaas Thoth24');
      console.log('Webhook registered:', result);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registrar webhook');
    } finally {
      setRegistering(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      const result = await adminApi.testWebhook() as { status: number; response: string };
      if (result.status === 200) toast.success(`Webhook OK (${result.status})`);
      else toast.error(`Falha no webhook (${result.status}): ${result.response}`);
      console.log('Webhook test:', result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao testar webhook');
    } finally {
      setTesting(false);
    }
  };

  const cards = [
    { label: 'Total Tenants', value: stats.total, icon: Users, color: 'text-foreground' },
    { label: 'Em Trial', value: stats.trial, icon: Sparkles, color: 'text-blue-500' },
    { label: 'Ativos', value: stats.active, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Inadimplentes', value: stats.past_due, icon: AlertCircle, color: 'text-amber-500' },
    { label: 'Cancelados/Expirados', value: stats.canceled, icon: XCircle, color: 'text-muted-foreground' },
    { label: 'MRR Estimado', value: formatBRL(stats.mrr), icon: DollarSign, color: 'text-primary' },
  ];

  return (
    <AdminLayout title="Visão Geral" description="Métricas dos tenants Assas Pay by Thoth">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestWebhook} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Testar webhook
          </Button>
          <Button variant="outline" size="sm" onClick={handleRegisterWebhook} disabled={registering}>
            {registering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Webhook className="w-4 h-4 mr-2" />}
            Reparar webhook Asaas
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{c.value}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}
