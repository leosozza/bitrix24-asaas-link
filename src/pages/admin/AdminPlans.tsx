import { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { useAdminTenants, adminApi, AdminPlan } from '@/hooks/useAdminTenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function PlanEditor({ plan }: { plan: AdminPlan }) {
  const qc = useQueryClient();
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [limit, setLimit] = useState(String(plan.transaction_limit));
  const [features, setFeatures] = useState((plan.features || []).join('\n'));
  const [active, setActive] = useState(plan.is_active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(plan.name); setPrice(String(plan.price));
    setLimit(String(plan.transaction_limit));
    setFeatures((plan.features || []).join('\n'));
    setActive(plan.is_active);
  }, [plan]);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updatePlan(plan.id, {
        name,
        price: Number(price),
        transaction_limit: Number(limit),
        features: features.split('\n').map(s => s.trim()).filter(Boolean),
        is_active: active,
      });
      toast.success(`Plano "${name}" salvo`);
      await qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{plan.name}</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={setActive} />
          <span className="text-muted-foreground">{active ? 'Ativo' : 'Inativo'}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Preço (R$/mês)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Limite de transações/mês</Label>
            <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Features (uma por linha)</Label>
          <Textarea rows={6} value={features} onChange={(e) => setFeatures(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminPlans() {
  const { data, isLoading } = useAdminTenants();
  return (
    <AdminLayout title="Planos" description="Editar preço, limites e features dos planos Assas Pay by Thoth">
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(data?.plans || []).map(p => <PlanEditor key={p.id} plan={p} />)}
        </div>
      )}
    </AdminLayout>
  );
}
