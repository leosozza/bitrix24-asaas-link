import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, RefreshCw, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/3 to-transparent rounded-full" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Zap className="w-4 h-4" />
              <span>Integração oficial para Bitrix24 Marketplace</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-[1.1] mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Conecte o{" "}
              <span className="text-bitrix">Bitrix24</span>
              {" "}ao{" "}
              <span className="text-asaas">Asaas</span>
              {" "}e automatize pagamentos
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              Cobranças automáticas via PIX, boleto e cartão. 
              Sincronização em tempo real com seu CRM. 
              Menos trabalho manual, mais vendas fechadas.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Button size="lg" className="gradient-primary text-primary-foreground hover:opacity-90 shadow-glow px-8 h-13 text-base w-full sm:w-auto" asChild>
                <Link to="/auth">
                  Começar Grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-13 px-8 text-base w-full sm:w-auto">
                Ver Demonstração
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="text-sm">14 dias grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                <span className="text-sm">Dados seguros</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-accent" />
                <span className="text-sm">Sync em tempo real</span>
              </div>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <div className="relative">
              {/* Main integration card */}
              <div className="bg-card rounded-2xl border border-border shadow-xl p-8">
                {/* Integration flow */}
                <div className="flex items-center justify-between gap-4 mb-8">
                  {/* Bitrix24 */}
                  <div className="flex flex-col items-center gap-3 flex-1">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-bitrix flex items-center justify-center shadow-lg">
                      <span className="font-display font-bold text-xl md:text-2xl text-bitrix">B24</span>
                    </div>
                    <div className="text-center">
                      <span className="font-semibold text-foreground text-sm">Bitrix24</span>
                      <p className="text-xs text-muted-foreground">CRM & Vendas</p>
                    </div>
                  </div>

                  {/* Connection animation */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 md:w-12 h-0.5 bg-gradient-to-r from-[hsl(195,91%,57%)] to-primary rounded" />
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full gradient-primary flex items-center justify-center animate-pulse-glow">
                        <RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                      </div>
                      <div className="w-8 md:w-12 h-0.5 bg-gradient-to-r from-primary to-[hsl(155,100%,33%)] rounded" />
                    </div>
                    <span className="text-xs text-muted-foreground">Sincronização</span>
                  </div>

                  {/* Asaas */}
                  <div className="flex flex-col items-center gap-3 flex-1">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-asaas flex items-center justify-center shadow-lg">
                      <span className="font-display font-bold text-xl md:text-2xl text-asaas">A$</span>
                    </div>
                    <div className="text-center">
                      <span className="font-semibold text-foreground text-sm">Asaas</span>
                      <p className="text-xs text-muted-foreground">Pagamentos</p>
                    </div>
                  </div>
                </div>

                {/* Payment methods */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "PIX", icon: "⚡", color: "text-accent" },
                    { label: "Boleto", icon: "📄", color: "text-primary" },
                    { label: "Cartão", icon: "💳", color: "text-primary" },
                    { label: "Recorrente", icon: "🔄", color: "text-accent" },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2.5 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs md:text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating stats cards */}
              <div className="absolute -top-4 -right-4 bg-card rounded-xl border border-border shadow-lg p-3 animate-float hidden md:block">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pagamento</p>
                    <p className="text-sm font-semibold text-accent">Confirmado</p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-card rounded-xl border border-border shadow-lg p-3 animate-float-delayed hidden md:block">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Setup</p>
                    <p className="text-sm font-semibold text-foreground">5 minutos</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats section */}
        <div className="mt-20 pt-12 border-t border-border animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "500+", label: "Empresas ativas" },
              { value: "R$ 10M+", label: "Transações processadas" },
              { value: "99.9%", label: "Uptime garantido" },
              { value: "4.9★", label: "Avaliação no Marketplace" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
