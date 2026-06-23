import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, FileText, ExternalLink, RefreshCw, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Charge {
  id: string;
  asaas_id: string;
  amount: number;
  payment_method: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  due_date: string | null;
  payment_url: string | null;
  bitrix_invoice_id: number | null;
  created_at: string;
}

interface NfseInvoice {
  id: string;
  asaas_invoice_id: string | null;
  customer_name: string | null;
  value: number;
  service_description: string;
  status: string;
  invoice_number: string | null;
  invoice_url: string | null;
  effective_date: string | null;
  created_at: string;
}

const methodLabel: Record<string, string> = {
  pix: 'PIX', boleto: 'Boleto', credit_card: 'Cartão',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '-';

export default function DashboardInvoices() {
  const { user } = useAuth();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [nfse, setNfse] = useState<NfseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState('pending');

  const [formValue, setFormValue] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formObservations, setFormObservations] = useState('');

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [{ data: tx, error: txErr }, { data: inv, error: invErr }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, asaas_id, amount, payment_method, status, customer_name, customer_email, due_date, payment_url, bitrix_invoice_id, created_at')
          .eq('tenant_id', user!.id)
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', user!.id)
          .order('created_at', { ascending: false }),
      ]);
      if (txErr) throw txErr;
      if (invErr) throw invErr;
      setCharges((tx || []) as any);
      setNfse((inv || []) as any);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao carregar faturas');
    } finally {
      setIsLoading(false);
    }
  };

  const { pending, overdue, received } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pending: Charge[] = [];
    const overdue: Charge[] = [];
    const received: Charge[] = [];
    for (const c of charges) {
      const isPaid = ['confirmed', 'received'].includes(c.status);
      if (isPaid) { received.push(c); continue; }
      if (['cancelled', 'refunded'].includes(c.status)) continue;
      const due = c.due_date ? new Date(c.due_date) : null;
      if (due && due < today) overdue.push(c);
      else pending.push(c);
    }
    return { pending, overdue, received };
  }, [charges]);

  const handleCreateInvoice = async () => {
    if (!formValue || !formDescription) {
      toast.error('Valor e descrição são obrigatórios');
      return;
    }
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-invoice-process', {
        body: {
          action: 'create',
          tenant_id: user?.id,
          value: parseFloat(formValue),
          service_description: formDescription,
          observations: formObservations,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Nota fiscal criada com sucesso!');
      setDialogOpen(false);
      setFormValue(''); setFormDescription(''); setFormObservations('');
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar nota fiscal');
    } finally {
      setIsCreating(false);
    }
  };

  const handleNfseAction = async (action: 'authorize' | 'cancel', invoiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-invoice-process', {
        body: { action, tenant_id: user?.id, invoice_id: invoiceId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === 'authorize' ? 'Nota fiscal autorizada!' : 'Nota fiscal cancelada');
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    }
  };

  const ChargeTable = ({ rows, kind }: { rows: Charge[]; kind: 'pending' | 'overdue' | 'received' }) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (rows.length === 0) {
      const empty: Record<typeof kind, string> = {
        pending: 'Nenhuma fatura a receber',
        overdue: 'Nenhuma fatura em atraso',
        received: 'Nenhuma fatura recebida ainda',
      };
      return <div className="text-center py-10 text-muted-foreground">{empty[kind]}</div>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="max-w-[220px] truncate">
                <div className="font-medium">{c.customer_name || '—'}</div>
                <div className="text-xs text-muted-foreground">{c.customer_email || ''}</div>
              </TableCell>
              <TableCell>{methodLabel[c.payment_method] || c.payment_method}</TableCell>
              <TableCell>{formatDate(c.due_date)}</TableCell>
              <TableCell>{formatCurrency(Number(c.amount))}</TableCell>
              <TableCell>
                {kind === 'pending' && <Badge variant="secondary">A Receber</Badge>}
                {kind === 'overdue' && <Badge variant="destructive">Em Atraso</Badge>}
                {kind === 'received' && <Badge className="bg-emerald-500 hover:bg-emerald-500">Recebida</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {c.bitrix_invoice_id && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Fatura #{c.bitrix_invoice_id}
                    </Badge>
                  )}
                  {c.payment_url && (
                    <Button variant="ghost" size="sm" onClick={() => window.open(c.payment_url!, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
      <Helmet>
        <title>Faturas | Asaas Pay by Thoth24</title>
      </Helmet>

      <DashboardLayout title="Faturas" description="Acompanhe suas faturas a receber, em atraso e recebidas">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Nota Fiscal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Emitir Nota Fiscal</DialogTitle>
                  <DialogDescription>Preencha os dados para emitir uma nota fiscal avulsa</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor (R$)</Label>
                    <Input id="value" type="number" step="0.01" placeholder="100.00"
                      value={formValue} onChange={(e) => setFormValue(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição do Serviço</Label>
                    <Input id="description" placeholder="Ex: Consultoria em TI"
                      value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observations">Observações (opcional)</Label>
                    <Textarea id="observations" placeholder="Observações adicionais..."
                      value={formObservations} onChange={(e) => setFormObservations(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateInvoice} disabled={isCreating}>
                    {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Nota Fiscal'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Faturas</CardTitle>
                  <CardDescription>
                    {pending.length} a receber · {overdue.length} em atraso · {received.length} recebidas
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="pending" className="gap-2">
                    <Clock className="h-4 w-4" /> A Receber
                    <Badge variant="secondary" className="ml-1">{pending.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="gap-2">
                    <AlertTriangle className="h-4 w-4" /> Em Atraso
                    <Badge variant="destructive" className="ml-1">{overdue.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="received" className="gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Recebidas
                    <Badge variant="outline" className="ml-1">{received.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="nfse" className="gap-2">
                    <FileText className="h-4 w-4" /> Notas Fiscais
                    <Badge variant="outline" className="ml-1">{nfse.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4">
                  <ChargeTable rows={pending} kind="pending" />
                </TabsContent>
                <TabsContent value="overdue" className="mt-4">
                  <ChargeTable rows={overdue} kind="overdue" />
                </TabsContent>
                <TabsContent value="received" className="mt-4">
                  <ChargeTable rows={received} kind="received" />
                </TabsContent>

                <TabsContent value="nfse" className="mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : nfse.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      Nenhuma nota fiscal emitida ainda
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nfse.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell>{formatDate(i.created_at)}</TableCell>
                            <TableCell>{i.invoice_number || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{i.service_description}</TableCell>
                            <TableCell>{formatCurrency(Number(i.value))}</TableCell>
                            <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {i.invoice_url && (
                                  <Button variant="ghost" size="sm" onClick={() => window.open(i.invoice_url!, '_blank')}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                {i.status === 'scheduled' && i.asaas_invoice_id && (
                                  <Button variant="outline" size="sm" onClick={() => handleNfseAction('authorize', i.asaas_invoice_id!)}>
                                    Emitir
                                  </Button>
                                )}
                                {(i.status === 'scheduled' || i.status === 'synchronized') && i.asaas_invoice_id && (
                                  <Button variant="ghost" size="sm" className="text-destructive"
                                    onClick={() => handleNfseAction('cancel', i.asaas_invoice_id!)}>
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
