import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Printer, PenLine, MapPin, ShieldCheck } from "lucide-react";
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
  signature_doc_masked: string | null;
  signed_ip: string | null;
  document_hash: string | null;
}

function formatDoc(raw: string): string {
  const d = raw.replace(/\D+/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export default function PublicContract() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContractData | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerDoc, setSignerDoc] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptOwnership, setAcceptOwnership] = useState(false);
  const [geo, setGeo] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, { headers: { apikey: ANON } });
        const j = await r.json();
        if (!r.ok || j.error) { setError(j.error || "Contrato não encontrado"); }
        else { setData(j.contract); }
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

  function requestGeo() {
    if (!navigator.geolocation) { setGeoStatus("denied"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  async function handleSign() {
    if (!signerName.trim() || !signerDoc.trim() || !acceptTerms || !acceptOwnership) return;
    setSigning(true);
    try {
      const client = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio },
        geolocation: geo,
      };
      const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON },
        body: JSON.stringify({
          action: "sign",
          name: signerName.trim(),
          customer_doc: signerDoc.replace(/\D+/g, ""),
          accept_terms: true,
          accept_ownership: true,
          client,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Falha ao assinar");
      toast({ title: "Contrato assinado", description: "Sua assinatura foi registrada com sucesso." });
      setSignOpen(false);
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
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Assinatura eletrônica avançada — Lei 14.063/2020
            </div>
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
              <CheckCircle2 className="w-4 h-4" />
              Assinado por {data.signature_name}
              {data.signature_doc_masked && <span className="text-emerald-600 font-normal">({data.signature_doc_masked})</span>}
              {data.signed_at && <span className="text-emerald-600 font-normal">em {new Date(data.signed_at).toLocaleString("pt-BR")}</span>}
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Baixar PDF</Button>
          </div>
        </div>
      )}

      <div dangerouslySetInnerHTML={{ __html: data.rendered_html }} />

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Assinatura eletrônica</DialogTitle>
            <DialogDescription>
              Conforme a Lei 14.063/2020 (art. 4º, II), sua assinatura é validada pelo CPF/CNPJ do contrato e registrada com data, hora, IP, dispositivo e hash do documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Como aparece no documento" maxLength={150} />
            </div>
            <div>
              <Label>CPF ou CNPJ do titular</Label>
              <Input
                value={signerDoc}
                onChange={(e) => setSignerDoc(formatDoc(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={18}
              />
              <p className="text-xs text-muted-foreground mt-1">Deve ser exatamente o documento cadastrado no contrato.</p>
            </div>

            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              {geoStatus === "granted" && geo ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <MapPin className="w-3.5 h-3.5" />
                  Localização registrada ({geo.latitude.toFixed(3)}, {geo.longitude.toFixed(3)})
                </div>
              ) : (
                <button type="button" onClick={requestGeo} className="flex items-center gap-2 text-xs text-foreground hover:text-primary" disabled={geoStatus === "loading"}>
                  <MapPin className="w-3.5 h-3.5" />
                  {geoStatus === "loading" ? "Obtendo localização..." : geoStatus === "denied" ? "Localização não disponível (opcional)" : "Compartilhar minha localização (opcional)"}
                </button>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(!!v)} className="mt-0.5" />
              <span>Li integralmente o contrato e aceito todos os termos e condições.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={acceptOwnership} onCheckedChange={(v) => setAcceptOwnership(!!v)} className="mt-0.5" />
              <span>Declaro, sob as penas da lei, ser o titular do CPF/CNPJ informado e estar manifestando minha vontade livremente.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignOpen(false)}>Cancelar</Button>
            <Button onClick={handleSign} disabled={!signerName.trim() || !signerDoc.trim() || !acceptTerms || !acceptOwnership || signing}>
              {signing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Confirmar e assinar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
