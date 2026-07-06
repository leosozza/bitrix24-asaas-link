import { useMemo, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { useAdminTenants, adminApi, AdminTenant, AdminPlan } from '@/hooks/useAdminTenants';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MoreHorizontal, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusBadge(status?: string) {
  const map: Record<string, { label: string; cls: string }> = {
    trial: { label: 'Trial', cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    past_due: { label: 'Inadimplente', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    canceled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
    expired: { label: 'Expirado', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
  };
  const s = status ? map[status] : null;
  if (!s) return <Badge variant="outline">—</Badge>;
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

export default function AdminTenants() {
  const { data, isLoading, refetch } = useAdminTenants();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const [selected, setSelected] = useState<AdminTenant | null>(null);
  const [dialog, setDialog] = useState<'plan' | 'trial' | 'cancel' | 'notes' | 'dates' | null>(null);
  const [busy, setBusy] = useState(false);

  // dialog state
  const [planChoice, setPlanChoice] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [notes, setNotes] = useState('');
  const [cancelMode, setCancelMode] = useState<'period_end' | 'immediate'>('period_end');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [dateTrialEnd, setDateTrialEnd] = useState('');

  const filtered = useMemo(() => {
    const list = data?.tenants || [];
    return list.filter(t => {
      if (statusFilter !== 'all' && t.subscription?.status !== statusFilter) return false;
      if (planFilter !== 'all' && t.plan?.id !== planFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.company_name || ''} ${t.email || ''} ${t.bitrix_domain || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, planFilter]);

  const open = (t: AdminTenant, kind: 'plan' | 'trial' | 'cancel' | 'notes' | 'dates') => {
    setSelected(t);
    setDialog(kind);
    setPlanChoice(t.plan?.id || '');
    setTrialDays('14');
    setNotes(t.subscription?.notes || '');
    setCancelMode('period_end');
    setDateStart(t.subscription?.current_period_start?.slice(0, 10) || '');
    setDateEnd(t.subscription?.current_period_end?.slice(0, 10) || '');
    setDateTrialEnd(t.subscription?.trial_ends_at?.slice(0, 10) || '');
  };

  const closeDialog = () => { setDialog(null); setSelected(null); };

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      await qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      closeDialog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Tenants" description="Gerenciar contas, planos e cobrança">
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Input
          placeholder="Buscar por empresa, email, domínio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="past_due">Inadimplente</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos planos</SelectItem>
            {(data?.plans || []).map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trial até</TableHead>
              <TableHead>Próx. venc.</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum tenant encontrado</TableCell></TableRow>
            )}
            {filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.company_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                  {t.bitrix_domain && <div className="text-xs text-muted-foreground">{t.bitrix_domain}</div>}
                </TableCell>
                <TableCell>{t.plan?.name || '—'}</TableCell>
                <TableCell>{statusBadge(t.subscription?.status)}</TableCell>
                <TableCell className="text-xs">{t.subscription?.trial_ends_at ? new Date(t.subscription.trial_ends_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell className="text-xs">{t.subscription?.current_period_end ? new Date(t.subscription.current_period_end).toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell className="text-xs">
                  {t.subscription?.transactions_used ?? 0} / {t.plan?.transaction_limit ?? '∞'}
                </TableCell>
                <TableCell className="text-xs">{t.subscription?.status === 'active' ? formatBRL(Number(t.plan?.price) || 0) : '—'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => open(t, 'plan')}>Trocar plano</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(t, 'trial')}>Estender trial</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(t, 'dates')}>Editar datas</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => open(t, 'notes')}>Editar notas</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(t.subscription?.status === 'canceled' || t.subscription?.status === 'expired') ? (
                        <DropdownMenuItem onClick={() => run(() => adminApi.reactivate(t.id), 'Reativado')}>Reativar</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem className="text-destructive" onClick={() => open(t, 'cancel')}>Cancelar</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Change plan */}
      <Dialog open={dialog === 'plan'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar plano</DialogTitle>
            <DialogDescription>{selected?.company_name} — atual: {selected?.plan?.name || '—'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo plano</Label>
            <Select value={planChoice} onValueChange={setPlanChoice}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(data?.plans || []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {formatBRL(Number(p.price))}/mês</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Cancelar</Button>
            <Button disabled={!planChoice || busy} onClick={() => selected && run(() => adminApi.changePlan(selected.id, planChoice), 'Plano alterado')}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend trial */}
      <Dialog open={dialog === 'trial'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estender trial</DialogTitle>
            <DialogDescription>{selected?.company_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Dias adicionais</Label>
            <Input type="number" min="1" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Cancelar</Button>
            <Button disabled={busy} onClick={() => selected && run(() => adminApi.extendTrial(selected.id, Number(trialDays)), `+${trialDays} dias`)}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Estender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={dialog === 'cancel'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar assinatura</DialogTitle>
            <DialogDescription>{selected?.company_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={cancelMode} onValueChange={(v: 'period_end' | 'immediate') => setCancelMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="period_end">Cancelar ao fim do período</SelectItem>
                <SelectItem value="immediate">Cancelar imediatamente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Voltar</Button>
            <Button variant="destructive" disabled={busy} onClick={() => selected && run(() => adminApi.cancel(selected.id, cancelMode === 'immediate'), 'Cancelado')}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes */}
      <Dialog open={dialog === 'notes'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas internas</DialogTitle>
            <DialogDescription>{selected?.company_name}</DialogDescription>
          </DialogHeader>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Anotações internas sobre esse tenant…" />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Cancelar</Button>
            <Button disabled={busy} onClick={() => selected && run(() => adminApi.updateNotes(selected.id, notes), 'Notas salvas')}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dates */}
      <Dialog open={dialog === 'dates'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar datas de pagamento</DialogTitle>
            <DialogDescription>{selected?.company_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Início do período atual</Label>
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Próximo vencimento (fim do período)</Label>
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do trial (opcional)</Label>
              <Input type="date" value={dateTrialEnd} onChange={(e) => setDateTrialEnd(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe em branco para remover o trial.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Cancelar</Button>
            <Button disabled={busy} onClick={() => selected && run(() => adminApi.updateDates(selected.id, {
              current_period_start: dateStart || null,
              current_period_end: dateEnd || null,
              trial_ends_at: dateTrialEnd || null,
            }), 'Datas atualizadas')}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
