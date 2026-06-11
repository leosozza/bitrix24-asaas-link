## Objetivo

Atualizar o bloco "Webhook Asaas" da aba Configurações (iframe Bitrix) para deixar claro qual é a versão da API usada e como o usuário configura o webhook manualmente no painel do Asaas, caso o registro automático falhe.

## Versão da API

Hoje o conector usa a **API REST do Asaas v3** em todas as edge functions:
- Produção: `https://api.asaas.com/v3`
- Sandbox: `https://sandbox.asaas.com/api/v3`

Essa informação será destacada no bloco do webhook.

## Mudanças

Arquivo único: `supabase/functions/bitrix-payment-iframe/index.ts` — função `renderWebhookBlock()`.

1. **Cabeçalho informativo**
   - Adicionar uma linha com badge: `API Asaas v3` (esverdeada).
   - Mostrar o ambiente atual (Sandbox/Produção) ao lado.

2. **Passo a passo expandido (substitui o `<details>` atual)**
   Lista numerada visível por padrão, com 8 passos:
   1. Acessar `https://www.asaas.com/login` e entrar na sua conta.
   2. Menu lateral → **Integrações** → aba **Webhooks** (em contas antigas: **Configurações → Notificações via Webhook**).
   3. Clicar em **+ Novo Webhook**.
   4. Em **Nome**, usar algo como "Bitrix24 Asaas Connector".
   5. Colar a URL do webhook (botão Copiar acima) no campo **URL**.
   6. Colar o Token (botão Copiar acima) no campo **Token de autenticação** (header `asaas-access-token`).
   7. Configurações obrigatórias:
      - **E-mail para notificação de erros**: o e-mail da empresa cadastrado acima.
      - **Versão da API**: **v3**.
      - **Envio**: **Sequencial** (recomendado).
      - **Status**: **Ativo / Habilitado**.
   8. Em **Eventos**, marcar todos os eventos da lista acima (pagamentos, assinaturas e notas fiscais) e clicar em **Salvar**.

3. **Link direto** para a documentação oficial do webhook Asaas:
   - `https://docs.asaas.com/docs/webhooks` (abre em nova aba).

4. **Dica de validação**
   - Pequena nota: "Após salvar no Asaas, gere uma cobrança de teste no Sandbox para validar a entrega. O status do webhook aparece na aba **Integrações**."

## Fora de escopo

- Sem mudanças no backend (a função `bitrix-config` já registra com `https://sandbox.asaas.com/api/v3` ou `https://api.asaas.com/v3`).
- Sem mudanças no dashboard React `/dashboard/settings` (o bloco webhook só existe no iframe).

## Deploy

Redeploy de `bitrix-payment-iframe` após a edição.
