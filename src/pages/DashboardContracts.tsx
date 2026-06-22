import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Copy, ExternalLink, ScrollText, Wrench, Loader2 } from "lucide-react";
import { useContracts, useContractTemplates } from "@/hooks/useContracts";
import { ContractWizard } from "@/components/contracts/ContractWizard";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";


const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  sent: { label: "Enviado", cls: "bg-sky-500/15 text-sky-600" },
  viewed: { label: "Visualizado", cls: "bg-amber-500/15 text-amber-700" },
  signed: { label: "Assinado", cls: "bg-emerald-500/15 text-emerald-700" },
  canceled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

const PAYMENT_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  paid: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-700" },
  overdue: { label: "Atrasado", cls: "bg-amber-500/15 text-amber-700" },
  refunded: { label: "Estornado", cls: "bg-destructive/15 text-destructive" },
  canceled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-contract-webhook`;

export default function DashboardContracts() {
  const [open, setOpen] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const { data: templates = [] } = useContractTemplates();
  const { data: contracts = [], isLoading } = useContracts();

  function copyLink(token: string) {
    const url = `${window.location.origin}/contrato/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado" });
  }

  async function setupBitrix() {
    setSettingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-contract-setup", { body: { action: "setup_fields" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Bitrix configurado", description: "Campos do CRM e robot de automação instalados." });
    } catch (e) {
      toast({ title: "Erro ao configurar Bitrix", description: e instanceof Error ? e.message : "Falhou", variant: "destructive" });
    } finally {
      setSettingUp(false);
    }
  }


  return (
    <DashboardLayout title="Contratos" description="Gere e gerencie contratos com seus clientes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground">Gere e gerencie contratos com seus clientes.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={setupBitrix} disabled={settingUp} title="Cria os campos UF_CRM_CONTRATO_* e registra o robot no Bitrix">
              {settingUp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}Configurar Bitrix
            </Button>
            <Link to="/dashboard/contracts/templates"><Button variant="outline"><ScrollText className="w-4 h-4 mr-2" />Templates</Button></Link>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo contrato</Button>
          </div>

        </div>

        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-semibold">URL do webhook Asaas</div>
              <p className="text-xs text-muted-foreground mb-2">Cole esta URL no painel da sua conta Asaas em <em>Integrações → Notificações via Webhook</em> para atualizar automaticamente o status dos contratos.</p>
              <code className="text-xs bg-background border rounded px-2 py-1 break-all inline-block">{WEBHOOK_URL}</code>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast({ title: "URL copiada" }); }}>
              <Copy className="w-4 h-4 mr-2" />Copiar
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : contracts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum contrato gerado ainda.</p>
              <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Criar o primeiro</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {["Cliente", "Valor", "Parcelas", "Contrato", "Pagamento", "Criado em", "Ações"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
                  const ps = PAYMENT_LABEL[c.payment_status] || PAYMENT_LABEL.pending;
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.customer_name}</div>
                        {c.customer_doc && <div className="text-xs text-muted-foreground">{c.customer_doc}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.total_value || 0))}</td>
                      <td className="px-4 py-3">{Array.isArray(c.payment_schedule) ? c.payment_schedule.length : 0}</td>
                      <td className="px-4 py-3"><Badge className={st.cls}>{st.label}</Badge></td>
                      <td className="px-4 py-3"><Badge className={ps.cls}>{ps.label}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" title="Copiar link" onClick={() => copyLink(c.public_token)}><Copy className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" title="Abrir" onClick={() => window.open(`/contrato/${c.public_token}`, "_blank")}><ExternalLink className="w-4 h-4" /></Button>
                          {c.asaas_invoice_url && (
                            <Button size="sm" variant="ghost" title="Link de pagamento Asaas" onClick={() => window.open(c.asaas_invoice_url!, "_blank")}>$</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <ContractWizard open={open} onOpenChange={setOpen} templates={templates} />
    </DashboardLayout>
  );
}
