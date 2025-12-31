import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout, StatusBadge } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Plus, FileText, ExternalLink, RefreshCw } from 'lucide-react';

interface Invoice {
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

export default function DashboardInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [formValue, setFormValue] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formObservations, setFormObservations] = useState('');

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Erro ao carregar notas fiscais');
    } finally {
      setIsLoading(false);
    }
  };

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
      if (data.error) throw new Error(data.error);
      
      toast.success('Nota fiscal criada com sucesso!');
      setDialogOpen(false);
      setFormValue('');
      setFormDescription('');
      setFormObservations('');
      fetchInvoices();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar nota fiscal');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAuthorize = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-invoice-process', {
        body: {
          action: 'authorize',
          tenant_id: user?.id,
          invoice_id: invoiceId,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast.success('Nota fiscal autorizada!');
      fetchInvoices();
    } catch (error) {
      console.error('Error authorizing invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao autorizar nota fiscal');
    }
  };

  const handleCancel = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-invoice-process', {
        body: {
          action: 'cancel',
          tenant_id: user?.id,
          invoice_id: invoiceId,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast.success('Nota fiscal cancelada');
      fetchInvoices();
    } catch (error) {
      console.error('Error canceling invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao cancelar nota fiscal');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      scheduled: { variant: 'secondary', label: 'Agendada' },
      synchronized: { variant: 'outline', label: 'Sincronizada' },
      authorized: { variant: 'default', label: 'Autorizada' },
      canceled: { variant: 'destructive', label: 'Cancelada' },
      error: { variant: 'destructive', label: 'Erro' },
    };
    
    const config = statusConfig[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <>
      <Helmet>
        <title>Notas Fiscais | ConnectPay</title>
      </Helmet>

      <DashboardLayout title="Notas Fiscais" description="Gerencie suas notas fiscais de serviço">
        <div className="space-y-6">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchInvoices}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
            
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
                  <DialogDescription>
                    Preencha os dados para emitir uma nota fiscal avulsa
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor (R$)</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      placeholder="100.00"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição do Serviço</Label>
                    <Input
                      id="description"
                      placeholder="Ex: Consultoria em TI"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observations">Observações (opcional)</Label>
                    <Textarea
                      id="observations"
                      placeholder="Observações adicionais..."
                      value={formObservations}
                      onChange={(e) => setFormObservations(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateInvoice} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Nota Fiscal'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Invoices table */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Notas Fiscais Emitidas</CardTitle>
                  <CardDescription>{invoices.length} notas fiscais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {new Date(invoice.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {invoice.invoice_number || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {invoice.service_description}
                        </TableCell>
                        <TableCell>{formatCurrency(invoice.value)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {invoice.invoice_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(invoice.invoice_url!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {invoice.status === 'scheduled' && invoice.asaas_invoice_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAuthorize(invoice.asaas_invoice_id!)}
                              >
                                Emitir
                              </Button>
                            )}
                            {(invoice.status === 'scheduled' || invoice.status === 'synchronized') && invoice.asaas_invoice_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleCancel(invoice.asaas_invoice_id!)}
                              >
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
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
