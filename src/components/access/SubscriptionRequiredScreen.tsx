import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanCheckoutModal } from '@/components/checkout/PlanCheckoutModal';
import type { SubscriptionAccess } from '@/hooks/useSubscriptionAccess';

const REASON_COPY: Record<NonNullable<SubscriptionAccess['reason']>, { title: string; description: string }> = {
  suspended: {
    title: 'Seu acesso foi suspenso',
    description: 'Para retomar o uso do Asaas Pay by Thoth24 é necessário contratar o plano e concluir o pagamento.',
  },
  past_due: {
    title: 'Fatura em aberto',
    description: 'Sua última fatura ainda não foi paga. Regularize o pagamento para continuar usando o conector.',
  },
  canceled: {
    title: 'Assinatura cancelada',
    description: 'Sua assinatura foi encerrada. Contrate novamente para reativar o acesso.',
  },
  expired: {
    title: 'Assinatura expirada',
    description: 'O período atual venceu. Contrate para continuar usando o Asaas Pay by Thoth24.',
  },
  trial_expired: {
    title: 'Período de teste encerrado',
    description: 'Seu teste gratuito terminou. Contrate o plano para continuar usando o Asaas Pay by Thoth24.',
  },
  no_subscription: {
    title: 'Contratação necessária',
    description: 'Você ainda não possui uma assinatura ativa. Contrate um plano para começar a usar.',
  },
  ok: { title: '', description: '' },
};

const FEATURES = [
  'Transações ilimitadas por mês',
  'PIX, Boleto e Cartão de crédito',
  'Assinaturas recorrentes automáticas',
  'Split de pagamento entre carteiras',
  'Emissão automática de NFSe',
  'Todas as telas nativas dentro do Bitrix24',
  'Robôs de automação Bizproc',
  'Webhooks e API completa',
  'Suporte prioritário Thoth24',
];

interface Props {
  access: SubscriptionAccess;
}

export function SubscriptionRequiredScreen({ access }: Props) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const reason = access.reason && access.reason !== 'ok' ? access.reason : 'no_subscription';
  const copy = REASON_COPY[reason];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="relative rounded-2xl border border-border bg-card/60 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00A868] via-[#2FC6F6] to-[#00A868]" />

          <div className="p-8 md:p-10 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                {reason === 'past_due' ? <AlertTriangle className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
                  Acesso bloqueado
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{copy.title}</h1>
                <p className="text-muted-foreground mt-2">{copy.description}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Plano Pro</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-foreground">R$ 249</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground max-w-[180px]">
                  Assinatura mensal cancelável a qualquer momento
                </div>
              </div>

              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#00A868] mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1 bg-[#00A868] hover:bg-[#00A868]/90 text-white"
                onClick={() => setCheckoutOpen(true)}
              >
                Contratar agora
              </Button>
              {access.subscription?.invoice_url && (
                <Button asChild size="lg" variant="outline" className="flex-1">
                  <a href={access.subscription.invoice_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> Ver fatura em aberto
                  </a>
                </Button>
              )}
            </div>

            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
              Precisa de ajuda?{' '}
              <a href="mailto:contato@thoth24.com" className="text-primary hover:underline">
                contato@thoth24.com
              </a>
            </div>
          </div>
        </div>
      </div>

      <PlanCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        initialPlanId={access.subscription?.plan_id ?? null}
      />
    </div>
  );
}
