import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, BookOpen, Clock, Building2 } from "lucide-react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

const faq = [
  {
    q: "Como instalo o Asaas Pay no meu Bitrix24?",
    a: "Pelo Marketplace do Bitrix24, busque por 'Asaas Pay by Thoth24' e clique em Instalar. Após a instalação, abra o app dentro do portal e informe sua chave de API do Asaas — pronto, o app registra automaticamente o pay system, os robôs e a aba CRM.",
  },
  {
    q: "Onde consigo minha chave de API do Asaas?",
    a: "No painel do Asaas, vá em Integrações → Chave de API. Use a chave de Produção ou Sandbox conforme o ambiente que deseja conectar.",
  },
  {
    q: "Quais formas de pagamento são suportadas?",
    a: "PIX, Boleto, Cartão de Crédito (à vista e parcelado), assinaturas recorrentes e split de pagamento entre múltiplas carteiras Asaas.",
  },
  {
    q: "O app emite Nota Fiscal de Serviço (NFSe)?",
    a: "Sim. Após configurar o serviço municipal e o ISS no painel, a NFSe é emitida automaticamente quando a cobrança é confirmada.",
  },
];

export default function Suporte() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Suporte — Asaas Pay by Thoth24</title>
        <meta name="description" content="Central de suporte do conector Asaas Pay by Thoth24 para Bitrix24. Contato, FAQ e SLA de atendimento." />
        <link rel="canonical" href="https://asaas.thoth24.com/suporte" />
      </Helmet>

      <Header />

      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Central de suporte
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Como podemos ajudar?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Nossa equipe responde em até 24 horas em dias úteis. Escolha o canal mais conveniente.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <a
              href="mailto:contato@thoth24.com"
              className="group p-6 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-1">Email</h3>
              <p className="text-sm text-muted-foreground mb-3">Para dúvidas técnicas, financeiras e parcerias.</p>
              <span className="text-sm font-medium text-primary">contato@thoth24.com</span>
            </a>

            <a
              href="https://wa.me/5511978659280"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-1">WhatsApp</h3>
              <p className="text-sm text-muted-foreground mb-3">Atendimento rápido em horário comercial.</p>
              <span className="text-sm font-medium text-primary">(11) 97865-9280</span>
            </a>

            <div className="p-6 rounded-2xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-1">Documentos</h3>
              <p className="text-sm text-muted-foreground mb-3">Termos legais e política de privacidade.</p>
              <div className="flex flex-col gap-1 text-sm">
                <Link to="/eula" className="text-primary hover:underline">EULA →</Link>
                <Link to="/privacidade" className="text-primary hover:underline">Privacidade →</Link>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <div className="p-6 rounded-2xl border border-border bg-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">SLA de atendimento</h3>
                <p className="text-sm text-muted-foreground">Resposta em até <strong className="text-foreground">24 horas úteis</strong> (segunda a sexta, 9h às 18h). Incidentes críticos têm prioridade.</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">Empresa</h3>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Thoth24</strong><br />
                  CNPJ 54.727.112/0001-78<br />
                  São Paulo, Brasil
                </p>
              </div>
            </div>
          </div>

          <section>
            <h2 className="font-display text-3xl font-bold text-foreground mb-8 text-center">Perguntas frequentes</h2>
            <div className="space-y-4 max-w-3xl mx-auto">
              {faq.map((item) => (
                <div key={item.q} className="p-6 rounded-xl border border-border bg-card">
                  <h3 className="font-display font-semibold text-foreground mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
