import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

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
    <section id="pricing" className="py-20 md:py-32 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Planos
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Escolha o plano ideal para seu negócio
          </h2>
          <p className="text-lg text-muted-foreground">
            Comece grátis por 14 dias. Sem cartão de crédito.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? "bg-card border-primary shadow-xl shadow-primary/10 scale-105"
                  : "bg-card border-border hover:border-primary/50 hover:shadow-lg"
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-sm font-medium">
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
                  <span className="text-4xl font-display font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                className={`w-full h-12 ${
                  plan.popular
                    ? "gradient-primary text-primary-foreground hover:opacity-90"
                    : ""
                }`}
                variant={plan.popular ? "default" : "outline"}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            Todos os planos incluem atualizações automáticas e sem taxa de setup.
            <br />
            Precisa de mais? <a href="#" className="text-primary hover:underline">Entre em contato</a> para um plano customizado.
          </p>
        </div>
      </div>
    </section>
  );
}
