import { 
  CreditCard, 
  RefreshCw, 
  Bell, 
  Zap, 
  Users, 
  BarChart3,
  FileText,
  Building2
} from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Múltiplos Métodos de Pagamento",
    description: "PIX, boleto bancário e cartão de crédito integrados diretamente no seu Bitrix24.",
  },
  {
    icon: RefreshCw,
    title: "Assinaturas Recorrentes",
    description: "Crie planos de assinatura e gerencie cobranças recorrentes automaticamente.",
  },
  {
    icon: Bell,
    title: "Notificações em Tempo Real",
    description: "Receba alertas de pagamento confirmado, vencido ou cancelado direto no CRM.",
  },
  {
    icon: Zap,
    title: "Automações Inteligentes",
    description: "Crie cobranças automáticas quando um deal mudar de status ou for fechado.",
  },
  {
    icon: Users,
    title: "Sincronização de Contatos",
    description: "Clientes do Asaas sincronizados com Contatos e Empresas do Bitrix24.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Financeiro",
    description: "Visualize métricas de pagamento, inadimplência e receita dentro do Bitrix24.",
  },
  {
    icon: FileText,
    title: "Integração com Faturas",
    description: "Gere cobranças a partir de Invoices do Bitrix24 com um clique.",
  },
  {
    icon: Building2,
    title: "Multi-empresa",
    description: "Gerencie múltiplas contas Asaas em uma única instalação do Bitrix24.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Recursos
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Tudo que você precisa para automatizar pagamentos
          </h2>
          <p className="text-lg text-muted-foreground">
            Uma integração completa que elimina trabalho manual e acelera seu fluxo de vendas.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            E muito mais recursos sendo adicionados constantemente
          </p>
          <a href="#pricing" className="text-primary hover:underline font-medium">
            Ver todos os planos →
          </a>
        </div>
      </div>
    </section>
  );
}
