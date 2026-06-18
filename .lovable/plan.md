## Plano

Trocar todos os emojis (`↻ ✏️ 📧 📱 📍 ⚙️ ℹ️ 🟢 ⚠ 📘 📖 ✓`) da aba Configurações por SVGs inline limpos no mesmo padrão do dock (stroke 2, currentColor). Depois forçar redeploy para que o iframe atualize e exiba também as abas **Plano / Notificações / Segurança** (que já existem no código mas não foram propagadas no último deploy parcial).

### Passo 1 — Helper de ícones SVG
Em `supabase/functions/bitrix-payment-iframe/index.ts`, logo antes de `loadSettings()`, adicionar:

```js
function icn(name, size) { /* retorna <svg> inline */ }
```

Com ícones: `refresh`, `mail`, `phone`, `pin`, `pencil`, `info`, `file`, `check`, `alert`. Tamanho padrão 14px, `vertical-align:-2px`.

### Passo 2 — Substituir emojis em `loadSettings()`
| Onde | De | Para |
|---|---|---|
| Botão topo + título modal | `↻ Atualizar Integração` | `icn('refresh') + ' Atualizar Integração'` |
| Linha de e-mail no header | `📧` | `icn('mail')` |
| Linha de telefone | `📱` | `icn('phone')` |
| Linha de endereço | `📍` | `icn('pin')` |
| Botão Editar (empresa + asaas) | `✏️ Editar` | `icn('pencil') + ' Editar'` |
| Botão Como configurar | `ℹ️ Como configurar` | `icn('info') + ' Como configurar'` |
| Status Asaas conectado | `🟢` | `icn('check')` em verde + texto |
| Status Asaas não config. | `⚠` | `icn('alert')` em âmbar + texto |
| Badge webhook OK | `✓ Registrado…` | `icn('check') + ' Registrado…'` |
| Badge webhook pendente | `⚠ …` | `icn('alert') + ' …'` |
| Título Config Fiscal | `⚙️ Configuração Fiscal` | `icn('file', 16) + ' Configuração Fiscal'` |
| Header modal webhook help | `📘 Como configurar…` | `icn('info', 18) + ' Como configurar…'` |
| Link docs no modal | `📖` | remover (texto puro) |

Cores aplicadas via `<span style="color:#16a34a">` para verde e `#d97706` para âmbar, envolvendo `icn(...)` quando indicar status.

### Passo 3 — Redeploy
Chamar `supabase--deploy_edge_functions` para `bitrix-payment-iframe`. Isso garante que a versão deployada também passe a ter as **abas Plano / Notificações / Segurança** no dock (já presentes no código nas linhas 3029–3040 mas ainda não no runtime, segundo o screenshot do usuário).

### Verificação (do usuário)
Após Ctrl+F5 no iframe Bitrix:
- Dock com 9 abas (incluindo Plano, Notificações, Segurança)
- Settings sem emojis, todos os ícones em SVG monocromático
- Botão "Atualizar Integração" com ícone refresh limpo

### Fora de escopo
- Sem mudança em layout, cores de fundo ou cards.
- Sem mexer no React `/dashboard/settings`.
- Sem trocar para `@bitrix24/b24icons` (iframe é HTML server-rendered, SVG inline é o equivalente mais limpo e sem CDN).

### Arquivo
- `supabase/functions/bitrix-payment-iframe/index.ts`
