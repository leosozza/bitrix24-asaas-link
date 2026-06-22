import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export type ChargeMode = "unica" | "parcelada" | "assinatura_mensal";
export type BillingType = "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasPaymentConfig {
  mode: ChargeMode;
  billingType: BillingType;
  value: number;
  dueDate: string;
  installmentCount: number;
  cycle: "MONTHLY" | "WEEKLY" | "QUARTERLY" | "YEARLY";
  maxPayments?: number;
  autoCreate: boolean;
  customer: {
    name: string;
    cpfCnpj: string;
    email: string;
    mobilePhone: string;
    postalCode: string;
    address: string;
    addressNumber: string;
    province: string;
  };
  fromBitrixKeys: string[];
}

interface Props {
  value: AsaasPaymentConfig;
  onChange: (v: AsaasPaymentConfig) => void;
}

const BILLING_OPTIONS: Array<{ v: BillingType; l: string }> = [
  { v: "PIX", l: "PIX" },
  { v: "BOLETO", l: "Boleto" },
  { v: "CREDIT_CARD", l: "Cartão de crédito" },
  { v: "UNDEFINED", l: "Cliente escolhe no link" },
];

export function AsaasPaymentStep({ value, onChange }: Props) {
  const set = <K extends keyof AsaasPaymentConfig>(k: K, v: AsaasPaymentConfig[K]) => onChange({ ...value, [k]: v });
  const setCustomer = (patch: Partial<AsaasPaymentConfig["customer"]>) =>
    onChange({ ...value, customer: { ...value.customer, ...patch } });

  const fromBitrix = (k: string) => value.fromBitrixKeys.includes(k);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-semibold text-sm">Tipo de cobrança</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: "unica", l: "Única" },
            { v: "parcelada", l: "Parcelada" },
            { v: "assinatura_mensal", l: "Assinatura recorrente" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => set("mode", o.v as ChargeMode)}
              className={`p-3 rounded-md border text-sm transition-colors ${
                value.mode === o.v ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={value.billingType} onValueChange={(v) => set("billingType", v as BillingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{value.mode === "assinatura_mensal" ? "Próxima cobrança" : "1º vencimento"}</Label>
            <Input type="date" value={value.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Valor {value.mode === "parcelada" ? "por parcela (R$)" : value.mode === "assinatura_mensal" ? "mensal (R$)" : "(R$)"}</Label>
            <Input type="number" step="0.01" value={value.value} onChange={(e) => set("value", +e.target.value)} />
          </div>

          {value.mode === "parcelada" && (
            <div>
              <Label className="text-xs">Nº de parcelas</Label>
              <Input type="number" min={2} value={value.installmentCount} onChange={(e) => set("installmentCount", +e.target.value)} />
            </div>
          )}
          {value.mode === "assinatura_mensal" && (
            <>
              <div>
                <Label className="text-xs">Ciclo</Label>
                <Select value={value.cycle} onValueChange={(v) => set("cycle", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                    <SelectItem value="YEARLY">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Máximo de cobranças (opcional)</Label>
                <Input type="number" min={0} value={value.maxPayments ?? 0} onChange={(e) => set("maxPayments", +e.target.value || undefined)} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Switch checked={value.autoCreate} onCheckedChange={(v) => set("autoCreate", v)} />
          <Label className="text-sm">Criar cobrança automaticamente quando o cliente assinar</Label>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">Dados do cliente (Asaas)</div>
          {value.fromBitrixKeys.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{value.fromBitrixKeys.length} vindo(s) do Bitrix</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { k: "name", l: "Nome / Razão social *", col: 2 },
            { k: "cpfCnpj", l: "CPF / CNPJ *" },
            { k: "email", l: "E-mail" },
            { k: "mobilePhone", l: "Celular" },
            { k: "postalCode", l: "CEP" },
            { k: "address", l: "Logradouro" },
            { k: "addressNumber", l: "Número" },
            { k: "province", l: "Bairro / Cidade" },
          ].map((f) => (
            <div key={f.k} className={f.col === 2 ? "md:col-span-2" : ""}>
              <Label className="text-xs flex items-center gap-2">
                {f.l}
                {fromBitrix(f.k) && <span className="text-[9px] uppercase text-primary">Bitrix</span>}
              </Label>
              <Input
                value={(value.customer as any)[f.k] || ""}
                onChange={(e) => setCustomer({ [f.k]: e.target.value } as any)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
