import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded' | 'cancelled' | 'active' | 'expired' | 'revoked' | 'trial';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: {
    label: 'Pendente',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  confirmed: {
    label: 'Confirmado',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  received: {
    label: 'Recebido',
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  overdue: {
    label: 'Vencido',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  refunded: {
    label: 'Reembolsado',
    className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-muted text-muted-foreground border-border',
  },
  active: {
    label: 'Ativo',
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  expired: {
    label: 'Expirado',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  revoked: {
    label: 'Revogado',
    className: 'bg-muted text-muted-foreground border-border',
  },
  trial: {
    label: 'Trial',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
