import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { SubscriptionRequiredScreen } from './SubscriptionRequiredScreen';

interface Props {
  children: ReactNode;
  /** When true, renders children even when there's no active subscription (billing/settings pages). */
  allowWithoutSubscription?: boolean;
}

export function SubscriptionGate({ children, allowWithoutSubscription }: Props) {
  const access = useSubscriptionAccess();
  const { isSuperAdmin, loading: roleLoading } = useIsSuperAdmin();

  if (access.loading || roleLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSuperAdmin || access.hasAccess || allowWithoutSubscription) {
    return <>{children}</>;
  }

  return <SubscriptionRequiredScreen access={access} />;
}
