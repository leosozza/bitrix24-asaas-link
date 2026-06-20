import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContractTemplate, useContractTemplates, useDeleteTemplate, useSaveTemplate } from "@/hooks/useContracts";
import { Plus, Pencil, Trash2, FileText, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const PLACEHOLDERS = [
  ["{{cliente_nome}}", "Nome do cliente"],
  ["{{cliente_doc}}", "CPF/CNPJ"],
  ["{{cliente_email}}", "E-mail"],
  ["{{cliente_telefone}}", "Telefone"],
  ["{{cliente_endereco}}", "Endereço"],
  ["{{cliente_empresa}}", "Empresa do cliente"],
  ["{{valor_total}}", "Valor total formatado"],
  ["{{qtd_parcelas}}", "Quantidade de parcelas"],
  ["{{parcelas_tabela}}", "Tabela completa de parcelas"],
  ["{{prazo_contrato}}", "Prazo do contrato"],
  ["{{vendedor}}", "Vendedor responsável"],
  ["{{contratado_nome}}", "Nome da sua empresa"],
  ["{{contratado_cnpj}}", "CNPJ da contratada"],
  ["{{data_contrato}}", "Data da geração"],
];

const DEFAULT_BODY = `<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p><strong>CONTRATADO:</strong> {{contratado_nome}}, CNPJ {{contratado_cnpj}}.</p>
<p><strong>CONTRATANTE:</strong> {{cliente_nome}}, CPF/CNPJ {{cliente_doc}}, endereço {{cliente_endereco}}.</p>

<h2>Cláusula 1 — Objeto</h2>
<p>O presente contrato tem como objeto a prestação dos serviços contratados, no prazo de {{prazo_contrato}}.</p>

<h2>Cláusula 2 — Valor e Pagamento</h2>
<p>O valor total contratado é de <strong>{{valor_total}}</strong>, dividido conforme cronograma abaixo:</p>
{{parcelas_tabela}}

<h2>Cláusula 3 — Vigência</h2>
<p>O contrato terá vigência de {{prazo_contrato}} a partir da data de assinatura ({{data_contrato}}).</p>

<h2>Cláusula 4 — Foro</h2>
<p>Fica eleito o foro do domicílio do CONTRATADO para dirimir conflitos oriundos deste contrato.</p>

<p style="margin-top:48px"><strong>Vendedor responsável:</strong> {{vendedor}}</p>`;

export default function DashboardContractTemplates() {
  const { data: templates = [], isLoading } = useContractTemplates();
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const [editing, setEditing] = useState<Partial<ContractTemplate> | null>(null);

  async function handleSave() {
    if (!editing?.name) return;
    try {
      await save.mutateAsync(editing);
      toast({ title: "Template salvo" });
      setEditing(null);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falhou", variant: "destructive" });
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/dashboard/contracts" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar para contratos</Link>
            <h1 className="text-2xl font-bold text-foreground mt-1">Templates de contrato</h1>
            <p className="text-sm text-muted-foreground">Crie e edite modelos reutilizáveis com placeholders.</p>
          </div>
          <Button onClick={() => setEditing({ name: "", body_html: DEFAULT_BODY, is_default: templates.length === 0 })}><Plus className="w-4 h-4 mr-2" />Novo template</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
            templates.length === 0 ? <Card className="p-8 text-center"><FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Nenhum template ainda.</p></Card> :
            templates.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold flex items-center gap-2">{t.name}{t.is_default && <span className="text-[10px] uppercase bg-primary/15 text-primary px-1.5 rounded">Padrão</span>}</div>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir template?")) del.mutate(t.id); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid md:grid-cols-[1fr_240px] gap-4">
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Descrição</Label><Input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div><Label>Corpo (HTML)</Label><Textarea rows={20} className="font-mono text-xs" value={editing.body_html || ""} onChange={(e) => setEditing({ ...editing, body_html: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} /><Label>Definir como padrão</Label></div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide">Placeholders</Label>
                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {PLACEHOLDERS.map(([code, desc]) => (
                    <button key={code} onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Copiado", description: code }); }} className="w-full text-left p-2 rounded border border-border hover:bg-muted text-xs">
                      <div className="font-mono text-primary">{code}</div>
                      <div className="text-muted-foreground">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
