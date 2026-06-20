import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContractTemplate, useGenerateContract } from "@/hooks/useContracts";
import { PaymentScheduleTable, ScheduleRow } from "./PaymentScheduleTable";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: ContractTemplate[];
  prefill?: Partial<{
    customer_name: string;
    customer_doc: string;
    customer_email: string;
    customer_phone: string;
    customer_address: string;
    company_name: string;
    bitrix_entity_type: string;
    bitrix_entity_id: string;
  }>;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function ContractWizard({ open, onOpenChange, templates, prefill }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [templateId, setTemplateId] = useState<string>("");
  const [customer, setCustomer] = useState({
    name: "", doc: "", email: "", phone: "", address: "", company_name: "",
  });
  const [contractTerm, setContractTerm] = useState("12 meses");
  const [salesperson, setSalesperson] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"manual" | "asaas">("manual");
  const [asaasSubId, setAsaasSubId] = useState("");
  const [entradaQty, setEntradaQty] = useState(1);
  const [entradaValor, setEntradaValor] = useState(1000);
  const [entradaMetodo, setEntradaMetodo] = useState("PIX");
  const [recorrQty, setRecorrQty] = useState(12);
  const [recorrValor, setRecorrValor] = useState(375);
  const [recorrMetodo, setRecorrMetodo] = useState("BOLETO");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(7);
  const [result, setResult] = useState<{ public_url: string; pdf_url: string; contract_id: string } | null>(null);

  const generate = useGenerateContract();

  useEffect(() => {
    if (!open) {
      setStep(1);
      setResult(null);
      return;
    }
    if (prefill) {
      setCustomer((c) => ({
        ...c,
        name: prefill.customer_name || c.name,
        doc: prefill.customer_doc || c.doc,
        email: prefill.customer_email || c.email,
        phone: prefill.customer_phone || c.phone,
        address: prefill.customer_address || c.address,
        company_name: prefill.company_name || c.company_name,
      }));
    }
    const def = templates.find((t) => t.is_default);
    if (def) setTemplateId(def.id);
    else if (templates[0]) setTemplateId(templates[0].id);
  }, [open, prefill, templates]);

  const schedule: ScheduleRow[] = useMemo(() => {
    if (scheduleMode === "asaas") return [];
    const rows: ScheduleRow[] = [];
    const start = new Date(startDate + "T12:00:00");
    let counter = 1;
    for (let i = 0; i < entradaQty; i++) {
      const d = new Date(start.getTime() + i * intervalDays * 86400000);
      rows.push({ n: counter++, tipo: `Entrada ${i + 1}/${entradaQty}`, vencimento: d.toISOString().slice(0, 10), valor: entradaValor, metodo: entradaMetodo });
    }
    for (let i = 0; i < recorrQty; i++) {
      const d = new Date(start.getTime() + (entradaQty + i) * intervalDays * 86400000);
      rows.push({ n: counter++, tipo: `Recorrente ${i + 1}`, vencimento: d.toISOString().slice(0, 10), valor: recorrValor, metodo: recorrMetodo });
    }
    return rows;
  }, [scheduleMode, entradaQty, entradaValor, entradaMetodo, recorrQty, recorrValor, recorrMetodo, startDate, intervalDays]);

  const totalValue = schedule.reduce((s, r) => s + r.valor, 0);

  const canNext = () => {
    if (step === 1) return !!templateId;
    if (step === 2) return !!customer.name;
    if (step === 3) return scheduleMode === "asaas" ? !!asaasSubId : schedule.length > 0;
    return true;
  };

  async function handleGenerate() {
    try {
      const res = await generate.mutateAsync({
        template_id: templateId,
        customer,
        total_value: totalValue,
        contract_term: contractTerm,
        salesperson_name: salesperson,
        payment_schedule: scheduleMode === "manual" ? schedule : undefined,
        asaas_subscription_id: scheduleMode === "asaas" ? asaasSubId : undefined,
        bitrix_entity_type: prefill?.bitrix_entity_type,
        bitrix_entity_id: prefill?.bitrix_entity_id,
      });
      setResult({ public_url: res.public_url, pdf_url: res.pdf_url, contract_id: res.contract_id });
      setStep(5);
      toast({ title: "Contrato gerado", description: "Link público pronto para envio." });
    } catch (e) {
      toast({ title: "Erro ao gerar contrato", description: e instanceof Error ? e.message : "Tente novamente", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{result ? "Contrato pronto" : `Novo contrato — Passo ${step}/4`}</DialogTitle>
          <DialogDescription>
            {step === 1 && "Escolha o template do contrato."}
            {step === 2 && "Dados do cliente que vai assinar."}
            {step === 3 && "Cronograma de pagamento."}
            {step === 4 && "Revise antes de gerar."}
            {step === 5 && "Compartilhe o link com o cliente."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">Você ainda não tem templates. Crie um em <strong>Templates de Contrato</strong>.</p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${templateId === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
              >
                <div className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />{t.name}{t.is_default && <span className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary px-1.5 rounded">Padrão</span>}</div>
                {t.description && <div className="text-sm text-muted-foreground mt-1">{t.description}</div>}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Nome completo *</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
            <div><Label>CPF / CNPJ</Label><Input value={customer.doc} onChange={(e) => setCustomer({ ...customer, doc: e.target.value })} /></div>
            <div><Label>Empresa</Label><Input value={customer.company_name} onChange={(e) => setCustomer({ ...customer, company_name: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Endereço</Label><Textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></div>
            <div><Label>Prazo do contrato</Label><Input value={contractTerm} onChange={(e) => setContractTerm(e.target.value)} /></div>
            <div><Label>Vendedor responsável</Label><Input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} /></div>
          </div>
        )}

        {step === 3 && (
          <Tabs value={scheduleMode} onValueChange={(v) => setScheduleMode(v as "manual" | "asaas")}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="manual">Montar parcelas manualmente</TabsTrigger>
              <TabsTrigger value="asaas">Importar de assinatura Asaas</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="space-y-4 pt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>Início (1ª parcela)</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div><Label>Intervalo (dias)</Label><Input type="number" value={intervalDays} onChange={(e) => setIntervalDays(+e.target.value)} /></div>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="font-semibold text-sm">Entradas</div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Quantidade</Label><Input type="number" value={entradaQty} onChange={(e) => setEntradaQty(+e.target.value)} /></div>
                  <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={entradaValor} onChange={(e) => setEntradaValor(+e.target.value)} /></div>
                  <div><Label className="text-xs">Método</Label>
                    <Select value={entradaMetodo} onValueChange={setEntradaMetodo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="PIX">PIX</SelectItem><SelectItem value="BOLETO">BOLETO</SelectItem><SelectItem value="CREDIT_CARD">Cartão</SelectItem><SelectItem value="DINHEIRO">Dinheiro</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="font-semibold text-sm">Recorrentes</div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Quantidade</Label><Input type="number" value={recorrQty} onChange={(e) => setRecorrQty(+e.target.value)} /></div>
                  <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={recorrValor} onChange={(e) => setRecorrValor(+e.target.value)} /></div>
                  <div><Label className="text-xs">Método</Label>
                    <Select value={recorrMetodo} onValueChange={setRecorrMetodo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="PIX">PIX</SelectItem><SelectItem value="BOLETO">BOLETO</SelectItem><SelectItem value="CREDIT_CARD">Cartão</SelectItem><SelectItem value="DINHEIRO">Dinheiro</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <PaymentScheduleTable rows={schedule} />
              <div className="text-right font-semibold">Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}</div>
            </TabsContent>
            <TabsContent value="asaas" className="space-y-3 pt-3">
              <Label>ID da assinatura Asaas</Label>
              <Input placeholder="sub_xxxxxxxx" value={asaasSubId} onChange={(e) => setAsaasSubId(e.target.value)} />
              <p className="text-xs text-muted-foreground">As parcelas serão importadas automaticamente do Asaas ao gerar o contrato.</p>
            </TabsContent>
          </Tabs>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Cliente:</span> <strong>{customer.name}</strong></div>
              <div><span className="text-muted-foreground">Doc:</span> {customer.doc || "—"}</div>
              <div><span className="text-muted-foreground">Empresa:</span> {customer.company_name || "—"}</div>
              <div><span className="text-muted-foreground">Prazo:</span> {contractTerm}</div>
              <div><span className="text-muted-foreground">Total:</span> <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}</strong></div>
              <div><span className="text-muted-foreground">Parcelas:</span> {scheduleMode === "asaas" ? "Importar do Asaas" : schedule.length}</div>
            </div>
            {scheduleMode === "manual" && <PaymentScheduleTable rows={schedule} />}
          </div>
        )}

        {step === 5 && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="font-semibold text-emerald-700">✓ Contrato gerado com sucesso</div>
              <p className="text-sm text-muted-foreground mt-1">Envie o link abaixo ao cliente para visualizar e assinar.</p>
            </div>
            <div className="space-y-2">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.public_url} />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(result.public_url); toast({ title: "Link copiado" }); }}><Copy className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={() => window.open(result.public_url, "_blank")}><ExternalLink className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Versão para impressão / PDF</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.pdf_url} />
                <Button variant="outline" onClick={() => window.open(result.pdf_url, "_blank")}>Abrir PDF</Button>
              </div>
              <p className="text-xs text-muted-foreground">Use "Imprimir → Salvar como PDF" no navegador.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && step < 5 && <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>Voltar</Button>}
          {step < 4 && <Button disabled={!canNext()} onClick={() => setStep((s) => (s + 1) as Step)}>Continuar</Button>}
          {step === 4 && (
            <Button disabled={generate.isPending} onClick={handleGenerate}>
              {generate.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Gerar contrato
            </Button>
          )}
          {step === 5 && <Button onClick={() => onOpenChange(false)}>Concluir</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
