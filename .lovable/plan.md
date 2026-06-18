## Reestruturação da Aba CRM Asaas

### 1. Reordenação das Abas
Nova ordem dos sub-tabs no `bitrix-crm-detail-tab`:
1. **Dados do Contrato** (antes "Planejamento") — agora primeira aba e default
2. **Cobranças**
3. **Assinaturas**
4. **NFSe**
5. **Split**

### 2. Modal "Nova Cobrança" Reformulado
Fluxo guiado em seções dinâmicas:

**a) Valor Total do Contrato**
- Auto-preenchido com soma dos produtos do Deal (via `crm.deal.productrows.get`)
- Editável

**b) Entrada**
- Campo `Valor de Entrada`
- Toggle: `À vista` | `Parcelada` (se parcelada → número de parcelas 2–12)
- Método pagamento entrada: PIX (padrão) | Boleto | Cartão

**c) Saldo a Parcelar** (calculado: total − entrada)
- Exibido em destaque, readonly

**d) Modalidade do Saldo**
- Radio: `Recorrente (Assinatura)` | `Parcelamento Fixo`

**e) Configuração da Recorrência/Parcelamento**
- Data de início (padrão: hoje +7d)
- Ciclo: `Semanal` (padrão) | `Quinzenal` | `Mensal`
- Modo de término: `Data fim` OU `Número de parcelas` (mutuamente exclusivos)
  - Se data fim → calcula nº de parcelas automaticamente
  - Se nº parcelas → calcula data fim automaticamente
- Método pagamento recorrente: PIX | Boleto | Cartão

**f) Preview do Cronograma**
- Tabela ao vivo: `#`, `Data`, `Valor`, `Tipo` (Entrada/Recorrente)
- Atualiza em tempo real conforme campos mudam
- Dia da semana é fixado pela data inicial (ex.: quarta → todas quartas)

### 3. Submissão
- Cria cobrança(s) de entrada via `bitrix-payment-process`
- Cria assinatura via `bitrix-subscription-process` (se recorrente) OU múltiplas cobranças (se parcelamento fixo)
- Cada cobrança/assinatura criada loga na timeline do Bitrix (sucesso/erro)
- Atualiza/cria registro em `contract_plans`

### 4. Status na Lista de Cobranças
- Coluna `Status` com badge colorido (Pendente, Pago, Vencido, Cancelado, Estornado)
- Já existe parcialmente — garantir consistência visual

### Arquivos afetados
- `supabase/functions/bitrix-crm-detail-tab/index.ts` — reordenar tabs, reescrever modal "Nova Cobrança" com novo wizard, lógica de cálculo de cronograma, integração com `crm.deal.productrows.get`
- `supabase/functions/bitrix-payment-process/index.ts` — aceitar criação em lote (parcelamento fixo)

### Pontos a confirmar
1. Quando **entrada parcelada**, as parcelas da entrada têm o **mesmo ciclo** da recorrência ou são sempre **mensais consecutivas**?
2. Se **não houver entrada** (valor 0), pular direto para recorrência?
3. No **parcelamento fixo** (não recorrente), as parcelas seguem o mesmo ciclo (semanal/quinzenal/mensal) ou são sempre mensais?
