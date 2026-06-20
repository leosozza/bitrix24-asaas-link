import { cn } from "@/lib/utils";

export interface ScheduleRow {
  n: number;
  tipo: string;
  vencimento: string;
  valor: number;
  metodo: string;
}

const METHOD_STYLES: Record<string, string> = {
  PIX: "bg-sky-500/15 text-sky-600",
  BOLETO: "bg-amber-500/15 text-amber-700",
  CREDIT_CARD: "bg-emerald-500/15 text-emerald-700",
  CARTAO: "bg-emerald-500/15 text-emerald-700",
  CARTÃO: "bg-emerald-500/15 text-emerald-700",
  DINHEIRO: "bg-gray-500/15 text-gray-700",
};

function formatDate(s: string) {
  if (!s) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

export function PaymentScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground">Nenhuma parcela.</p>;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {["#", "Tipo", "Vencimento", "Valor", "Método"].map((h) => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn(i % 2 === 1 && "bg-muted/30", "border-t border-border")}>
              <td className="px-3 py-2.5 text-foreground/80">{r.n}</td>
              <td className="px-3 py-2.5">{r.tipo}</td>
              <td className="px-3 py-2.5">{formatDate(r.vencimento)}</td>
              <td className="px-3 py-2.5 font-medium">{formatBRL(r.valor)}</td>
              <td className="px-3 py-2.5">
                <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide", METHOD_STYLES[(r.metodo || "").toUpperCase()] || "bg-muted text-muted-foreground")}>
                  {r.metodo}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
