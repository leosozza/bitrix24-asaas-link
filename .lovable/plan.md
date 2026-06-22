
# Atualizar landing page (rota `/`)

A página inicial ainda mostra "ConnectPay" no header/hero e não menciona os recursos novos (contratos automáticos e o placement embutido no Bitrix24 para preencher tudo).

## Mudanças

### 1. `src/components/landing/Header.tsx`
- Trocar o logo "Connect**Pay**" por "Asaas Pay **by Thoth**" (manter mesma estrutura/cores, só o texto).
- Trocar o badge da logo de "C" para "A".

### 2. `src/components/landing/Hero.tsx`
- Badge superior: "Integração oficial para Bitrix24 Marketplace · by Thoth24".
- Subheadline: incluir menção a **geração de contratos** e **preenchimento direto no Bitrix24** (placement embutido).
- Adicionar mais um "trust indicator": "Contratos automáticos".
- Adicionar "Contrato" como 5º método/recurso ao lado dos cards PIX/Boleto/Cartão/Recorrente (vira grid de 5 itens), ou substituir o quarto por "Contratos" — preferimos **adicionar** mantendo os 4 atuais + "Contrato" em md:grid-cols-5.

### 3. `src/components/landing/Features.tsx`
Adicionar dois novos cards ao array `features`, refletindo o que foi entregue:
- **Contratos Inteligentes** (ícone `ScrollText`): "Modelos prontos de contrato, geração automática, assinatura e cobrança vinculada ao Deal."
- **Painel dentro do Bitrix24** (ícone `LayoutDashboard` ou `AppWindow`): "Preencha credenciais, templates de contrato e automações sem sair do Bitrix24, via placement embutido."

Remover/ajustar 2 cards menos relevantes para manter o grid simétrico (8 → 8 cards). Sugestão: substituir "Multi-empresa" e "Integração com Faturas" pelos novos, já que faturas se sobrepõe a contratos e multi-empresa não é diferencial vendido hoje.

### 4. `src/components/landing/Footer.tsx`
- Já mostra "Assas Pay by Thoth" — corrigir grafia para **"Asaas Pay by Thoth"** (estava "Assas" em vez de "Asaas").

### 5. Varredura de grafia "Assas Pay" → "Asaas Pay"
Na renomeação anterior ficou "Assas Pay by Thoth" (com um S a menos) em vários arquivos. Vou rodar substituição global em `src/` e `supabase/functions/` para corrigir para **"Asaas Pay by Thoth"**.

## Fora do escopo
- Sem mudanças de backend, schema ou edge functions de lógica (somente strings).
- Sem mexer em outras rotas além da landing e textos de branding.
