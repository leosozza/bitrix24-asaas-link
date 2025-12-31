import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from './StatusBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Transaction {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  amount: number;
  payment_method: 'pix' | 'boleto' | 'credit_card';
  status: 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded' | 'cancelled';
  due_date: string | null;
  created_at: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credit_card: 'Cartão',
};

export function TransactionTable({ transactions, isLoading }: TransactionTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-muted-foreground">Nenhuma transação encontrada</p>
        <p className="text-sm text-muted-foreground mt-1">
          As transações aparecerão aqui quando forem criadas
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Cliente</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} className="hover:bg-muted/30">
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">
                    {transaction.customer_name || 'Não informado'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.customer_email || '-'}
                  </p>
                </div>
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {formatCurrency(transaction.amount)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {paymentMethodLabels[transaction.payment_method]}
              </TableCell>
              <TableCell>
                <StatusBadge status={transaction.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {transaction.due_date
                  ? format(new Date(transaction.due_date), 'dd/MM/yyyy', { locale: ptBR })
                  : '-'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
