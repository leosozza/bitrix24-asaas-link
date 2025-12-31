import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw, Percent, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SplitConfiguration {
  id: string;
  name: string;
  wallet_id: string;
  wallet_name: string | null;
  split_type: 'fixed' | 'percentage';
  split_value: number;
  is_active: boolean;
  created_at: string;
}

export default function DashboardSplits() {
  const { user } = useAuth();
  const [splits, setSplits] = useState<SplitConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    wallet_id: '',
    wallet_name: '',
    split_type: 'percentage' as 'fixed' | 'percentage',
    split_value: '',
  });

  const fetchSplits = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('split_configurations')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSplits(data || []);
    } catch (error) {
      console.error('Error fetching splits:', error);
      toast.error('Erro ao carregar configurações de split');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSplits();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('split_configurations').insert({
        tenant_id: user.id,
        name: formData.name,
        wallet_id: formData.wallet_id,
        wallet_name: formData.wallet_name || null,
        split_type: formData.split_type,
        split_value: parseFloat(formData.split_value),
      });
      
      if (error) throw error;
      
      toast.success('Split configurado com sucesso');
      setIsDialogOpen(false);
      setFormData({ name: '', wallet_id: '', wallet_name: '', split_type: 'percentage', split_value: '' });
      fetchSplits();
    } catch (error) {
      console.error('Error creating split:', error);
      toast.error('Erro ao criar configuração de split');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSplitActive = async (splitId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('split_configurations')
        .update({ is_active: !isActive })
        .eq('id', splitId);
      
      if (error) throw error;
      
      setSplits(splits.map(s => s.id === splitId ? { ...s, is_active: !isActive } : s));
      toast.success(isActive ? 'Split desativado' : 'Split ativado');
    } catch (error) {
      console.error('Error toggling split:', error);
      toast.error('Erro ao atualizar split');
    }
  };

  const deleteSplit = async (splitId: string) => {
    try {
      const { error } = await supabase
        .from('split_configurations')
        .delete()
        .eq('id', splitId);
      
      if (error) throw error;
      
      setSplits(splits.filter(s => s.id !== splitId));
      toast.success('Split removido com sucesso');
    } catch (error) {
      console.error('Error deleting split:', error);
      toast.error('Erro ao remover split');
    }
  };

  const formatValue = (split: SplitConfiguration) => {
    if (split.split_type === 'percentage') {
      return `${split.split_value}%`;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(split.split_value);
  };

  return (
    <DashboardLayout title="Split de Pagamento" description="Configure a divisão automática de valores entre carteiras">
      <Helmet>
        <title>Split de Pagamento | ConnectPay</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Split de Pagamento</h1>
            <p className="text-muted-foreground">Configure a divisão automática de valores entre carteiras</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Split
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Configurar Novo Split</DialogTitle>
                  <DialogDescription>
                    Configure uma regra de divisão de pagamento para uma carteira Asaas
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome da Configuração</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Comissão Parceiro"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="wallet_id">Wallet ID (Asaas)</Label>
                    <Input
                      id="wallet_id"
                      placeholder="Ex: 7a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p"
                      value={formData.wallet_id}
                      onChange={(e) => setFormData({ ...formData, wallet_id: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="wallet_name">Nome do Recebedor (opcional)</Label>
                    <Input
                      id="wallet_name"
                      placeholder="Ex: Empresa Parceira LTDA"
                      value={formData.wallet_name}
                      onChange={(e) => setFormData({ ...formData, wallet_name: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="split_type">Tipo de Split</Label>
                      <Select
                        value={formData.split_type}
                        onValueChange={(value: 'fixed' | 'percentage') => setFormData({ ...formData, split_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentual (%)</SelectItem>
                          <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="split_value">
                        {formData.split_type === 'percentage' ? 'Percentual' : 'Valor'}
                      </Label>
                      <Input
                        id="split_value"
                        type="number"
                        step={formData.split_type === 'percentage' ? '0.1' : '0.01'}
                        min="0"
                        max={formData.split_type === 'percentage' ? '100' : undefined}
                        placeholder={formData.split_type === 'percentage' ? '10' : '5.00'}
                        value={formData.split_value}
                        onChange={(e) => setFormData({ ...formData, split_value: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar Split'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configurações de Split</CardTitle>
                <CardDescription>
                  Splits ativos serão aplicados automaticamente a todas as cobranças
                </CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={fetchSplits}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando configurações...
              </div>
            ) : splits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma configuração de split cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Recebedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splits.map((split) => (
                    <TableRow key={split.id}>
                      <TableCell className="font-medium">{split.name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{split.wallet_name || 'Não informado'}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {split.wallet_id.substring(0, 12)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {split.split_type === 'percentage' ? (
                            <>
                              <Percent className="w-3 h-3" />
                              Percentual
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-3 h-3" />
                              Fixo
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatValue(split)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={split.is_active}
                          onCheckedChange={() => toggleSplitActive(split.id, split.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteSplit(split.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como funciona o Split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">Split Percentual</span>
                </div>
                <p>Uma porcentagem do valor total é transferida para a carteira configurada.</p>
                <p className="mt-2 text-xs">Exemplo: 10% de R$100 = R$10 para o parceiro</p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">Split Fixo</span>
                </div>
                <p>Um valor fixo é transferido independente do valor total da cobrança.</p>
                <p className="mt-2 text-xs">Exemplo: R$5 fixo por transação</p>
              </div>
            </div>
            
            <p className="text-xs">
              <strong>Nota:</strong> Os splits são processados automaticamente pelo Asaas no momento do pagamento.
              O valor é transferido diretamente para as carteiras configuradas.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
