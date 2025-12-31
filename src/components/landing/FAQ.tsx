import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Como funciona a integração com o Bitrix24?",
    answer: "Após instalar o app no marketplace do Bitrix24, você conecta sua conta Asaas em poucos cliques. A integração sincroniza automaticamente seus contatos, deals e faturas, permitindo criar cobranças diretamente do CRM.",
  },
  {
    question: "Preciso ter conta no Asaas?",
    answer: "Sim, você precisa ter uma conta ativa no Asaas para usar a integração. Se ainda não tem, pode criar uma conta gratuita em asaas.com e depois configurar no nosso conector.",
  },
  {
    question: "A integração é segura?",
    answer: "Absolutamente. Utilizamos criptografia de ponta a ponta, OAuth 2.0 para autenticação e não armazenamos dados sensíveis de pagamento. Todas as transações são processadas diretamente pelo Asaas.",
  },
  {
    question: "O que acontece se eu ultrapassar o limite de transações?",
    answer: "Você receberá um alerta ao atingir 80% do limite. Ao ultrapassar, a integração continua funcionando, mas você será convidado a fazer upgrade do plano para o próximo ciclo de cobrança.",
  },
  {
    question: "Posso testar antes de assinar?",
    answer: "Sim! Oferecemos 14 dias de teste grátis com todas as funcionalidades do plano Pro. Não é necessário cartão de crédito para começar.",
  },
  {
    question: "Como funciona o suporte?",
    answer: "Oferecemos suporte por email para todos os planos. Clientes Pro têm acesso a suporte prioritário com resposta em até 4 horas. Clientes Enterprise contam com gerente de sucesso dedicado e suporte 24/7.",
  },
  {
    question: "Posso usar com múltiplas contas Asaas?",
    answer: "Sim, o plano Enterprise permite conectar múltiplas contas Asaas a uma única instalação do Bitrix24, ideal para holdings ou empresas com múltiplos CNPJs.",
  },
  {
    question: "Quais automações estão disponíveis?",
    answer: "Você pode criar cobranças automáticas quando um deal muda de status, atualizar o CRM quando um pagamento é confirmado, enviar notificações personalizadas e integrar com os workflows do Bitrix24.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground">
            Tire suas dúvidas sobre a integração Bitrix24 + Asaas
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border px-6 data-[state=open]:border-primary/50 transition-colors"
              >
                <AccordionTrigger className="text-left font-display font-semibold text-foreground hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-2">
            Não encontrou sua resposta?
          </p>
          <a href="mailto:suporte@connectpay.com.br" className="text-primary hover:underline font-medium">
            Entre em contato com nosso suporte
          </a>
        </div>
      </div>
    </section>
  );
}
