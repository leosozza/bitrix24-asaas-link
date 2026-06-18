## Objetivo

Reorganizar a aba **Configurações** do iframe Bitrix (renderizada em `supabase/functions/bitrix-payment-iframe/index.ts`, ~linhas 3500–3760) para reduzir o ruído visual, deixando apenas o essencial visível e o resto em modais/colapsáveis.

## Novo layout da aba Configurações

```text
┌─────────────────────────────────────────────────────────────┐
│  [↻ Atualizar Integração]                  (topo, direita)  │
├─────────────────────────────────────────────────────────────┤
│  CABEÇALHO — Dados da Empresa                       [✏️]    │
│  Delivery Real                                              │
│  deliveryreal@hotmail.com · 41996984530                     │
│  Endereço: …                                                │
├─────────────────────────────────────────────────────────────┤
│  CARD — Asaas Conectado · Produção          [✏️ Editar]    │
│  🟢 API Asaas v3   🔵 Ambiente: Produção                    │
│  ✓ Webhook registrado automaticamente   [ℹ️ Como configurar]│
├─────────────────────────────────────────────────────────────┤
│  CARD colapsável — ⚙️ Configuração Fiscal           [▼]    │
│     (fechado por padrão; abre para editar)                  │
├─────────────────────────────────────────────────────────────┤
│  CARD — Split de Pagamento              [+ Novo Split]      │
└─────────────────────────────────────────────────────────────┘
```

O **Teste de Integração Asaas** sai daqui e vai para a aba **Integrações**.

## Modais

1. **Editar Dados da Empresa** — formulário atual (nome, email, telefone) + novo campo **Endereço**. Botão Salvar Empresa fica dentro do modal.
2. **Editar Configuração Asaas** — Ambiente + Chave API + bloco Webhook (URL, token salvo, colar token gerado pelo Asaas, lista de eventos). Botões Salvar Configuração / Salvar Token / Tentar registrar novamente ficam dentro.
3. **Como configurar o webhook (passo a passo)** — conteúdo atual do bloco azul, aberto por botão `ℹ️ Como configurar` no card Asaas.
4. **Atualizar Integração** — progresso da atualização (ver abaixo).

## Botão "Atualizar Integração" no topo

Substitui o atual "Reparar Integração Bitrix (robôs + campos)". Ao clicar abre um modal com lista de passos e estado de cada um:

```text
Atualizando integração…
  ✓ Verificando campos do Deal
  ✓ Criando campos faltantes (UF_CRM_ASAAS_*)
  ⏳ Verificando robôs de automação
  · Verificando placements (abas CRM)
  · Sincronizando Pay System
Concluído ✅
```

O edge function `bitrix-payment-iframe` já tem `repair_integration` (chamado por `repairIntegration` / `repairIntegrationFromSettings`). Vamos:
- Adicionar uma action `repair_integration_stream` (ou um novo `repair_integration_steps` que retorna `[{step, status, message}]` ao final) e, no front, exibir os passos com `setTimeout` progressivo enquanto o backend roda; ou
- Implementação simples: backend continua síncrono retornando o resumo, mas o modal mostra um stepper animado client-side (passos pré-definidos marcados sequencialmente) até a resposta chegar, e no fim mostra o resumo real ("X campos criados, Y robôs registrados, Z placements ok").

Vamos pela versão simples (stepper client-side + resumo final) — sem mudar contrato do backend.

## Endereço da Empresa

Hoje a tabela só guarda `name/email/phone`. Adicionar coluna `address text` em `bitrix_installations` (ou na tabela onde os dados da empresa são salvos — confirmar lendo `handleCompanySave`) via `supabase--migration`, incluir no payload do `company_save` e no `loadSettings`.

## Arquivos a editar

- `supabase/functions/bitrix-payment-iframe/index.ts`
  - `generateSettingsTab` (HTML) — novo layout, cards colapsáveis, botões que abrem modais.
  - Adicionar markup dos 4 modais + CSS de modal (já existe `.modal` no arquivo? verificar; se não, adicionar estilos simples).
  - JS: `openCompanyModal()`, `openAsaasModal()`, `openWebhookHelpModal()`, `openUpdateIntegrationModal()` + stepper.
  - Mover renderização de "Teste de Integração Asaas" para `generateIntegrationsTab`.
  - `company_save`: aceitar e gravar `address`.
- Migração SQL: `ALTER TABLE bitrix_installations ADD COLUMN IF NOT EXISTS company_address text;` (ou na tabela correta).

## Fora de escopo

- Redesign visual além de cards/modais (sem mudar paleta).
- Refatorar o teste de integração em si — só muda de aba.
- Tornar o "Atualizar Integração" verdadeiramente streaming (SSE) — fica como melhoria futura; usaremos stepper client-side.

## Validação

1. Abrir aba Configurações dentro do Bitrix: ver cabeçalho com Delivery Real, card Asaas resumido, Fiscal colapsado, Split.
2. Clicar no lápis de Empresa → modal abre com dados pré-preenchidos → salvar persiste endereço.
3. Clicar em Editar no card Asaas → modal mostra Ambiente, Chave API e bloco Webhook.
4. Clicar em "ℹ️ Como configurar" → modal com passo a passo.
5. Clicar em "Atualizar Integração" no topo → modal com stepper anima, ao final mostra resumo de campos/robôs criados (toast + lista).
6. Aba Integrações agora exibe o card "Teste de Integração Asaas".
