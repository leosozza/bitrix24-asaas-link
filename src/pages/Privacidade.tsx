import { Helmet } from "react-helmet-async";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

const sections = [
  {
    title: "1. Controlador dos dados",
    body: (
      <p>
        O controlador dos dados pessoais tratados por meio do Aplicativo "Asaas Pay by Thoth24" é a{" "}
        <strong>Thoth24</strong>, inscrita no CNPJ 54.727.112/0001-78. Contato do Encarregado (DPO):{" "}
        <a href="mailto:contato@thoth24.com" className="text-primary hover:underline">contato@thoth24.com</a>.
      </p>
    ),
  },
  {
    title: "2. Dados que coletamos",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Cadastro</strong>: nome, email, empresa e telefone informados na criação da conta.</li>
        <li><strong>Bitrix24</strong>: domínio do portal, member_id, tokens OAuth e dados das entidades CRM (leads, deals, contatos, companies) que o Usuário escolher integrar.</li>
        <li><strong>Asaas</strong>: chave de API (armazenada de forma segregada por tenant), dados de clientes, cobranças, assinaturas, splits e notas fiscais processadas pela conta Asaas do Usuário.</li>
        <li><strong>Operacionais</strong>: logs de execução, webhooks recebidos, endereços IP e metadados técnicos necessários para auditoria e segurança.</li>
      </ul>
    ),
  },
  {
    title: "3. Finalidade do tratamento",
    body: (
      <p>Os dados são tratados exclusivamente para operar a integração entre Asaas e Bitrix24: emitir cobranças, sincronizar status, processar webhooks, emitir NFSe, executar automações Bizproc e prestar suporte ao Usuário.</p>
    ),
  },
  {
    title: "4. Base legal (LGPD)",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>Execução de contrato (art. 7º, V da LGPD) — para operar o serviço contratado.</li>
        <li>Cumprimento de obrigação legal ou regulatória (art. 7º, II) — para emissão e guarda de documentos fiscais.</li>
        <li>Legítimo interesse (art. 7º, IX) — para segurança, prevenção a fraude e melhoria do produto.</li>
        <li>Consentimento (art. 7º, I) — quando aplicável a comunicações de marketing opt-in.</li>
      </ul>
    ),
  },
  {
    title: "5. Compartilhamento",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Asaas</strong> — para processar cobranças e notas fiscais em nome do Usuário.</li>
        <li><strong>Bitrix24</strong> — para refletir status, abas e robôs dentro do portal do Usuário.</li>
        <li><strong>Provedores de infraestrutura</strong> — Supabase/Lovable Cloud, utilizados como operadores para hospedagem, banco e edge functions, sob contrato de proteção de dados.</li>
        <li>Autoridades públicas, quando exigido por lei ou ordem judicial.</li>
      </ul>
    ),
  },
  {
    title: "6. Segurança",
    body: (
      <p>Adotamos isolamento por tenant via Row Level Security (RLS), criptografia em trânsito (TLS) e em repouso, controle de acesso baseado em papéis e registro de auditoria. Chaves de API e tokens são armazenados em campos protegidos e nunca expostos no frontend.</p>
    ),
  },
  {
    title: "7. Retenção",
    body: (
      <p>Dados operacionais são mantidos enquanto a conta do Usuário estiver ativa. Após o cancelamento, dados pessoais são eliminados em até 90 dias, salvo aqueles que devem ser preservados por obrigação legal (ex.: documentos fiscais, mantidos por até 5 anos).</p>
    ),
  },
  {
    title: "8. Direitos do titular",
    body: (
      <p>
        Você pode solicitar a qualquer momento: confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamentos e revogação de consentimento. As solicitações devem ser enviadas para{" "}
        <a href="mailto:contato@thoth24.com" className="text-primary hover:underline">contato@thoth24.com</a> e serão respondidas em até 15 dias.
      </p>
    ),
  },
  {
    title: "9. Cookies",
    body: (
      <p>Utilizamos apenas cookies essenciais para autenticação e manutenção de sessão. Não usamos cookies de rastreamento publicitário de terceiros.</p>
    ),
  },
  {
    title: "10. Alterações desta política",
    body: (
      <p>Esta política pode ser atualizada para refletir mudanças legais ou operacionais. A versão vigente estará sempre disponível em <a href="https://asaas.thoth24.com/privacidade" className="text-primary hover:underline">asaas.thoth24.com/privacidade</a>.</p>
    ),
  },
];

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Política de Privacidade — Asaas Pay by Thoth24</title>
        <meta name="description" content="Política de Privacidade e tratamento de dados (LGPD) do conector Asaas Pay by Thoth24 para Bitrix24." />
        <link rel="canonical" href="https://asaas.thoth24.com/privacidade" />
      </Helmet>

      <Header />

      <main className="pt-32 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              LGPD · Documento legal
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Política de Privacidade
            </h1>
            <p className="text-muted-foreground">Última atualização: 23 de junho de 2026</p>
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
                <a href="mailto:contato@thoth24.com" className="text-primary hover:underline">contato@thoth24.com</a>
              </p>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
