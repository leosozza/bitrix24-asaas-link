import { Button } from "@/components/ui/button";
import { Check, Sparkles, Infinity as InfinityIcon } from "lucide-react";
import { Link } from "react-router-dom";

const groups: { title: string; items: string[] }[] = [
  {
    title: "Cobranças & pagamentos Asaas",
    items: [
      "Transações ilimitadas — sem cap mensal",
      "PIX, Boleto bancário e Cartão de crédito",
      "Assinaturas recorrentes (mensal, anual, custom)",
      "Split de pagamentos entre múltiplas carteiras Asaas",
      "Link de pagamento e cobrança avulsa",
      "Reembolsos e cancelamentos direto do CRM",
    ],
  },
  {
    title: "Integração nativa com Bitrix24",
    items: [
      "Instalação 1-clique no Marketplace Bitrix24",
      "Pay System API — checkout Asaas dentro do Bitrix (PIX, Boleto, Cartão)",
      "Aba \"Pagamentos Asaas\" em Leads, Deals e Smart Processes (CRM detail tab)",
      "Badges de status de pagamento na timeline do CRM",
      "Hub de gestão embutido em iframe (dashboard, transações, config)",
      "Campos personalizados UF_CRM_ASAAS_* nos Deals",
      "Sincronização automática Cliente Asaas ↔ Contato/Empresa Bitrix",
    ],
  },
  {
    title: "Automações & Bizproc",
    items: [
      "5 robôs Bizproc: gerar cobrança, assinatura, split, NFSe e checar status",
      "Auto-registro e self-healing dos robôs em cada portal",
      "Workflows disparados por eventos de pagamento (pago, vencido, estornado)",
      "Webhooks Asaas registrados e monitorados automaticamente",
    ],
  },
  {
    title: "Fiscal & Contratos",
    items: [
      "Emissão automática de NFSe pela API do Asaas",
      "Configuração de serviço municipal, ISS e template de observações",
      "Contratos digitais com aceite público e assinatura eletrônica",
      "Templates de contrato editáveis e mapeamento de campos Bitrix",
      "Cobrança recorrente vinculada ao contrato",
    ],
  },
  {
    title: "Operação & suporte",
    items: [
      "Usuários Bitrix24 ilimitados",
      "Dashboard SaaS com transações, assinaturas, splits e NFSe",
      "Logs de integração e ferramenta de reparo (pay system, robôs, webhooks)",
      "Conector MCP para automações com IA",
      "Suporte prioritário por e-mail (contato@thoth24.com)",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-secondary/30 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Plano
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5">
            Plano único, sem surpresas
          </h2>
          <p className="text-lg text-muted-foreground">
            Comece grátis por 14 dias. Sem cartão de crédito.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="relative p-8 rounded-2xl border border-primary/50 bg-card shadow-2xl shadow-primary/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-sm font-medium shadow-glow">
                <Sparkles className="w-3.5 h-3.5" />
                Tudo incluso
              </span>
            </div>

            <div className="mb-6 text-center">
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">
                Asaas Pay by Thoth24
              </h3>
              <p className="text-muted-foreground text-sm">
                Todos os recursos, sem limites de transações.
              </p>
            </div>

            <div className="mb-6 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="text-6xl font-display font-bold text-foreground">249</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary font-medium">
                <InfinityIcon className="w-4 h-4" /> Transações ilimitadas
              </div>
            </div>

            <div className="space-y-5 mb-8">
              {groups.map((g, gi) => (
                <div key={gi}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                    {g.title}
                  </h4>
                  <ul className="space-y-2">
                    {g.items.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <span className="text-foreground text-sm leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-12 text-base gradient-primary text-primary-foreground hover:opacity-90 shadow-md"
              asChild
            >
              <Link to="/auth?plan=pro">Começar agora</Link>
            </Button>
          </div>

          <p className="mt-8 text-center text-muted-foreground text-sm">
            Sem taxa de setup. Cancele quando quiser.{" "}
            <a href="#" className="text-primary hover:underline font-medium">Fale conosco</a> para necessidades customizadas.
          </p>
        </div>
      </div>
    </section>
  );
}
