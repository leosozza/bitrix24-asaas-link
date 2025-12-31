import { Helmet } from 'react-helmet-async';
import { DashboardLayout, StatsCard, TransactionTable, IntegrationCard } from '@/components/dashboard';
import { Receipt, TrendingUp, CheckCircle, AlertCircle, Plug, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

// Mock data - será substituído por dados reais do Supabase
const mockStats = {
  totalTransactions: 127,
  totalAmount: 45678.90,
  successRate: 94.5,
  pendingCount: 8,
};

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
];

export default function Dashboard() {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | ConnectPay</title>
      </Helmet>

      <DashboardLayout title="Visão Geral" description="Acompanhe suas métricas e transações">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatsCard
            title="Transações do Mês"
            value={mockStats.totalTransactions}
            icon={<Receipt className="h-5 w-5" />}
            trend={{ value: 12, isPositive: true }}
            description="vs. mês anterior"
          />
          <StatsCard
            title="Valor Total"
            value={formatCurrency(mockStats.totalAmount)}
            icon={<TrendingUp className="h-5 w-5" />}
            trend={{ value: 8.5, isPositive: true }}
            description="vs. mês anterior"
          />
          <StatsCard
            title="Taxa de Sucesso"
            value={`${mockStats.successRate}%`}
            icon={<CheckCircle className="h-5 w-5" />}
            description="pagamentos confirmados"
          />
          <StatsCard
            title="Pendentes"
            value={mockStats.pendingCount}
            icon={<AlertCircle className="h-5 w-5" />}
            description="aguardando pagamento"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Transactions */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transações Recentes</CardTitle>
                <CardDescription>Últimas transações processadas</CardDescription>
              </div>
              <button
                onClick={() => navigate('/dashboard/transactions')}
                className="text-sm text-primary hover:underline"
              >
                Ver todas
              </button>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={mockTransactions} />
            </CardContent>
          </Card>

          {/* Integrations Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Status das Integrações</h3>
            <IntegrationCard
              title="Bitrix24"
              description="CRM e automações"
              icon={<Plug className="h-6 w-6" />}
              status={null}
              onConfigure={() => navigate('/dashboard/integrations')}
            />
            <IntegrationCard
              title="Asaas"
              description="Cobranças e pagamentos"
              icon={<CreditCard className="h-6 w-6" />}
              status={null}
              onConfigure={() => navigate('/dashboard/integrations')}
            />
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
