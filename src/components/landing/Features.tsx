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
    title: "Múltiplos Métodos",
    description: "PIX, boleto bancário e cartão de crédito integrados diretamente no seu Bitrix24.",
    color: "primary",
  },
  {
    icon: RefreshCw,
    title: "Assinaturas Recorrentes",
    description: "Crie planos de assinatura e gerencie cobranças recorrentes automaticamente.",
    color: "accent",
  },
  {
    icon: Bell,
    title: "Notificações Real-time",
    description: "Receba alertas de pagamento confirmado, vencido ou cancelado direto no CRM.",
    color: "primary",
  },
  {
    icon: Zap,
    title: "Automações Inteligentes",
    description: "Crie cobranças automáticas quando um deal mudar de status ou for fechado.",
    color: "accent",
  },
  {
    icon: Users,
    title: "Sync de Contatos",
    description: "Clientes do Asaas sincronizados com Contatos e Empresas do Bitrix24.",
    color: "primary",
  },
  {
    icon: BarChart3,
    title: "Dashboard Financeiro",
    description: "Visualize métricas de pagamento, inadimplência e receita dentro do Bitrix24.",
    color: "accent",
  },
  {
    icon: FileText,
    title: "Integração com Faturas",
    description: "Gere cobranças a partir de Invoices do Bitrix24 com um clique.",
    color: "primary",
  },
  {
    icon: Building2,
    title: "Multi-empresa",
    description: "Gerencie múltiplas contas Asaas em uma única instalação do Bitrix24.",
    color: "accent",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 bg-background relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Recursos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5">
            Tudo para automatizar seus pagamentos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uma integração completa que elimina trabalho manual e acelera seu fluxo de vendas.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300"
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative">
                <div className={`w-12 h-12 rounded-xl ${feature.color === 'accent' ? 'bg-accent/10' : 'bg-primary/10'} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color === 'accent' ? 'text-accent' : 'text-primary'}`} />
                </div>
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            E muito mais recursos sendo adicionados constantemente
          </p>
          <a href="#pricing" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors">
            Ver todos os planos
            <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
