# Padronizar a interface no azul royal do logo

O logo Asaas Pay by Thoth24 usa um **azul royal vibrante** (aprox. `#1E48D6` → HSL `225 75% 48%`) sobre branco/azul cheio. Hoje o `src/index.css` usa `220 90% 45%` como primary e mistura **verde Asaas** como `accent` em vários cantos — isso quebra a unidade visual que você quer.

## Mudanças

### 1. `src/index.css` — re-tokenizar a paleta (light + dark)
Atualizar os tokens HSL para alinhar com o azul royal do logo:

**Light:**
- `--primary: 225 75% 48%` (azul royal exato do logo)
- `--primary-foreground: 0 0% 100%`
- `--ring: 225 75% 48%`
- `--accent: 225 90% 58%` (era verde — vira azul mais claro/luminoso, mantendo contraste visual sem fugir da família)
- `--accent-foreground: 0 0% 100%`
- `--secondary: 225 35% 95%` (cinza-azulado mais frio, puxando o azul)
- `--muted: 225 25% 95%`
- `--border / --input: 225 25% 90%`
- `--background: 225 30% 98%` (branco com leve tom azul, como o fundo do logo claro)
- `--foreground: 225 50% 12%` (preto-azulado)
- `--gradient-primary: linear-gradient(135deg, hsl(225 75% 48%) 0%, hsl(230 80% 58%) 100%)` (azul→azul, sem indigo/roxo)
- `--gradient-accent`: idem, variações do mesmo azul (substitui o verde)
- `--gradient-hero: linear-gradient(180deg, hsl(225 30% 98%) 0%, hsl(225 40% 94%) 100%)`
- `--shadow-glow: 0 0 40px hsl(225 75% 48% / 0.25)`
- `--shadow-glow-accent`: remapeado para o mesmo azul

**Manter como exceção semântica** (não são cor de marca, são sinais funcionais):
- `--success: 155 65% 40%` (verde — feedback de pagamento confirmado)
- `--warning: 38 92% 50%` (amarelo)
- `--destructive: 0 84% 60%` (vermelho)

**Dark:** mesma família shift, primary `225 80% 60%`, background `225 45% 7%`, cards `225 40% 10%`, sidebar tokens realinhados para a família 225.

### 2. `src/components/landing/Header.tsx` (linha ~20)
O quadradinho do logo hoje é texto "B+A" com gradiente. Trocar por mini-marca consistente:
- Quadrado azul royal (`bg-primary`) com a letra **T** branca (ou ícone wallet `Wallet` do lucide), arredondado.
- Cor exclusiva via token `bg-primary text-primary-foreground` (sem `bg-gradient-to-br from-blue-500 to-green-500` ou similar).

### 3. `src/components/landing/Footer.tsx` (linha ~12)
Mesma substituição da marca quadrada (sem "B+A" verde-azul).

### 4. Sweep de cores hard-coded
Varrer `src/` e remover quaisquer utilitários hard-coded que ainda quebrem o tom:
- `text-green-*`, `bg-green-*`, `from-green-*`, `to-green-*` em componentes de marca/landing (badges de "sucesso" funcional ficam — passam a usar `text-success`)
- `from-blue-* to-purple-*`, `from-indigo-*` em gradients de hero/CTA → trocar por `bg-gradient-primary` (token)
- Qualquer `bg-[#...]` ou `text-[#...]` hard-coded em landing/dashboard/auth.

Lista alvo (será confirmada por `rg`): `Hero.tsx`, `Features.tsx`, `CTA.tsx`, `Pricing.tsx`, `FAQ.tsx`, `DashboardSidebar.tsx`, `StatsCard.tsx`, `IntegrationCard.tsx`, `Auth.tsx`.

### 5. Iframe Bitrix
Os componentes do iframe Bitrix (`bitrix-payment-iframe`, `bitrix-crm-detail-tab`, dashboard hub) também usam o mesmo `index.css`, então herdam a paleta automaticamente. Apenas valido visualmente que badges/CTAs ali não tenham `style="color:#..."` inline com outra cor.

## Fora de escopo
- **Não** mexo no logotipo gerado nem na og-image (já estão azuis e batem com a paleta).
- **Não** removo o verde dos status "Pago / Aprovado" — verde semântico de pagamento confirmado é convenção universal e está isolado no token `--success`.

## Validação
- `rg "text-green-|bg-green-|from-green-|to-green-|from-purple|to-purple|from-indigo|bg-\[#" src` → não pode voltar nada em landing/auth/dashboard fora dos tokens semânticos.
- Inspeção visual da home, dashboard, auth e iframe em dark + light.

Aplico?
