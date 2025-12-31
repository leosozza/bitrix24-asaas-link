import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    description: "Para pequenas empresas começando a automatizar",
    price: "97",
    period: "/mês",
    features: [
      "Até 100 transações/mês",
      "1 usuário Bitrix24",
      "PIX, Boleto e Cartão",
      "Sincronização básica",
      "Suporte por email",
    ],
    cta: "Começar Agora",
    popular: false,
  },
  {
    name: "Pro",
    description: "Para empresas em crescimento",
    price: "247",
    period: "/mês",
    features: [
      "Até 500 transações/mês",
      "5 usuários Bitrix24",
      "Todos métodos de pagamento",
      "Assinaturas recorrentes",
      "Automações avançadas",
      "Webhooks customizados",
      "Suporte prioritário",
    ],
    cta: "Escolher Pro",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "Para operações de alto volume",
    price: "497",
    period: "/mês",
    features: [
      "Transações ilimitadas",
      "Usuários ilimitados",
      "Multi-empresa",
      "API dedicada",
      "Integrações customizadas",
      "SLA garantido",
      "Gerente de sucesso dedicado",
      "Onboarding personalizado",
    ],
    cta: "Falar com Vendas",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-secondary/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Planos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5">
            Escolha o plano ideal
          </h2>
          <p className="text-lg text-muted-foreground">
            Comece grátis por 14 dias. Sem cartão de crédito.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? "bg-card border-primary/50 shadow-2xl shadow-primary/10 md:scale-105 z-10"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-lg"
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-sm font-medium shadow-glow">
                    <Sparkles className="w-3.5 h-3.5" />
                    Mais Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <h3 className="text-xl font-display font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className="text-5xl font-display font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      plan.popular ? 'bg-accent/20' : 'bg-accent/10'
                    }`}>
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                className={`w-full h-12 text-base ${
                  plan.popular
                    ? "gradient-primary text-primary-foreground hover:opacity-90 shadow-md"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
                variant={plan.popular ? "default" : "secondary"}
                asChild
              >
                <Link to="/auth">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-14 text-center">
          <p className="text-muted-foreground text-sm">
            Todos os planos incluem atualizações automáticas e sem taxa de setup.
            <br />
            Precisa de mais? <a href="#" className="text-primary hover:underline font-medium">Entre em contato</a> para um plano customizado.
          </p>
        </div>
      </div>
    </section>
  );
}
