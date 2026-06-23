# Substituir menções "Lovable" → "Thoth24"

Varri o projeto inteiro (`rg -i lovable`). Fora de `node_modules` e arquivos de documentação interna do guia, só restam **3 pontos** com a palavra "Lovable":

## 1. `README.md` (boilerplate padrão da Lovable)
Reescrever como README do projeto Thoth24:
- Título: `# Asaas Pay by Thoth24 — Conector Bitrix24`
- Remover seções "Use Lovable", "Edit a file directly in GitHub", "Use GitHub Codespaces", "How can I deploy" apontando para `lovable.dev`.
- Substituir por instruções enxutas: descrição do projeto, stack (Vite + React + TS + Tailwind + Supabase), como rodar local (`npm i` / `npm run dev`), link para `https://asaas.thoth24.com` e contato `contato@thoth24.com`.

## 2. `supabase/functions/asaas-test-charge/index.ts` (linha 91)
Trocar a descrição da cobrança de teste:
- De: `'Cobrança de teste - Asaas Pay by Thoth (Lovable)'`
- Para: `'Cobrança de teste - Asaas Pay by Thoth24'`

## 3. `vite.config.ts` — **NÃO alterar**
A linha `import { componentTagger } from "lovable-tagger"` é uma dependência de build do ambiente Lovable. Removê-la quebra o dev server dentro da plataforma. Como é código de build (não vai para produção/marketplace nem aparece para o usuário final no Bitrix), fica como está.

## Itens fora do escopo desta tarefa
- `LOVABLE_BITRIX24_MASTERGUIDE.md`, `BITRIX24_CONNECTOR_GUIDE.md` e `.lovable/plan.md` são docs internos de desenvolvimento — não vão para a moderação do Bitrix. Mantenho intactos.
- `index.html` já está limpo (author = Thoth24, sem og:image da Lovable).
- Favicon hospedado em `storage.googleapis.com/gpt-engineer-file-uploads/...` funciona, mas se quiser eu também movo para `/public/favicon.ico` próprio — me confirme.

## Validação
- `rg -i "lovable" --glob '!*.md' --glob '!vite.config.ts'` deve voltar vazio após as edições.

Posso aplicar?
