import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Printer, PenLine } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-public`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface ContractData {
  id: string;
  rendered_html: string;
  customer_name: string;
  status: string;
  signed_at: string | null;
  signature_name: string | null;
  signed_ip: string | null;
}

export default function PublicContract() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContractData | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [accept, setAccept] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, { headers: { apikey: ANON } });
        const j = await r.json();
        if (!r.ok || j.error) { setError(j.error || "Contrato não encontrado"); }
        else { setData(j.contract); }
        // Auto print mode
        if (new URLSearchParams(window.location.search).get("print") === "1") {
          setTimeout(() => window.print(), 800);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro de conexão");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSign() {
    if (!signerName || !accept) return;
    setSigning(true);
    try {
      const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON },
        body: JSON.stringify({ action: "sign", name: signerName, accept: true }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Falha ao assinar");
      toast({ title: "Contrato assinado", description: "Obrigado!" });
      setSignOpen(false);
      // Refresh
      const rr = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, { headers: { apikey: ANON } });
      const jj = await rr.json();
      setData(jj.contract);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falhou", variant: "destructive" });
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-center p-8"><div><h1 className="text-xl font-semibold mb-2">Contrato não disponível</h1><p className="text-muted-foreground">{error}</p></div></div>;
  if (!data) return null;

  const isSigned = data.status === "signed";

  return (
    <>
      <Helmet><title>Contrato — {data.customer_name}</title></Helmet>

      {!isSigned && (
        <div className="no-print sticky top-0 z-50 bg-card border-b border-border shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">Revise o contrato e clique em assinar quando estiver pronto.</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button>
              <Button size="sm" onClick={() => setSignOpen(true)}><PenLine className="w-4 h-4 mr-2" />Assinar contrato</Button>
            </div>
          </div>
        </div>
      )}

      {isSigned && (
        <div className="no-print sticky top-0 z-50 bg-emerald-50 border-b border-emerald-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Contrato assinado por {data.signature_name} em {data.signed_at && new Date(data.signed_at).toLocaleString("pt-BR")}
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Baixar PDF</Button>
          </div>
        </div>
      )}

      <div dangerouslySetInnerHTML={{ __html: data.rendered_html }} />

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar contrato</DialogTitle>
            <DialogDescription>Sua assinatura digital fica registrada com data, IP e hash de validação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Seu nome completo</Label><Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Como aparece no documento" /></div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={accept} onCheckedChange={(v) => setAccept(!!v)} />
              <span>Li integralmente o contrato e aceito todos os termos e condições.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignOpen(false)}>Cancelar</Button>
            <Button onClick={handleSign} disabled={!signerName || !accept || signing}>{signing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Assinar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
