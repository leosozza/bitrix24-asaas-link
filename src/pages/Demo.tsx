import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Mail, Calendar } from "lucide-react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const benefits = [
  "Cobranças PIX, Boleto e Cartão direto do CRM",
  "Assinaturas recorrentes e split de pagamento",
  "Emissão automática de NFSe ao confirmar pagamento",
  "Robôs Bizproc para automatizar cobrança e cobrar inadimplência",
  "Aba Asaas dentro de Leads, Deals e Contatos",
  "Webhooks bidirecionais — status sempre sincronizado",
];

export default function Demo() {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    portal: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `Solicitação de demo — ${form.company || form.name}`;
    const body = [
      `Nome: ${form.name}`,
      `Empresa: ${form.company}`,
      `Email: ${form.email}`,
      `Telefone: ${form.phone}`,
      `Portal Bitrix24: ${form.portal}`,
      "",
      "Mensagem:",
      form.message,
    ].join("\n");
    window.location.href = `mailto:contato@thoth24.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Agendar demonstração — Asaas Pay by Thoth24</title>
        <meta name="description" content="Agende uma demonstração ao vivo do conector Asaas Pay by Thoth24 para Bitrix24." />
        <link rel="canonical" href="https://asaas.thoth24.com/demo" />
      </Helmet>

      <Header />

      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Demonstração ao vivo
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Veja o Asaas Pay funcionando no seu Bitrix24
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sessão de 30 minutos com um especialista Thoth24. Mostramos o setup, os recursos e tiramos suas dúvidas técnicas.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 p-8 rounded-2xl border border-border bg-card">
              <h2 className="font-display text-2xl font-bold text-foreground mb-1">Solicite sua demo</h2>
              <p className="text-sm text-muted-foreground mb-6">Preencha os campos abaixo e entraremos em contato em até 1 dia útil.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" required value={form.name} onChange={update("name")} placeholder="Seu nome" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa *</Label>
                    <Input id="company" required value={form.company} onChange={update("company")} placeholder="Nome da empresa" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" required value={form.email} onChange={update("email")} placeholder="voce@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone / WhatsApp</Label>
                    <Input id="phone" value={form.phone} onChange={update("phone")} placeholder="(11) 99999-9999" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portal">Portal Bitrix24</Label>
                  <Input id="portal" value={form.portal} onChange={update("portal")} placeholder="seudominio.bitrix24.com.br" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem (opcional)</Label>
                  <Textarea id="message" rows={4} value={form.message} onChange={update("message")} placeholder="Conte-nos o que gostaria de ver na demo." />
                </div>

                <Button type="submit" size="lg" className="w-full gradient-primary text-primary-foreground hover:opacity-90">
                  <Calendar className="w-4 h-4 mr-2" />
                  Solicitar demonstração
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Ao enviar, você concorda com nossa{" "}
                  <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>.
                </p>
              </form>
            </div>

            <aside className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-primary text-primary-foreground">
                <h3 className="font-display text-xl font-bold mb-4">O que você verá na demo</h3>
                <ul className="space-y-3">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl border border-border bg-card">
                <h3 className="font-display font-semibold text-foreground mb-2">Prefere contato direto?</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Escreva para nossa equipe comercial.
                </p>
                <a
                  href="mailto:contato@thoth24.com?subject=Demo%20Asaas%20Pay"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  contato@thoth24.com
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
