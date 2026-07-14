import { useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { PlanCheckoutModal } from '@/components/checkout/PlanCheckoutModal';

export function SubscriptionBanner() {
  const access = useSubscriptionAccess();
  const [open, setOpen] = useState(false);

  if (access.loading || !access.hasAccess) return null;

  const showTrial = access.status === 'trial' && (access.daysUntilTrialEnd ?? 99) <= 5;
  const showPastDue = access.status === 'past_due';

  if (!showTrial && !showPastDue) return null;

  const isDanger = showPastDue;

  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b ${
          isDanger
            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
        }`}
      >
        {isDanger ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
        <span className="flex-1">
          {showPastDue
            ? 'Sua fatura está em aberto. Regularize agora para não perder o acesso ao conector.'
            : `Seu teste gratuito termina em ${access.daysUntilTrialEnd} dia${
                (access.daysUntilTrialEnd ?? 0) === 1 ? '' : 's'
              }. Contrate o plano para não interromper o uso.`}
        </span>
        <Button size="sm" variant={isDanger ? 'destructive' : 'default'} onClick={() => setOpen(true)}>
          Contratar agora
        </Button>
      </div>
      <PlanCheckoutModal open={open} onOpenChange={setOpen} initialPlanId={access.subscription?.plan_id ?? null} />
    </>
  );
}
