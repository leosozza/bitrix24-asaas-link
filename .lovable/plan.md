

# Atualizar Preview do Placement (CRM Detail Tab)

## Contexto
A Edge Function `bitrix-crm-detail-tab` gera o HTML da aba que aparece dentro dos detalhes de Lead/Deal no Bitrix24. Atualmente, o design dessa aba esta desatualizado e nao segue o mesmo estilo visual do dashboard principal (`bitrix-payment-iframe`).

Alem disso, nao existe uma forma facil de visualizar esse placement no `/bitrix-preview`.

## Alteracoes

### 1. Adicionar preview do Placement na rota `/bitrix-preview`

Atualizar `src/pages/BitrixPreview.tsx` para incluir um seletor que permita alternar entre:
- **Dashboard principal** (bitrix-payment-iframe) - ja existente
- **Aba CRM** (bitrix-crm-detail-tab) - novo

O seletor sera um botao ou toggle simples no topo da pagina, fora do iframe.

### 2. Atualizar o design do `bitrix-crm-detail-tab`

Refinar o CSS do HTML gerado pela Edge Function `bitrix-crm-detail-tab/index.ts` para alinhar com o design do dashboard:
- Mesma paleta de cores e tipografia
- Cards de metricas com o mesmo estilo (border-radius 12px, sombras suaves)
- Tabela com o mesmo visual
- Botao "Gerar Cobranca" com gradiente consistente
- Formulario overlay com visual atualizado
- Remover referencias a "ConnectPay" e manter apenas "Asaas"

### 3. Ajustar o endpoint GET do `bitrix-crm-detail-tab`

Atualmente o GET retorna apenas `<html><body>OK</body></html>`. Para o preview funcionar, precisamos que ele aceite query params (`DOMAIN`, `member_id`, `PLACEMENT`) e retorne o HTML completo com dados mockados, similar ao que ja e feito no `bitrix-payment-iframe`.

## Detalhes Tecnicos

**Arquivos modificados:**
- `src/pages/BitrixPreview.tsx` - Adicionar seletor de modo (Dashboard vs Placement)
- `supabase/functions/bitrix-crm-detail-tab/index.ts` - Atualizar CSS, suportar GET com preview mode

**Fluxo do preview:**
1. Usuario acessa `/bitrix-preview`
2. Ve dois botoes: "Dashboard" e "Aba CRM"
3. Ao clicar em "Aba CRM", o iframe carrega o HTML do `bitrix-crm-detail-tab` com dados mockados
4. O GET do `bitrix-crm-detail-tab` detecta `member_id=preview_mode` e retorna HTML com transacoes de exemplo

