import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  price: number;
  transaction_limit: number;
  features: string[] | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPlanId?: string | null;
  onCheckoutComplete?: () => void;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskDoc(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function PlanCheckoutModal({ open, onOpenChange, initialPlanId, onCheckoutComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planId, setPlanId] = useState<string | null>(initialPlanId || null);
  const [doc, setDoc] = useState('');
  const [phone, setPhone] = useState('');
  const [billingType, setBillingType] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ invoice_url: string | null; plan_name: string } | null>(null);

  const selectedPlan = useMemo(() => plans.find(p => p.id === planId) || null, [plans, planId]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setResult(null);
    setLoadingPlans(true);
    (async () => {
      const { data: prof } = await supabase.auth.getUser();
      if (prof.user) {
        const { data: p } = await supabase.from('profiles').select('phone, cpf_cnpj').eq('id', prof.user.id).maybeSingle();
        if (p?.cpf_cnpj) setDoc(maskDoc(p.cpf_cnpj));
        if (p?.phone) setPhone(maskPhone(p.phone));
      }
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) toast.error('Erro ao carregar planos');
      setPlans((data || []) as Plan[]);
      if (initialPlanId) setPlanId(initialPlanId);
      setLoadingPlans(false);
    })();
  }, [open, initialPlanId]);

  const canNextFromStep1 = !!planId;
  const canNextFromStep2 = doc.replace(/\D/g, '').length === 11 || doc.replace(/\D/g, '').length === 14;

  const submit = async () => {
    if (!planId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('subscription-checkout', {
        body: {
          action: 'create_checkout',
          plan_id: planId,
          cpf_cnpj: doc.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
          billing_type: billingType,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ invoice_url: data.invoice_url, plan_name: data.plan_name });
      setStep(4);
      if (data.invoice_url) {
        window.open(data.invoice_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar cobrança');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contratar plano ConnectPay</DialogTitle>
          <DialogDescription>
            {step < 4 ? `Passo ${step} de 3` : 'Pagamento gerado'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            {loadingPlans ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {plans.map((p) => {
                  const isPro = p.name.toLowerCase() === 'pro';
                  const active = planId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`text-left p-4 rounded-xl border transition-all ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{p.name}</span>
                        {isPro && <Sparkles className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="text-2xl font-bold mb-2">{formatBRL(Number(p.price))}<span className="text-xs text-muted-foreground font-normal">/mês</span></div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {(p.features || []).slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc">CPF ou CNPJ *</Label>
              <Input id="doc" value={doc} onChange={(e) => setDoc(maskDoc(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
            </div>
            {selectedPlan && (
              <div className="p-3 rounded-lg bg-muted/40 text-sm">
                Plano <b>{selectedPlan.name}</b> — {formatBRL(Number(selectedPlan.price))}/mês
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Label>Forma de pagamento</Label>
            <RadioGroup value={billingType} onValueChange={(v) => setBillingType(v as 'PIX' | 'CREDIT_CARD')}>
              <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${billingType === 'PIX' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <RadioGroupItem value="PIX" />
                <div className="flex-1">
                  <div className="font-medium">PIX</div>
                  <div className="text-xs text-muted-foreground">Recomendado · Pagamento imediato</div>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${billingType === 'CREDIT_CARD' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <RadioGroupItem value="CREDIT_CARD" />
                <div className="flex-1">
                  <div className="font-medium">Cartão de crédito</div>
                  <div className="text-xs text-muted-foreground">Cobrança recorrente automática</div>
                </div>
              </label>
            </RadioGroup>
            {selectedPlan && (
              <div className="p-3 rounded-lg bg-muted/40 text-sm">
                Você será redirecionado para o Asaas para concluir o pagamento de <b>{formatBRL(Number(selectedPlan.price))}</b>.
              </div>
            )}
          </div>
        )}

        {step === 4 && result && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Assinatura criada!</h3>
              <p className="text-sm text-muted-foreground">
                Plano <b>{result.plan_name}</b>. Conclua o pagamento na página do Asaas para ativar.
              </p>
            </div>
            {result.invoice_url && (
              <Button asChild className="w-full">
                <a href={result.invoice_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir fatura no Asaas
                </a>
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Após o pagamento, sua assinatura será ativada automaticamente.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 4 ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={submitting}>
                  Voltar
                </Button>
              )}
              {step < 3 && (
                <Button
                  onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                  disabled={(step === 1 && !canNextFromStep1) || (step === 2 && !canNextFromStep2)}
                >
                  Continuar
                </Button>
              )}
              {step === 3 && (
                <Button onClick={submit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar e pagar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
