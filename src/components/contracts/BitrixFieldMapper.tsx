import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { BitrixFieldMap, BitrixFieldRef, useBitrixEntityFields } from "@/hooks/useContracts";

type Entity = "deal" | "lead" | "contact" | "company";
const ENTITY_LABEL: Record<Entity, string> = {
  deal: "Deal (Negócio)",
  lead: "Lead",
  contact: "Contact (Contato)",
  company: "Company (Empresa)",
};

const RESERVED = new Set([
  "valor_total", "qtd_parcelas", "parcelas_tabela", "data_contrato",
  "contratado_nome", "contratado_cnpj", "contratado_endereco", "contratado_representante", "contratado_nome_curto",
]);

interface Props {
  bodyHtml: string;
  value: BitrixFieldMap;
  onChange: (v: BitrixFieldMap) => void;
}

function FieldPicker({ entity, current, onPick }: { entity: Entity; current?: string; onPick: (field: string) => void }) {
  const { data: fields, isLoading, error } = useBitrixEntityFields(entity);
  if (isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> carregando campos…</div>;
  if (error) return <div className="text-xs text-destructive">Erro ao buscar campos do Bitrix</div>;
  return (
    <Select value={current || ""} onValueChange={onPick}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Campo do Bitrix" /></SelectTrigger>
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

export function BitrixFieldMapper({ bodyHtml, value, onChange }: Props) {
  const placeholders = useMemo(() => {
    const found = new Set<string>();
    const re = /\{\{\s*([\w_]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(bodyHtml))) found.add(m[1]);
    return Array.from(found).filter((p) => !RESERVED.has(p)).sort();
  }, [bodyHtml]);

  const mappedCount = placeholders.filter((p) => value[`{{${p}}}`]).length;

  function setEntity(placeholder: string, entity: Entity) {
    const key = `{{${placeholder}}}`;
    const existing = value[key];
    onChange({ ...value, [key]: { entity, field: existing?.entity === entity ? existing.field : "" } });
  }
  function setField(placeholder: string, field: string) {
    const key = `{{${placeholder}}}`;
    const existing = value[key];
    if (!existing?.entity) return;
    onChange({ ...value, [key]: { entity: existing.entity, field } });
  }
  function clear(placeholder: string) {
    const key = `{{${placeholder}}}`;
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  if (placeholders.length === 0) {
    return <p className="text-xs text-muted-foreground">Adicione placeholders como <code>{"{{cliente_nome}}"}</code> no corpo para mapear campos do Bitrix.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Mapeamento Bitrix</div>
        <Badge variant={mappedCount === placeholders.length ? "default" : "secondary"} className="text-[10px]">
          {mappedCount}/{placeholders.length} mapeados
        </Badge>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {placeholders.map((p) => {
          const key = `{{${p}}}`;
          const current: BitrixFieldRef | undefined = value[key];
          return (
            <div key={p} className="rounded-md border border-border p-2 space-y-1.5 bg-card">
              <div className="flex items-center justify-between gap-1">
                <code className="font-mono text-xs text-primary truncate">{`{{${p}}}`}</code>
                {current && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => clear(p)}><X className="w-3 h-3" /></Button>}
              </div>
              <Select value={current?.entity || ""} onValueChange={(v) => setEntity(p, v as Entity)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_LABEL) as Entity[]).map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">{ENTITY_LABEL[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {current?.entity && <FieldPicker entity={current.entity} current={current.field} onPick={(f) => setField(p, f)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
