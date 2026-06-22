import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContractTemplate, useContractTemplates, useDeleteTemplate, useSaveTemplate, useSeedDefaultTemplates, BitrixFieldMap } from "@/hooks/useContracts";
import { Plus, Pencil, Trash2, FileText, ArrowLeft, Sparkles, ExternalLink, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { BitrixFieldMapper } from "@/components/contracts/BitrixFieldMapper";
import { AsaasBillingFieldMapper } from "@/components/contracts/AsaasBillingFieldMapper";
import { ContractTemplateEditor } from "@/components/contracts/ContractTemplateEditor";

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
  const seed = useSeedDefaultTemplates();
  const [editing, setEditing] = useState<Partial<ContractTemplate> | null>(null);
  const [mappingsOpen, setMappingsOpen] = useState(false);

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

  async function handleSeed() {
    try {
      const res = await seed.mutateAsync();
      toast({ title: res.inserted > 0 ? `${res.inserted} modelos adicionados` : "Tudo certo", description: res.message || `Modelos prontos disponíveis.` });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falhou", variant: "destructive" });
    }
  }

  function handlePreview(html: string) {
    const sample = html
      .replace(/\{\{\s*cliente_nome\s*\}\}/g, "João da Silva")
      .replace(/\{\{\s*cliente_doc\s*\}\}/g, "123.456.789-00")
      .replace(/\{\{\s*cliente_email\s*\}\}/g, "joao@exemplo.com")
      .replace(/\{\{\s*cliente_empresa\s*\}\}/g, "Empresa do João Ltda")
      .replace(/\{\{\s*cliente_endereco\s*\}\}/g, "Rua das Flores, 123 — São Paulo/SP")
      .replace(/\{\{\s*valor_total\s*\}\}/g, "R$ 5.500,00")
      .replace(/\{\{\s*qtd_parcelas\s*\}\}/g, "12")
      .replace(/\{\{\s*prazo_contrato\s*\}\}/g, "12 meses")
      .replace(/\{\{\s*data_contrato\s*\}\}/g, new Date().toLocaleDateString("pt-BR"))
      .replace(/\{\{\s*contratado_nome\s*\}\}/g, "Sua Empresa LTDA")
      .replace(/\{\{\s*contratado_cnpj\s*\}\}/g, "00.000.000/0001-00")
      .replace(/\{\{\s*contratado_endereco\s*\}\}/g, "Curitiba/PR")
      .replace(/\{\{\s*contratado_representante\s*\}\}/g, "Representante Legal")
      .replace(/\{\{\s*foro_cidade\s*\}\}/g, "Curitiba/PR")
      .replace(/\{\{\s*vendedor\s*\}\}/g, "Maria Vendas")
      .replace(/\{\{\s*parcelas_tabela\s*\}\}/g, '<div style="padding:16px;border:1px dashed #cbd5e1;border-radius:6px;color:#64748b;text-align:center;margin:12px 0;">Tabela de parcelas (preenchida na geração)</div>')
      .replace(/\{\{\s*[\w_]+\s*\}\}/g, '<span style="background:#fef3c7;padding:0 4px;border-radius:3px;color:#92400e;">(placeholder)</span>');
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif"><div style="max-width:860px;margin:0 auto;background:white;padding:48px;box-shadow:0 4px 24px rgba(0,0,0,.06);border-radius:8px;">${sample}</div></body></html>`);
    w.document.close();
  }

  return (
    <DashboardLayout title="Templates de contrato" description="Modelos reutilizáveis com placeholders">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/dashboard/contracts" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar para contratos</Link>
            <h1 className="text-2xl font-bold text-foreground mt-1">Templates de contrato</h1>
            <p className="text-sm text-muted-foreground">Crie e edite modelos reutilizáveis com placeholders.</p>
          </div>
          <div className="flex gap-2">
            {templates.length < 5 && (
              <Button variant="outline" onClick={handleSeed} disabled={seed.isPending}>
                <Sparkles className="w-4 h-4 mr-2" />Carregar 5 modelos prontos
              </Button>
            )}
            <Button onClick={() => setEditing({ name: "", body_html: DEFAULT_BODY, is_default: templates.length === 0, bitrix_field_map: {}, asaas_billing_map: {} })}><Plus className="w-4 h-4 mr-2" />Novo template</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
            templates.length === 0 ? <Card className="p-8 text-center"><FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Nenhum template ainda.</p></Card> :
            templates.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {t.name}
                      {t.is_default && <span className="text-[10px] uppercase bg-primary/15 text-primary px-1.5 rounded">Padrão</span>}
                      {t.cover_style && <span className="text-[10px] uppercase bg-muted text-muted-foreground px-1.5 rounded">{t.cover_style}</span>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                    {t.bitrix_field_map && Object.keys(t.bitrix_field_map).length > 0 && (
                      <p className="text-xs text-primary mt-1">{Object.keys(t.bitrix_field_map).length} campo(s) mapeado(s) do Bitrix</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handlePreview(t.body_html)} title="Pré-visualizar"><ExternalLink className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir template?")) del.mutate(t.id); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid lg:grid-cols-[1fr_260px_280px] gap-4">
              <div className="space-y-3 min-w-0">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                  <div><Label>Descrição</Label><Input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Editor do contrato</Label>
                    <Button size="sm" variant="ghost" type="button" onClick={() => handlePreview(editing.body_html || "")}><ExternalLink className="w-3 h-3 mr-1" />Pré-visualizar</Button>
                  </div>
                  <ContractTemplateEditor
                    value={editing.body_html || ""}
                    onChange={(html) => setEditing({ ...editing, body_html: html })}
                  />
                </div>
                <div className="flex items-center gap-2"><Switch checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} /><Label>Definir como padrão</Label></div>
              </div>
              <div className="lg:block hidden">
                <BitrixFieldMapper
                  bodyHtml={editing.body_html || ""}
                  value={(editing.bitrix_field_map || {}) as BitrixFieldMap}
                  onChange={(v) => setEditing({ ...editing, bitrix_field_map: v })}
                />
              </div>
              <div className="lg:block hidden">
                <AsaasBillingFieldMapper
                  value={(editing.asaas_billing_map || {}) as BitrixFieldMap}
                  onChange={(v) => setEditing({ ...editing, asaas_billing_map: v })}
                />
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
