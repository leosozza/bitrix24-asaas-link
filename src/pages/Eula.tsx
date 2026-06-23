import { Helmet } from "react-helmet-async";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

const sections = [
  {
    title: "1. Definições",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Thoth24</strong>: Thoth24, pessoa jurídica inscrita no CNPJ 54.727.112/0001-78, desenvolvedora e licenciante do Aplicativo.</li>
        <li><strong>Aplicativo</strong>: o conector "Asaas Pay by Thoth24" para Bitrix24, incluindo painel web, edge functions, robôs Bizproc, abas CRM e integrações relacionadas.</li>
        <li><strong>Usuário</strong>: a pessoa física ou jurídica que instala, contrata e/ou utiliza o Aplicativo em um portal Bitrix24.</li>
        <li><strong>Bitrix24</strong>: plataforma de CRM e colaboração de propriedade da Bitrix24 Limited.</li>
        <li><strong>Asaas</strong>: instituição de pagamento Asaas Gestão Financeira, contratada diretamente pelo Usuário.</li>
      </ul>
    ),
  },
  {
    title: "2. Objeto da licença",
    body: (
      <p>A Thoth24 concede ao Usuário uma licença <strong>não exclusiva, intransferível, revogável e limitada</strong> ao uso do Aplicativo, exclusivamente dentro do(s) portal(is) Bitrix24 autorizado(s), pelo prazo de vigência do plano contratado. É vedada a redistribuição, sublicenciamento, engenharia reversa, descompilação ou qualquer tentativa de obter o código-fonte.</p>
    ),
  },
  {
    title: "3. Cadastro e conta",
    body: (
      <p>O Usuário é responsável por manter dados cadastrais atualizados, pela guarda de suas credenciais de acesso ao Aplicativo e pela proteção da chave de API do Asaas e dos tokens OAuth do Bitrix24. Toda atividade realizada com essas credenciais será atribuída ao Usuário.</p>
    ),
  },
  {
    title: "4. Planos, pagamentos e período de teste",
    body: (
      <p>O Aplicativo pode oferecer período de teste gratuito. Após o término, a continuidade depende da contratação de um plano ativo. Limites de transações, recursos e preços são os divulgados no painel do Aplicativo no momento da contratação. Falta de pagamento autoriza a Thoth24 a suspender o acesso.</p>
    ),
  },
  {
    title: "5. Obrigações do Usuário",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>Utilizar o Aplicativo apenas para finalidades lícitas e em conformidade com a legislação brasileira.</li>
        <li>Manter conta própria e ativa junto ao Asaas e ao Bitrix24, arcando com os respectivos custos.</li>
        <li>Não utilizar o Aplicativo para fraude, lavagem de dinheiro, financiamento de atividades ilícitas ou violação de direitos de terceiros.</li>
        <li>Responder pelo conteúdo dos dados inseridos no CRM e nas cobranças emitidas.</li>
      </ul>
    ),
  },
  {
    title: "6. Propriedade intelectual",
    body: (
      <p>Todos os direitos sobre o Aplicativo, marca, código-fonte, layouts, documentação e materiais associados pertencem exclusivamente à Thoth24. A licença concedida não transfere qualquer direito de propriedade intelectual.</p>
    ),
  },
  {
    title: "7. Limitação de responsabilidade",
    body: (
      <p>O Aplicativo é fornecido "no estado em que se encontra". A Thoth24 envida seus melhores esforços para manter a disponibilidade, mas não garante operação ininterrupta ou livre de erros. A Thoth24 <strong>não é instituição financeira</strong> e não se responsabiliza pelo processamento de pagamentos, prazos de liquidação, taxas, chargebacks ou disputas relacionadas, que são de responsabilidade do Asaas e do Usuário. A responsabilidade total da Thoth24, em qualquer hipótese, fica limitada ao valor efetivamente pago pelo Usuário nos 12 meses anteriores ao evento.</p>
    ),
  },
  {
    title: "8. Suspensão e rescisão",
    body: (
      <p>A Thoth24 poderá suspender ou rescindir a licença em caso de descumprimento deste EULA, inadimplência, uso fraudulento ou determinação legal. O Usuário pode cancelar a qualquer momento pelo painel do Aplicativo, sem direito a reembolso de períodos já utilizados.</p>
    ),
  },
  {
    title: "9. Atualizações do Aplicativo",
    body: (
      <p>A Thoth24 poderá publicar atualizações, correções e novas funcionalidades a qualquer momento, sem aviso prévio. Algumas mudanças podem exigir reinstalação ou nova autorização no Bitrix24.</p>
    ),
  },
  {
    title: "10. Foro e legislação aplicável",
    body: (
      <p>Este EULA é regido pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca da sede da Thoth24 para dirimir quaisquer controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
    ),
  },
];

export default function Eula() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>EULA — Asaas Pay by Thoth24</title>
        <meta name="description" content="Contrato de Licença de Usuário Final (EULA) do conector Asaas Pay by Thoth24 para Bitrix24." />
        <link rel="canonical" href="https://asaas.thoth24.com/eula" />
      </Helmet>

      <Header />

      <main className="pt-32 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Documento legal
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Contrato de Licença de Usuário Final
            </h1>
            <p className="text-muted-foreground">
              Última atualização: 23 de junho de 2026
            </p>
          </div>

          <div className="space-y-10 text-foreground/90 leading-relaxed">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="font-display text-2xl font-semibold text-foreground mb-3">{s.title}</h2>
                <div className="space-y-3">{s.body}</div>
              </section>
            ))}

            <section className="pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Thoth24</strong> — CNPJ 54.727.112/0001-78 ·{" "}
                <a href="mailto:contato@thoth24.com" className="text-primary hover:underline">contato@thoth24.com</a> ·{" "}
                <a href="https://asaas.thoth24.com" className="text-primary hover:underline">asaas.thoth24.com</a>
              </p>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
