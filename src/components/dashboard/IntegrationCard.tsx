import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  status: 'active' | 'expired' | 'revoked' | null;
  onConfigure: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export function IntegrationCard({
  title,
  description,
  icon,
  status,
  onConfigure,
  onDisconnect,
  className,
}: IntegrationCardProps) {
  const isConnected = status === 'active';

  return (
    <Card className={cn('border-border/50', className)}>
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            {status && <StatusBadge status={status} />}
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant={isConnected ? 'outline' : 'default'}
          onClick={onConfigure}
          className="flex-1"
        >
          {isConnected ? 'Configurar' : 'Conectar'}
        </Button>
        {isConnected && onDisconnect && (
          <Button variant="ghost" onClick={onDisconnect} className="text-destructive hover:text-destructive">
            Desconectar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
