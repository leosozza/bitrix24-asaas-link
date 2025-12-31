import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, RefreshCw } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden gradient-hero">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Zap className="w-4 h-4" />
            <span>Integração oficial para Bitrix24 Marketplace</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Conecte o{" "}
            <span className="text-gradient">Bitrix24</span>
            {" "}ao{" "}
            <span className="text-gradient-accent">Asaas</span>
            {" "}e automatize seus pagamentos
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            Cobranças automáticas via PIX, boleto e cartão. 
            Sincronização em tempo real com seu CRM. 
            Menos trabalho manual, mais vendas fechadas.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <Button size="lg" className="gradient-primary text-primary-foreground hover:opacity-90 shadow-glow px-8 h-12 text-base">
              Começar Grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base">
              Ver Demonstração
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span className="text-sm">Dados seguros</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-accent" />
              <span className="text-sm">Sync em tempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              <span className="text-sm">Setup em 5 minutos</span>
            </div>
          </div>
        </div>

        {/* Visual representation */}
        <div className="mt-16 max-w-5xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
          <div className="relative">
            {/* Main card showing integration */}
            <div className="bg-card rounded-2xl border border-border shadow-xl p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                {/* Bitrix24 */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-[#2FC6F6]/10 flex items-center justify-center">
                    <span className="font-display font-bold text-2xl text-[#2FC6F6]">B24</span>
                  </div>
                  <span className="font-medium text-foreground">Bitrix24</span>
                  <span className="text-xs text-muted-foreground">CRM & Vendas</span>
                </div>

                {/* Connection */}
                <div className="flex items-center gap-4">
                  <div className="hidden md:block w-16 h-0.5 bg-gradient-to-r from-[#2FC6F6] to-primary" />
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center animate-pulse-glow">
                    <RefreshCw className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="hidden md:block w-16 h-0.5 bg-gradient-to-r from-primary to-accent" />
                </div>

                {/* Asaas */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <span className="font-display font-bold text-2xl text-accent">A$</span>
                  </div>
                  <span className="font-medium text-foreground">Asaas</span>
                  <span className="text-xs text-muted-foreground">Pagamentos</span>
                </div>
              </div>

              {/* Features preview */}
              <div className="mt-10 pt-8 border-t border-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "PIX Instantâneo", icon: "⚡" },
                    { label: "Boleto Bancário", icon: "📄" },
                    { label: "Cartão de Crédito", icon: "💳" },
                    { label: "Assinaturas", icon: "🔄" },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-4 py-3 bg-secondary/50 rounded-lg"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
