import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Copy, ExternalLink, ScrollText } from "lucide-react";
import { useContracts, useContractTemplates } from "@/hooks/useContracts";
import { ContractWizard } from "@/components/contracts/ContractWizard";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  sent: { label: "Enviado", cls: "bg-sky-500/15 text-sky-600" },
  viewed: { label: "Visualizado", cls: "bg-amber-500/15 text-amber-700" },
  signed: { label: "Assinado", cls: "bg-emerald-500/15 text-emerald-700" },
  canceled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

export default function DashboardContracts() {
  const [open, setOpen] = useState(false);
  const { data: templates = [] } = useContractTemplates();
  const { data: contracts = [], isLoading } = useContracts();

  function copyLink(token: string) {
    const url = `${window.location.origin}/contrato/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado" });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground">Gere e gerencie contratos com seus clientes.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/contracts/templates"><Button variant="outline"><ScrollText className="w-4 h-4 mr-2" />Templates</Button></Link>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo contrato</Button>
          </div>
        </div>

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
                  {["Cliente", "Valor", "Parcelas", "Status", "Criado em", "Ações"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.customer_name}</div>
                        {c.customer_doc && <div className="text-xs text-muted-foreground">{c.customer_doc}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.total_value || 0))}</td>
                      <td className="px-4 py-3">{Array.isArray(c.payment_schedule) ? c.payment_schedule.length : 0}</td>
                      <td className="px-4 py-3"><Badge className={st.cls}>{st.label}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" title="Copiar link" onClick={() => copyLink(c.public_token)}><Copy className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" title="Abrir" onClick={() => window.open(`/contrato/${c.public_token}`, "_blank")}><ExternalLink className="w-4 h-4" /></Button>
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
