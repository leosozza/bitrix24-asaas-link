# Landing 100% no azul royal + logos novos

Padronizar toda a landing no token `--primary` (azul royal `#1E48D6`) e substituir as marcas montadas (quadrados com "A"/"T"/"B+A") pelos dois logos oficiais enviados.

## 1. Subir os dois logos como assets

- `IMG_0769.jpeg` (azul sobre branco) → `src/assets/asaas-pay-thoth-logo.png.asset.json` — usado em fundos claros (Header, Auth, Sidebar dashboard).
- `IMG_0770.jpeg` (branco sobre azul) → `src/assets/asaas-pay-thoth-logo-white.png.asset.json` — usado em fundos escuros (Footer, CTA azul).

> Subir via `lovable-assets create` direto de `/mnt/user-uploads/`, sem copiar binário pro repo. Importar como JSON e usar `.url`.

## 2. Trocar a marca em 4 lugares

**`src/components/landing/Header.tsx`** (linhas 14–22): remover quadradinho `A` + texto "Asaas Pay by Thoth24". Renderizar `<img src={logo.url} alt="Asaas Pay by Thoth24" className="h-9 md:h-10 w-auto" />`.

**`src/components/landing/Footer.tsx`** (linhas 11–17): trocar quadradinho `T` + texto pelo logo branco (`h-10 w-auto`).

**`src/pages/Auth.tsx`** (linhas 49–53): trocar `<Zap>` + "Asaas Pay by Thoth24" pelo logo azul (`h-10 w-auto`).

**`src/components/dashboard/DashboardSidebar.tsx`** (linhas 63–73): quando expandido, mostrar o logo azul. Quando colapsado (`collapsed === true`), mostrar apenas a marca quadrada favicon (`/favicon.png` que já existe no `public/`).

## 3. Limpar variações de cor na landing

**`src/components/landing/Hero.tsx`:**
- Linha 32–34: trocar `<span className="text-bitrix">Bitrix24</span>` e `<span className="text-asaas">Asaas</span>` para `text-primary` (palavras destacadas ficam no mesmo azul).
- Linha 95 e 99: substituir gradients hard-coded `from-[hsl(195,91%,57%)]` e `to-[hsl(155,100%,33%)]` por `from-primary/30 to-primary` e `from-primary to-primary/30`.
- Trocar **todos** os `text-accent` / `bg-accent/*` (linhas 60, 64, 68, 119, 122, 139, 140, 144) por `text-primary` / `bg-primary/*` — landing fica monocromática no azul.
- Linha 15: `bg-accent/5` → `bg-primary/5`.

**`src/components/landing/Features.tsx`:**
- Remover o toggle `color: 'accent' | 'primary'` no array `features` (linhas 17, 23, 29, 35, 41, 47, 53, 59).
- Linhas 99–100: usar sempre `bg-primary/10` + `text-primary`.
- Linha 77: badge "Recursos" usa `bg-primary/10 text-primary` em vez de accent.

**`src/components/landing/Pricing.tsx`** (linhas 125, 127): check icon e fundo → `bg-primary/10` / `text-primary` (mantém o destaque do "popular" usando `bg-primary/20` em vez de accent).

**`src/components/landing/FAQ.tsx`** (linha 49): badge "FAQ" → `bg-primary/10 text-primary`.

**`src/components/landing/CTA.tsx`** (linha 14): `bg-accent/10` blur → `bg-primary/15`.

## 4. Fora de escopo
- Não removo o token `--accent` do `index.css` (já é azul-family e usado em dashboard/forms — segue como variação clara do primary fora da landing).
- Status semânticos (`--success` verde para "Pago") permanecem.
- Logos antigos `bitrix24-logo.png` e `asaas-logo.png` continuam sendo usados **dentro do card de integração do Hero** (mostram tecnicamente quem está sendo conectado — é informação, não marca do produto).

## Validação
- `rg "text-accent|bg-accent|text-bitrix|text-asaas|hsl\(" src/components/landing src/pages/Auth.tsx` → vazio.
- Inspeção visual: Header, Hero, Features, Pricing, FAQ, CTA, Footer, Auth e Sidebar todos no mesmo azul royal.

Aplico?
