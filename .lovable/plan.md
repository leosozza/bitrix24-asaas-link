# Auditoria da Integração Asaas — Bugs Identificados e Correções

Revisei estaticamente as 4 áreas + o problema novo do webhook reportado. Abaixo o inventário ordenado por severidade.

---

## 🔴 BUGS CRÍTICOS

### 0. Webhook não é criado e não há fallback manual (NOVO — reportado)
**Sintoma do usuário:** ao salvar a API Key, o webhook não é registrado no Asaas e a UI não mostra a URL para colar manualmente.

**Causas prováveis em `bitrix-config/index.ts`:**
- Linha 73: `email: 'webhook@connectpay.app'` — o Asaas **exige um e-mail válido e reconhecido na conta** (geralmente o e-mail do usuário Asaas) para criar webhook. Domínio inexistente faz o POST falhar com 400.
- Linhas 99-101: quando o POST falha, apenas loga `console.error` e segue com `webhookId = null` → resposta para o usuário diz "Configure o webhook manualmente" mas **não devolve a URL nem o motivo do erro**.
- Linha 41-43: lista webhooks sem paginação (`?offset=...`) — contas com >10 webhooks podem ter o existente "escondido".

**Fix:**
1. Usar e-mail do tenant (buscar em `profiles.email`) ao criar webhook, com fallback configurável.
2. Capturar a mensagem de erro real do Asaas e retornar para o frontend.
3. Sempre devolver `webhookUrl` (construída a partir de `SUPABASE_URL`) e `webhookSecret` na resposta — mesmo no sucesso — para a UI exibir e permitir cópia manual.
4. Na tela de Configurações do `bitrix-payment-iframe`, mostrar bloco "Webhook" com:
   - URL (`{SUPABASE_URL}/functions/v1/asaas-webhook`)
   - Token de autenticação (`webhook_secret`)
   - Lista de eventos esperados
   - Botão "Copiar URL"
   - Instruções de configuração manual no Asaas
   - Status (registrado automaticamente / pendente configuração manual)

### 1. Cartão de crédito sempre falha — `creditCardHolderInfo` incompleto
`bitrix-payment-process/index.ts:192-195`: `cpfCnpj: ''`. O Asaas rejeita. **Fix:** enviar `name/email/cpfCnpj` do cliente e campos extras opcionais.

### 2. Linha digitável do boleto retorna URL errada
`bitrix-payment-process/index.ts:436`: `boletoDigitableLine: payment.invoiceUrl` é URL, não linha digitável. **Fix:** chamar `GET /payments/{id}/identificationField`.

### 3. Webhook não rejeita tokens inválidos (vulnerabilidade)
`asaas-webhook/index.ts:438-441`: quando `webhook_secret` está salvo e o header não bate, apenas loga e segue. **Fix:** retornar 401.

### 4. Auto-emissão de NFSe nunca autoriza a nota
`asaas-webhook/index.ts:598-627`: cria NFSe (`SCHEDULED`) mas nunca chama `/authorize`. **Fix:** chamar `POST /invoices/{id}/authorize` após criar (ou aguardar `effectiveDate` se intencional).

### 5. `.single()` em queries opcionais lança 500
Diversos pontos em `asaas-webhook` (201, 264, 308, 488, 519, 536, 555, 574) e `bitrix-subscription-process` (171, 189, 258). PGRST116 quebra o handler e faz o Asaas reentregar indefinidamente. **Fix:** trocar por `.maybeSingle()`.

### 6. Status `CANCELED` do Asaas nunca é mapeado
`asaas-webhook/index.ts:57-72`: falta `CANCELED` e `PAYMENT_DELETED`. Badge de cancelamento usa `'cancelled'` (dois L). **Fix:** adicionar mapeamento e padronizar grafia.

---

## 🟡 BUGS MÉDIOS

### 7. Falta idempotência no webhook
Reentregas do Asaas podem duplicar auto-emissão de NFSe. **Fix:** checar `integration_logs` por `(entity_id + action)` antes de processar.

### 8. Splits sem validação
`bitrix-payment-process/index.ts:159-180`: soma de percentuais pode exceder 100%. **Fix:** validar antes de enviar.

### 9. Branding "ConnectPay" residual
- `bitrix-subscription-process/index.ts:246`: `'Assinatura via ConnectPay'`
- `bitrix-config/index.ts:73`: `webhook@connectpay.app` (e ainda causa o bug #0)

### 10. `asaas-invoice-process` não persiste dados do cliente
Linhas 226-244: insert sem `customer_name/email/document`. UI fica sem essas colunas em NFSe manual.

### 11. Webhook não atualiza `payment_url/pix/boleto` para pagamentos criados externamente
Linhas 374-396: cobranças vindas via assinatura ou Asaas direto ficam sem esses campos.

### 12. `bitrixPaymentId` mal extraído quando `externalReference` ausente
`asaas-webhook/index.ts:495-497`: chama `sale.paysystem.pay.payment` com ID vazio para cobranças sem referência Bitrix. **Fix:** guard.

---

## 🟢 MELHORIAS MENORES

### 13. Vencimentos inconsistentes
Cobrança avulsa = 3 dias; assinatura = 7 dias. Padronizar e/ou tornar configurável.

### 14. Logs de cartão potencialmente sensíveis
Garantir mascaramento de `cardNumber/cardCvv` em todos os logs.

### 15. Listagem de webhooks sem paginação
`bitrix-config/index.ts:41-43`: contas com muitos webhooks podem não encontrar o existente.

---

## Plano de Execução

**Etapa 1 — Webhook (prioridade absoluta)** (#0, #15)
- Refatorar `registerAsaasWebhook` para receber e-mail do tenant
- Capturar e propagar erro real do Asaas
- Sempre devolver `webhookUrl` + `webhookSecret` na resposta de `bitrix-config`
- Atualizar UI em `bitrix-payment-iframe` (aba Configurações) com bloco "Webhook" mostrando URL/token/eventos + botão copiar + instruções manuais
- Adicionar paginação na listagem de webhooks

**Etapa 2 — Críticos de pagamento** (#1, #2)
- `creditCardHolderInfo` completo
- Buscar `identificationField` do boleto

**Etapa 3 — Robustez do webhook** (#3, #5, #6, #7, #12)
- 401 em token inválido
- `.maybeSingle()` em todas as queries opcionais
- Mapeamento `CANCELED`, padronizar grafia
- Dedup idempotente
- Guard no `updateBitrixPaymentStatus`

**Etapa 4 — NFSe** (#4, #10)
- Chamar `/authorize` (ou comportamento configurável)
- Persistir dados do cliente em `invoices`

**Etapa 5 — Limpeza** (#8, #9, #11, #13, #14)
- Validação de splits, branding, atualização de `payment_url` em pagamentos externos, padronização de vencimentos, mascaramento de logs

**Etapa 6 — Deploy**
- Redeployar `bitrix-config`, `bitrix-payment-iframe`, `bitrix-payment-process`, `asaas-webhook`, `bitrix-subscription-process`, `asaas-invoice-process`

---

## Perguntas antes de implementar

1. **Webhook (#0):** posso usar o `profiles.email` do tenant como e-mail do webhook no Asaas? (Asaas envia notificação a esse e-mail em caso de falhas)
2. **NFSe auto-emit (#4):** autorizar imediatamente ou manter `SCHEDULED` aguardando `effectiveDate`?
3. **Webhook secret (#3):** posso rejeitar com 401 quando inválido? Instalações antigas sem `webhook_secret` continuam passando (sem secret salvo = sem validação).
