import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { BitrixFieldMap, BitrixFieldRef, useBitrixEntityFields } from "@/hooks/useContracts";

type Entity = "deal" | "lead" | "contact" | "company";
const ENTITY_LABEL: Record<Entity, string> = {
  deal: "Deal",
  lead: "Lead",
  contact: "Contact",
  company: "Company",
};

const ASAAS_FIELDS: Array<{ key: string; label: string; required?: boolean; hint?: string }> = [
  { key: "name", label: "Nome / Razão social", required: true },
  { key: "cpfCnpj", label: "CPF / CNPJ", required: true },
  { key: "email", label: "E-mail" },
  { key: "mobilePhone", label: "Celular" },
  { key: "postalCode", label: "CEP" },
  { key: "address", label: "Endereço (logradouro)" },
  { key: "addressNumber", label: "Número" },
  { key: "province", label: "Bairro / Cidade" },
];

function FieldPicker({ entity, current, onPick }: { entity: Entity; current?: string; onPick: (field: string) => void }) {
  const { data: fields, isLoading, error } = useBitrixEntityFields(entity);
  if (isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> carregando…</div>;
  if (error) return <div className="text-xs text-destructive">Erro ao carregar campos</div>;
  return (
    <Select value={current || ""} onValueChange={onPick}>
      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Campo do Bitrix" /></SelectTrigger>
      <SelectContent className="max-h-72">
        {fields?.map((f) => (
          <SelectItem key={f.id} value={f.id} className="text-xs">
            <span className={f.is_custom ? "text-primary" : ""}>{f.label}</span>
            <span className="text-muted-foreground ml-2">({f.id})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Props {
  value: BitrixFieldMap;
  onChange: (v: BitrixFieldMap) => void;
}

export function AsaasBillingFieldMapper({ value, onChange }: Props) {
  const mapped = ASAAS_FIELDS.filter((f) => value[f.key]?.field).length;

  function setEntity(key: string, entity: Entity) {
    const existing = value[key];
    onChange({ ...value, [key]: { entity, field: existing?.entity === entity ? existing.field : "" } });
  }
  function setField(key: string, field: string) {
    const existing = value[key];
    if (!existing?.entity) return;
    onChange({ ...value, [key]: { entity: existing.entity, field } });
  }
  function clear(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Cobrança Asaas</div>
        <Badge variant={mapped === ASAAS_FIELDS.length ? "default" : "secondary"} className="text-[10px]">
          {mapped}/{ASAAS_FIELDS.length}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">Mapeie de qual entidade do Bitrix vem cada campo enviado ao Asaas ao gerar a cobrança.</p>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {ASAAS_FIELDS.map((f) => {
          const current: BitrixFieldRef | undefined = value[f.key];
          return (
            <div key={f.key} className={`rounded-md border p-2 space-y-1.5 bg-card ${f.required ? "border-amber-400/40" : "border-border"}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="text-xs">
                  <code className="font-mono text-primary">{f.key}</code>
                  {f.required && <span className="ml-1 text-[10px] text-amber-600 font-semibold">obrigatório</span>}
                  <div className="text-[10px] text-muted-foreground">{f.label}</div>
                </div>
                {current && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => clear(f.key)}><X className="w-3 h-3" /></Button>}
              </div>
              <Select value={current?.entity || ""} onValueChange={(v) => setEntity(f.key, v as Entity)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_LABEL) as Entity[]).map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">{ENTITY_LABEL[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {current?.entity && <FieldPicker entity={current.entity} current={current.field} onPick={(v) => setField(f.key, v)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
