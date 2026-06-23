
## Objetivo

Criar 4 novas rotas públicas no app, no padrão visual azul royal (#1E48D6) da landing, e entregar os textos prontos (Descrição completa, Palavras-chave, Descrição da instalação, Informações de suporte) para o formulário do Bitrix24 Marketplace.

**Dados oficiais Thoth24 usados em todas as páginas:**
- CNPJ: 54.727.112/0001-78
- Razão social: Thoth24
- Email: contato@thoth24.com
- Domínio: https://asaas.thoth24.com

## Páginas a criar

Todas usando o `Header` + `Footer` da landing, container centralizado, tipografia e tokens já existentes (`bg-primary`, `text-primary`, azul royal `#1E48D6`). Cada página adiciona `<Helmet>` com title/description próprios (instalar `react-helmet-async` se ainda não estiver).

### 1. `src/pages/Eula.tsx` — rota `/eula`
EULA (Contrato de Licença de Usuário Final) com seções:
1. Definições (Thoth24, Aplicativo, Usuário, Bitrix24, Asaas)
2. Objeto da licença (uso não exclusivo, intransferível)
3. Cadastro e conta
4. Planos, pagamentos e período de teste
5. Obrigações do usuário (uso lícito, credenciais Asaas próprias)
6. Propriedade intelectual (código pertence à Thoth24)
7. Limitação de responsabilidade
8. Suspensão e rescisão
9. Atualizações do aplicativo
10. Foro (Comarca da sede da Thoth24) e legislação brasileira
Rodapé: "Thoth24 — CNPJ 54.727.112/0001-78 — contato@thoth24.com — Última atualização: 23/06/2026"

### 2. `src/pages/Privacidade.tsx` — rota `/privacidade`
Política de Privacidade compatível com LGPD:
1. Controlador (Thoth24, CNPJ, email DPO: contato@thoth24.com)
2. Dados coletados (cadastro, dados Bitrix24 via OAuth, dados Asaas via API key, dados de cobrança dos clientes finais do tenant)
3. Finalidade (operar a integração, emitir cobranças, NFSe, automações)
4. Base legal (execução de contrato, legítimo interesse, consentimento)
5. Compartilhamento (Asaas, Bitrix24, infraestrutura Supabase/Lovable Cloud)
6. Armazenamento e segurança (RLS, criptografia, isolamento por tenant)
7. Retenção (durante vigência + 5 anos fiscais)
8. Direitos do titular (acesso, correção, exclusão, portabilidade)
9. Cookies (somente essenciais de sessão)
10. Contato do encarregado

### 3. `src/pages/Suporte.tsx` — rota `/suporte`
Página de suporte com:
- Hero curto "Como podemos ajudar?"
- 3 cards: Email (`contato@thoth24.com`), WhatsApp (placeholder — usar `contato@thoth24.com` enquanto não houver número), Central de Ajuda (link para `/eula` e `/privacidade`)
- FAQ rápido (4 perguntas reaproveitadas da landing)
- SLA de resposta: dias úteis, até 24h
- Bloco "Empresa": Thoth24, CNPJ 54.727.112/0001-78

### 4. `src/pages/Demo.tsx` — rota `/demo`
Página de solicitação de demo:
- Hero "Agende uma demonstração ao vivo"
- Formulário (nome, empresa, email, telefone, portal Bitrix24, mensagem) que dispara `mailto:contato@thoth24.com` com corpo pré-formatado (sem backend novo — mantém escopo mínimo)
- Bloco lateral: o que será mostrado (PIX, Boleto, Cartão, Assinaturas, NFSe, Automações)
- Contato direto: contato@thoth24.com

## Integração de rotas

Em `src/App.tsx`, adicionar 4 `<Route>` públicas (fora de `ProtectedRoute`) apontando para os novos componentes.

Em `src/components/landing/Footer.tsx`, garantir que os links de EULA, Privacidade, Suporte e Demo apontem para as novas rotas internas (`<Link to="/eula">` etc.), substituindo âncoras `#` se existirem.

## Setup técnico

- Verificar se `react-helmet-async` já está instalado; se não, `bun add react-helmet-async` e envolver `<App />` em `<HelmetProvider>` em `src/main.tsx`.
- Nenhuma mudança de backend, schema ou edge function.

## Entregáveis de texto para o formulário Marketplace

Junto com as páginas, vou entregar no chat (prontos para copiar/colar) os 4 blocos do formulário visível no screenshot:

1. **Descrição completa** (~1500 chars) — descrição rica do conector Asaas + Bitrix24, recursos (PIX/Boleto/Cartão, assinaturas, NFSe, robôs Bizproc, split, webhook), benefícios e diferenciais Thoth24.
2. **Palavras-chave de pesquisa** (lista separada por vírgula, < 2000 chars) — asaas, pagamentos, pix, boleto, cartão de crédito, cobrança, assinatura recorrente, nfse, nota fiscal de serviço, bizproc, automação, crm, bitrix24, integração financeira, gateway de pagamento, split de pagamento, conector asaas, recebíveis, thoth24, etc.
3. **Descrição da instalação** — passo a passo: instalar pelo Marketplace → abrir o app no Bitrix24 → informar API key Asaas (produção/sandbox) → salvar → o app registra automaticamente webhook, pay system, robôs e aba CRM.
4. **Informações de suporte e contatos** — Thoth24 / CNPJ 54.727.112/0001-78 / contato@thoth24.com / https://asaas.thoth24.com/suporte / SLA dias úteis até 24h / links para EULA e Privacidade.

## Validação

- Abrir `/eula`, `/privacidade`, `/suporte`, `/demo` direto na URL — devem renderizar com Header+Footer azul royal, sem 404.
- Footer da landing leva às novas rotas.
- Formulário de `/demo` abre o cliente de email com destino `contato@thoth24.com`.

Posso aplicar?
