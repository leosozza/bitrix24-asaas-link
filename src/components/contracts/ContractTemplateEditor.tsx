import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight,
  Table as TableIcon, Image as ImageIcon, Link as LinkIcon, Minus,
  Undo, Redo, Code,
} from "lucide-react";

const BLOCKS: { label: string; html: string }[] = [
  {
    label: "Cabeçalho com logo",
    html: `<div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:24px;">
<img src="https://via.placeholder.com/120x40?text=LOGO" style="height:40px;margin-bottom:8px;" alt="logo" />
<h1 style="margin:0;color:#1e40af;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
</div>`,
  },
  {
    label: "Cláusula numerada",
    html: `<h2>Cláusula X — Título</h2><p>Conteúdo da cláusula aqui.</p>`,
  },
  {
    label: "Tabela de parcelas",
    html: `<p>{{parcelas_tabela}}</p>`,
  },
  {
    label: "Bloco de pagamento Asaas",
    html: `<h2>Pagamento</h2>
<p>Valor total: <strong>{{valor_total}}</strong></p>
<p>Parcelas: {{qtd_parcelas}}</p>
{{parcelas_tabela}}`,
  },
  {
    label: "Dados das partes",
    html: `<p><strong>CONTRATADO:</strong> {{contratado_nome}}, CNPJ {{contratado_cnpj}}.</p>
<p><strong>CONTRATANTE:</strong> {{cliente_nome}}, CPF/CNPJ {{cliente_doc}}, endereço {{cliente_endereco}}.</p>`,
  },
  {
    label: "Assinatura",
    html: `<div style="margin-top:64px;display:flex;justify-content:space-around;gap:24px;">
<div style="text-align:center;flex:1;border-top:1px solid #333;padding-top:8px;">{{contratado_nome}}<br/><small>CONTRATADO</small></div>
<div style="text-align:center;flex:1;border-top:1px solid #333;padding-top:8px;">{{cliente_nome}}<br/><small>CONTRATANTE</small></div>
</div>`,
  },
  {
    label: "Foro",
    html: `<h2>Foro</h2><p>Fica eleito o foro da cidade de {{foro_cidade}} para dirimir conflitos oriundos deste contrato.</p>`,
  },
];

const VARIABLES = [
  { group: "Cliente (Bitrix)", items: [
    ["{{cliente_nome}}", "Nome"], ["{{cliente_doc}}", "CPF/CNPJ"], ["{{cliente_email}}", "E-mail"],
    ["{{cliente_telefone}}", "Telefone"], ["{{cliente_endereco}}", "Endereço"], ["{{cliente_empresa}}", "Empresa"],
  ]},
  { group: "Contrato", items: [
    ["{{valor_total}}", "Valor"], ["{{qtd_parcelas}}", "Parcelas"], ["{{parcelas_tabela}}", "Tabela parcelas"],
    ["{{prazo_contrato}}", "Prazo"], ["{{data_contrato}}", "Data"], ["{{vendedor}}", "Vendedor"],
  ]},
  { group: "Contratado", items: [
    ["{{contratado_nome}}", "Nome"], ["{{contratado_cnpj}}", "CNPJ"], ["{{foro_cidade}}", "Foro"],
  ]},
];

function ToolbarButton({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-muted ${active ? "bg-primary/15 text-primary" : "text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border border-border rounded-md p-1 bg-card sticky top-0 z-10">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrito"><Bold className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálico"><Italic className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado"><UnderlineIcon className="w-4 h-4" /></ToolbarButton>
      <div className="w-px h-5 bg-border mx-0.5" />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Título 1"><Heading1 className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Título 2"><Heading2 className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Título 3"><Heading3 className="w-4 h-4" /></ToolbarButton>
      <div className="w-px h-5 bg-border mx-0.5" />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista"><List className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numerada"><ListOrdered className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citação"><Quote className="w-4 h-4" /></ToolbarButton>
      <div className="w-px h-5 bg-border mx-0.5" />
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Esquerda"><AlignLeft className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centro"><AlignCenter className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Direita"><AlignRight className="w-4 h-4" /></ToolbarButton>
      <div className="w-px h-5 bg-border mx-0.5" />
      <input
        type="color"
        title="Cor do texto"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        className="w-7 h-7 p-0.5 rounded cursor-pointer border border-border"
      />
      <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Inserir tabela"><TableIcon className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => {
        const url = prompt("URL da imagem:");
        if (url) editor.chain().focus().setImage({ src: url }).run();
      }} title="Imagem"><ImageIcon className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => {
        const url = prompt("URL do link:");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }} active={editor.isActive("link")} title="Link"><LinkIcon className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divisor"><Minus className="w-4 h-4" /></ToolbarButton>
      <div className="w-px h-5 bg-border mx-0.5" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo className="w-4 h-4" /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo className="w-4 h-4" /></ToolbarButton>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export function ContractTemplateEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [zoom, setZoom] = useState(1);
  const valueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "tiptap-table" } }),
      TableRow, TableCell, TableHeader,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Comece a digitar seu contrato…" }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      valueRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "docx-page",
      },
    },
  });


  // sync external value -> editor
  useEffect(() => {
    if (editor && value !== valueRef.current) {
      valueRef.current = value;
      editor.commands.setContent(value || "");
      setHtmlDraft(value);
    }
  }, [value, editor]);

  function insertHtml(html: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(html).run();
  }

  function insertVar(code: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`<span style="background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:4px;font-family:monospace;font-size:.85em;">${code}</span>&nbsp;`).run();
  }

  function applyHtmlDraft() {
    onChange(htmlDraft);
    if (editor) editor.commands.setContent(htmlDraft);
    setMode("visual");
  }

  return (
    <div className="grid lg:grid-cols-[1fr_220px] gap-3">
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button type="button" onClick={() => setMode("visual")} className={`px-3 py-1 ${mode === "visual" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>Visual</button>
            <button type="button" onClick={() => { setHtmlDraft(valueRef.current); setMode("html"); }} className={`px-3 py-1 ${mode === "html" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}><Code className="w-3 h-3 inline mr-1" />HTML</button>
          </div>
        </div>

        {mode === "visual" ? (
          <>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
          </>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={24}
              value={htmlDraft}
              onChange={(e) => setHtmlDraft(e.target.value)}
              className="w-full font-mono text-xs p-3 bg-background border border-border rounded-md"
            />
            <Button size="sm" type="button" onClick={applyHtmlDraft}>Aplicar HTML</Button>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Blocos prontos</p>
          <div className="space-y-1">
            {BLOCKS.map((b) => (
              <button key={b.label} type="button" onClick={() => insertHtml(b.html)} className="w-full text-left px-2 py-1.5 text-xs rounded border border-border hover:bg-muted hover:border-primary/40 transition">
                + {b.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Variáveis</p>
          <div className="space-y-2">
            {VARIABLES.map((g) => (
              <div key={g.group}>
                <p className="text-[10px] text-muted-foreground mb-1">{g.group}</p>
                <div className="flex flex-wrap gap-1">
                  {g.items.map(([code, label]) => (
                    <button key={code} type="button" onClick={() => insertVar(code)} title={code} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary hover:bg-primary/20 font-mono">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
