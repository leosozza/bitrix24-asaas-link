# Assinatura eletrônica avançada — Lei 14.063/2020 (DOC-ICP-15 nível básico)

## Contexto

Hoje a assinatura captura apenas nome + IP + UA + hash de metadados. Para se qualificar como **assinatura eletrônica avançada** (Lei 14.063, art. 4º, II) precisamos de:

1. Vínculo unívoco entre assinante e assinatura
2. Capacidade de identificar o assinante
3. Controle exclusivo do meio de assinatura
4. Detecção de qualquer alteração posterior no documento

Como o envio de OTP por e-mail/SMS é feito pelo Bitrix (não pelo nosso sistema), o segundo fator será **validação do CPF/CNPJ** do contrato, combinada a evidências adicionais.

---

## Fluxo de assinatura (público `/contrato/:token`)

```text
1. Cliente abre o link  →  registra viewed_at + IP + UA + Accept-Language + timezone
2. Clica "Assinar"
3. Modal pede:
   • Nome completo
   • CPF ou CNPJ (deve bater com customer_doc do contrato, normalizando)
   • Permissão de geolocalização (opcional, mas registrada se aceita)
   • Checkbox "Li e aceito os termos"
   • Checkbox "Declaro, sob as penas da lei, ser o titular do documento informado"
4. Envia POST → backend valida:
   • CPF/CNPJ confere (normalizado, só dígitos)
   • Hash do documento (rendered_html) calculado e armazenado
   • Status muda para "signed"
5. Tela exibe bloco verde "Assinado" + botão "Baixar PDF assinado"
```

Se o CPF não bater: erro "Documento informado não confere com o titular do contrato" e contador de tentativas (`signature_attempts`), bloqueio após 5.

---

## Bloco de evidências no PDF assinado

Anexado ao final do contrato (substitui o bloco atual):

```text
─────────────────────────────────────────────────
ASSINATURA ELETRÔNICA AVANÇADA — Lei 14.063/2020
─────────────────────────────────────────────────
Signatário:        João da Silva
Documento:         123.***.***-90  (validado)
Data e hora:       20/06/2026 14:32:11 (UTC-03:00, fuso America/Sao_Paulo)
IP de origem:      189.45.xx.xx
Navegador:         Chrome 142 / macOS 14
Idioma do cliente: pt-BR
Geolocalização:    -23.5505, -46.6333  (precisão 35m)  [ou "não autorizada"]
Token público:     7f3a...e92c
Hash SHA-256 do documento:
  9a7c4f8e2b1d6033a5b8f1e7c0d2e9a4b6f3c5d8e1a0b2c4d6e8f0a1b3c5d7e9
Identificador da evidência:
  ev_01HX...  (UUID v7)

Este documento foi assinado eletronicamente conforme art. 4º, II da
Lei 14.063/2020. Qualquer alteração posterior invalidará o hash acima.
─────────────────────────────────────────────────
```

---

## Mudanças técnicas

### 1. Migration — tabela `contracts`

Adicionar colunas:
- `document_hash` text — SHA-256 do `rendered_html` no momento da assinatura
- `signature_evidence` jsonb — trilha completa (timezone, accept-language, geolocation, screen, plataforma, attempts, etc.)
- `signature_attempts` int default 0
- `signature_doc_masked` text — CPF/CNPJ mascarado para exibição
- Manter `signature_hash` como hash da própria assinatura (token+doc+ip+timestamp)

### 2. `supabase/functions/contract-public/index.ts`

- POST `action=sign` passa a exigir `customer_doc` no body
- Normaliza ambos (só dígitos) e compara com `contract.customer_doc`
- Se não bater → incrementa `signature_attempts`, retorna 422
- Se ≥ 5 tentativas → 429 e bloqueia
- Calcula `document_hash = SHA-256(rendered_html_pre_signature)`
- Monta `signature_evidence` com headers + body fields (geo, tz, locale, screen)
- Substitui bloco simples atual pelo novo bloco de evidências (formato acima)
- Atualiza Bitrix mantendo lógica existente

### 3. `src/pages/PublicContract.tsx`

- Modal de assinatura ganha:
  - Input CPF/CNPJ com máscara (`@/lib/utils` para formatar)
  - Botão "Compartilhar minha localização" (opcional) — usa `navigator.geolocation`
  - Segundo checkbox de declaração de titularidade
  - Coleta `Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.language`, `screen.width/height`, `navigator.platform`
- Mensagem de erro específica para CPF inválido
- Após assinar, mostra evidências resumidas na tela

### 4. `src/integrations/supabase/types.ts`

Regenerado automaticamente após migration.

### 5. Nenhuma mudança em

- `contract-generate` — só gera, não assina
- `bitrix-contract-robot` — idem
- `bitrix-contract-setup` — campos do CRM continuam iguais

---

## O que NÃO é coberto neste plano (deixar explícito)

- **Não é assinatura qualificada ICP-Brasil** (não há certificado digital A1/A3)
- Não há **carimbo do tempo** de Autoridade de Carimbo do Tempo (ACT) — usamos `now()` do servidor
- Não há assinatura **PAdES** embutida no PDF (o PDF é gerado client-side via `window.print()`)

Esses pontos exigiriam provedor externo (Clicksign/D4Sign) ou certificado ICP-Brasil — fora do escopo escolhido (nível 1 da pergunta anterior).

---

## Arquivos

**Editar:**
- `supabase/functions/contract-public/index.ts`
- `src/pages/PublicContract.tsx`

**Criar:**
- `supabase/migrations/<timestamp>_contract_advanced_signature.sql`
