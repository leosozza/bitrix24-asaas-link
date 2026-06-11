## Problema

Teste no Deal 964 falhou silenciosamente (nenhum comentário no timeline) por dois motivos encontrados nos logs do `bitrix-robot-handler`:

1. **Parse de valor BR quebrado** — Bitrix enviou `amount = "R$ 1.500,00"`. O código atual faz `parseFloat(amount)` direto, que retorna `NaN` para esse formato → retorna "Valor inválido" sem chamar o Asaas.
2. **Timeline não é avisada em erros precoces** — as saídas por "Dados incompletos", "Valor inválido" e "Asaas não configurado" usam `break`/`return` antes do `postTimelineComment`, então o usuário não vê nada no timeline do Deal.

## Correções em `supabase/functions/bitrix-robot-handler/index.ts`

### 1. Normalizar valores no formato brasileiro
Adicionar helper:

```text
parseBRLAmount("R$ 1.500,00")  → 1500.00
parseBRLAmount("1500.00")      → 1500.00
parseBRLAmount("1.500,5")      → 1500.50
```

Regras: remover `R$`/espaços; se tiver vírgula, tratar `.` como separador de milhar e `,` como decimal; senão usar `parseFloat`.

Aplicar em `asaas_create_charge` (campo `amount`) e em `asaas_create_subscription` se também receber valor.

### 2. Postar comentário no timeline em TODOS os erros do robô
Mover a definição de `entityType` / `entityIdNum` / `postTimelineComment` para **antes** do bloco que valida `asaas_configurations`, e chamar `postTimelineComment` nestes pontos do `asaas_create_charge`:

- Asaas não configurado → "❌ Asaas — configuração ausente. Configure a API Key no app."
- Dados incompletos (`amount` ou `customer_document` vazios) → "❌ Asaas — dados incompletos: informe valor e CPF/CNPJ."
- Valor inválido (após parseBRLAmount) → "❌ Asaas — valor inválido: `<valor recebido>`."
- Falha ao criar cliente → já existe.
- Falha ao criar cobrança → já existe.
- Sucesso → já existe.

### 3. Pequeno ajuste de robustez
- Tornar `customer_document` tolerante a máscara (`12.345.678/0001-99`) — strip de tudo que não for dígito antes de mandar para o Asaas.
- Log do amount cru recebido do Bitrix para facilitar diagnóstico futuro.

## O que NÃO está nesse plano (separar se quiser)

- O erro `ERROR_METHOD_NOT_FOUND` em `bizproc.event.send` que apareceu no log — está relacionado ao retorno do robô para o workflow, não ao timeline. Posso investigar em seguida se você confirmar.
- Mesmo tratamento de timeline nos outros robôs (`asaas_check_payment`, `asaas_create_subscription`, etc.). Faço junto se quiser.

## Resultado esperado

Repetindo o teste do Deal 964 com `R$ 1.500,00` e CNPJ mascarado:
- A cobrança é criada de verdade no Asaas (valor 1500.00).
- Aparece comentário no timeline do Deal 964 com ID, método, valor e link de pagamento.
- Se ainda assim falhar, o motivo do erro aparece no timeline em vez de sumir.