import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout, TransactionTable } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, Download } from 'lucide-react';

// Mock data - será substituído por dados reais do Supabase
const mockTransactions = [
  {
    id: '1',
    customer_name: 'João Silva',
    customer_email: 'joao@email.com',
    amount: 1500.00,
    payment_method: 'pix' as const,
    status: 'received' as const,
    due_date: '2024-01-15',
    created_at: '2024-01-10T10:30:00Z',
  },
  {
    id: '2',
    customer_name: 'Maria Santos',
    customer_email: 'maria@email.com',
    amount: 2350.00,
    payment_method: 'boleto' as const,
    status: 'pending' as const,
    due_date: '2024-01-20',
    created_at: '2024-01-12T14:15:00Z',
  },
  {
    id: '3',
    customer_name: 'Carlos Oliveira',
    customer_email: 'carlos@email.com',
    amount: 890.00,
    payment_method: 'credit_card' as const,
    status: 'confirmed' as const,
    due_date: '2024-01-18',
    created_at: '2024-01-14T09:45:00Z',
  },
  {
    id: '4',
    customer_name: 'Ana Paula',
    customer_email: 'ana@email.com',
    amount: 4200.00,
    payment_method: 'boleto' as const,
    status: 'overdue' as const,
    due_date: '2024-01-05',
    created_at: '2024-01-02T11:00:00Z',
  },
  {
    id: '5',
    customer_name: 'Pedro Henrique',
    customer_email: 'pedro@email.com',
    amount: 750.00,
    payment_method: 'pix' as const,
    status: 'received' as const,
    due_date: '2024-01-16',
    created_at: '2024-01-15T08:20:00Z',
  },
];

export default function DashboardTransactions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const filteredTransactions = mockTransactions.filter((transaction) => {
    const matchesSearch =
      searchQuery === '' ||
      transaction.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.customer_email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || transaction.payment_method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  return (
    <>
      <Helmet>
        <title>Transações | ConnectPay</title>
      </Helmet>

      <DashboardLayout title="Transações" description="Gerencie todas as suas transações">
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Histórico de Transações</CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transação(ões) encontrada(s)
                </CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="received">Recebido</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os métodos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="credit_card">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <TransactionTable transactions={filteredTransactions} />
          </CardContent>
        </Card>
      </DashboardLayout>
    </>
  );
}
