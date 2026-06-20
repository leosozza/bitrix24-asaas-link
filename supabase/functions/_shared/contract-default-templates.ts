// 5 default contract templates ready to seed for new tenants.
// All use Mustache-style {{placeholders}} resolved by contract-renderer.ts.

export interface DefaultTemplate {
  name: string;
  description: string;
  cover_style: string;
  is_default?: boolean;
  body_html: string;
  bitrix_field_map?: Record<string, { entity: string; field: string }>;
}

// Common print CSS to keep colors when generating PDF via window.print()
const PRINT_FIX = `*,*::before,*::after{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;

// ─────────────────────────────────────────────────────────
// 1) Delivery Real (Consultoria / Serviços)
// ─────────────────────────────────────────────────────────
const TPL_DELIVERY_REAL: DefaultTemplate = {
  name: "Delivery Real — Consultoria",
  description: "Modelo completo de prestação de serviços com tabela de dados contratuais e seção de pagamento.",
  cover_style: "delivery_real",
  body_html: `<style>${PRINT_FIX}
.dr-doc{font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.55}
.dr-doc h1{color:#dc2626;font-size:22px;text-align:center;margin:0 0 4px;letter-spacing:.02em}
.dr-doc h2{color:#dc2626;font-size:14px;text-align:center;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin:0 0 24px}
.dr-doc h3{color:#111827;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:24px 0 10px;border-bottom:2px solid #dc2626;padding-bottom:4px}
.dr-doc .data-table{width:100%;border-collapse:collapse;margin:16px 0 24px;font-size:13px}
.dr-doc .data-table th{background:#fee2e2;color:#991b1b;text-align:left;padding:8px 12px;font-weight:600;width:38%;border:1px solid #fecaca}
.dr-doc .data-table td{padding:8px 12px;border:1px solid #fecaca;background:#fff}
.dr-doc p{margin:6px 0;font-size:13px}
.dr-doc ul{margin:6px 0 12px 22px;font-size:13px}
.dr-doc .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:48px}
.dr-doc .sig-box{border-top:1px solid #111827;padding-top:8px;font-size:12px}
.dr-doc .sig-box strong{display:block;text-transform:uppercase;letter-spacing:.05em;color:#dc2626;margin-bottom:4px}
</style>
<div class="dr-doc">
<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<h2>{{contratado_nome}}</h2>

<h3>Dados contratuais</h3>
<table class="data-table">
<tr><th>Nome completo do cliente</th><td>{{cliente_nome}}</td></tr>
<tr><th>Empresa do cliente</th><td>{{cliente_empresa}}</td></tr>
<tr><th>CNPJ / CPF</th><td>{{cliente_doc}}</td></tr>
<tr><th>Endereço completo</th><td>{{cliente_endereco}}</td></tr>
<tr><th>Serviço contratado</th><td>{{servico_contratado}}</td></tr>
<tr><th>Valor total contratado</th><td>{{valor_total}}</td></tr>
<tr><th>Tempo de contrato</th><td>{{prazo_contrato}}</td></tr>
<tr><th>Vendedor responsável</th><td>{{vendedor}}</td></tr>
</table>

<p><strong>CONTRATADO:</strong> {{contratado_nome}}, CNPJ {{contratado_cnpj}}, com sede em {{contratado_endereco}}, doravante denominado "CONTRATADO".</p>
<p><strong>CONTRATANTE:</strong> {{cliente_empresa}}, CPF/CNPJ {{cliente_doc}}, endereço {{cliente_endereco}}, doravante denominado "CONTRATANTE".</p>
<p>As partes acima qualificadas ajustam entre si o presente contrato, regido pelas cláusulas e condições abaixo:</p>

<h3>Cláusula 1 — Objeto</h3>
<p>1.1 O presente contrato tem como objeto a prestação dos serviços de implantação, reestruturação e assessoria estratégica contínua da operação do CONTRATANTE nas plataformas contratadas.</p>
<p>1.2 Os serviços prestados pelo CONTRATADO incluem, mas não se limitam a:</p>
<ul>
<li>abertura ou reconfiguração das plataformas contratadas;</li>
<li>configuração de dados cadastrais, bancários e operacionais;</li>
<li>estruturação e organização de cardápio;</li>
<li>descrição estratégica e precificação;</li>
<li>integração com aplicativos ou sistemas terceiros;</li>
<li>recuperação de pedidos cancelados;</li>
<li>acompanhamento estratégico e manutenção operacional;</li>
<li>relatórios mensais de desempenho e reuniões estratégicas periódicas;</li>
<li>suporte operacional pelos canais oficiais.</li>
</ul>
<p><strong>1.3 Limitações:</strong> o suporte não cobre plataformas externas não contratadas; o prazo médio de resposta operacional será de até 42 horas úteis; o CONTRATADO não realiza atendimento direto ao cliente final nas plataformas.</p>

<h3>Cláusula 2 — Execução dos serviços</h3>
<p>O CONTRATADO compromete-se a executar os serviços com ética, estratégia, profissionalismo e organização operacional. O CONTRATANTE compromete-se a fornecer todas as informações, acessos, validações e aprovações necessárias para execução dos serviços. O prazo operacional para alterações será de até 72 horas úteis, salvo falhas sistêmicas, caso fortuito ou ausência de informações necessárias.</p>

<h3>Cláusula 3 — Prazo de entrega</h3>
<p>Os serviços de implantação ou reestruturação serão entregues em até 7 (sete) dias úteis após: assinatura contratual, pagamento da entrada, realização do onboarding e envio dos acessos necessários. A ausência de informações pelo CONTRATANTE suspenderá automaticamente os prazos operacionais até regularização.</p>

<h3>Cláusula 4 — Valores e pagamento</h3>
<p>Valor total contratado: <strong>{{valor_total}}</strong> &nbsp;•&nbsp; Quantidade de parcelas: <strong>{{qtd_parcelas}}</strong></p>
<p>O pagamento seguirá o cronograma abaixo:</p>
{{parcelas_tabela}}
<p>Em caso de inadimplência: multa de 2% sobre o valor em aberto; juros de 1% ao mês pró-rata; possibilidade de suspensão parcial ou total dos serviços após 7 dias de atraso.</p>

<h3>Cláusula 5 — Propriedade intelectual</h3>
<p>Todo material produzido pelo CONTRATADO permanecerá de sua propriedade até a quitação integral do contrato. Após a quitação, o CONTRATANTE terá direito de uso pleno do material desenvolvido.</p>

<h3>Cláusula 6 — Confidencialidade</h3>
<p>As partes comprometem-se a manter absoluto sigilo sobre informações comerciais, estratégicas, financeiras e operacionais trocadas durante a vigência contratual.</p>

<h3>Cláusula 7 — Comunicação</h3>
<p>Toda comunicação oficial deverá ocorrer exclusivamente pelos canais oficiais disponibilizados pelo CONTRATADO. Alterações contratuais somente terão validade mediante formalização escrita.</p>

<h3>Cláusula 8 — Rescisão</h3>
<p>O contrato poderá ser rescindido mediante aviso formal, inadimplência, má-fé, bloqueio operacional, descumprimento contratual ou difamação pública da empresa. Valores pagos correspondem às atividades executadas até a data da rescisão.</p>

<h3>Cláusula 9 — LGPD</h3>
<p>As partes comprometem-se a cumprir integralmente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>

<h3>Cláusula 10 — Disposições gerais</h3>
<p>As partes reconhecem que o presente contrato possui natureza empresarial (B2B), voltado ao incremento da atividade econômica do CONTRATANTE. O CONTRATADO não garante faturamento, resultados financeiros específicos ou posicionamento nas plataformas.</p>

<h3>Cláusula 11 — Foro</h3>
<p>Fica eleito o foro da Comarca de {{foro_cidade}} para dirimir quaisquer conflitos oriundos deste contrato.</p>

<div class="sig-grid">
<div class="sig-box"><strong>Contratante</strong>Nome: {{cliente_nome}}<br>Empresa: {{cliente_empresa}}<br>CNPJ/CPF: {{cliente_doc}}</div>
<div class="sig-box"><strong>Contratado</strong>{{contratado_nome}}<br>CNPJ: {{contratado_cnpj}}<br>Representante: {{contratado_representante}}</div>
</div>
</div>`,
};

// ─────────────────────────────────────────────────────────
// 2) Blue Elegant (Pacheco e Lacerda style)
// ─────────────────────────────────────────────────────────
const TPL_BLUE_ELEGANT: DefaultTemplate = {
  name: "Prestação de Serviços — Azul Elegante",
  description: "Layout corporativo com cabeçalho azul, blocos lado a lado para CONTRATANTE/CONTRATADO.",
  cover_style: "blue_elegant",
  is_default: true,
  body_html: `<style>${PRINT_FIX}
.be-doc{font-family:Inter,Arial,sans-serif;color:#1e293b;line-height:1.6}
.be-header{background:#1e40af;height:8px;margin:-16px -16px 0}
.be-stripes{height:60px;background:repeating-linear-gradient(180deg,#bfdbfe 0 4px,transparent 4px 10px);margin:-16px -16px 24px;width:35%}
.be-title{border:2px solid #1e40af;padding:18px 24px;text-align:center;width:fit-content;margin:0 auto 32px}
.be-title h1{color:#1e40af;font-size:34px;font-weight:800;margin:0;letter-spacing:.06em}
.be-title .sub{color:#1e40af;font-size:11px;letter-spacing:.2em;margin-top:4px}
.be-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}
.be-card{background:#fff;border-radius:8px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08);min-height:180px}
.be-card h3{color:#1e40af;text-align:center;font-size:14px;letter-spacing:.18em;margin:0 0 14px;font-weight:700}
.be-card p{font-size:12px;color:#475569;margin:0;text-align:justify}
.be-sig{margin:14px 0 24px;font-size:11px;color:#475569}
.be-sig::before{content:"";display:block;border-top:1px solid #1e40af;margin-bottom:6px;width:80%}
.be-clause{margin-top:18px}
.be-clause h3{color:#1e40af;font-size:15px;font-weight:800;letter-spacing:.05em;margin:0 0 6px}
.be-clause p{font-size:13px;color:#334155;margin:0 0 8px}
.be-footer-stripes{height:50px;background:repeating-linear-gradient(180deg,#bfdbfe 0 4px,transparent 4px 10px);margin:32px -16px -16px;width:35%;margin-left:auto}
.be-footline{display:flex;justify-content:space-between;font-size:12px;color:#1e40af;font-weight:600;padding:10px 0;border-top:1px solid #1e40af;margin-top:24px}
</style>
<div class="be-doc">
<div class="be-header"></div>
<div class="be-stripes"></div>
<div class="be-title"><h1>CONTRATO</h1><div class="sub">PRESTAÇÃO DE SERVIÇOS</div></div>

<div class="be-grid">
<div class="be-card"><h3>CONTRATANTE</h3><p>{{cliente_nome}}, inscrito(a) sob CPF/CNPJ {{cliente_doc}}, com endereço em {{cliente_endereco}}. E-mail: {{cliente_email}}.</p></div>
<div class="be-card"><h3>CONTRATADO</h3><p>{{contratado_nome}}, CNPJ {{contratado_cnpj}}, com sede em {{contratado_endereco}}. Representante: {{contratado_representante}}.</p></div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div class="be-sig">Assinatura do contratante</div><div class="be-sig">Assinatura do contratado</div></div>

<div class="be-clause"><h3>OBJETO</h3><p>O presente contrato tem por objeto a prestação dos serviços contratados conforme escopo acordado entre as partes, no prazo de {{prazo_contrato}}.</p></div>

<div class="be-clause"><h3>PERÍODO DE VIGÊNCIA</h3><p>O presente contrato entra em vigência a partir da data de assinatura ({{data_contrato}}) e terá duração de {{prazo_contrato}}.</p></div>

<div class="be-clause"><h3>REMUNERAÇÃO</h3><p>O CONTRATANTE pagará ao CONTRATADO o valor total de <strong>{{valor_total}}</strong>, dividido em {{qtd_parcelas}} parcela(s) conforme cronograma:</p>{{parcelas_tabela}}</div>

<div class="be-clause"><h3>AUSÊNCIA DE VÍNCULO</h3><p>Este contrato não possui vínculo empregatício, ficando de responsabilidade de ambas as partes suas obrigações tributárias, previdenciárias e trabalhistas.</p></div>

<div class="be-clause"><h3>FORO</h3><p>Fica eleito o foro de {{foro_cidade}} para dirimir conflitos oriundos deste contrato.</p></div>

<div class="be-footline"><span>{{contratado_endereco}}</span><span>{{contratado_nome}}</span></div>
<div class="be-footer-stripes"></div>
</div>`,
};

// ─────────────────────────────────────────────────────────
// 3) Telecom / Provedor (Italnet style)
// ─────────────────────────────────────────────────────────
const TPL_TELECOM: DefaultTemplate = {
  name: "Provedor de Internet / Telecom",
  description: "Modelo numerado hierárquico ideal para serviços recorrentes de telecom.",
  cover_style: "telecom",
  body_html: `<style>${PRINT_FIX}
.tc-doc{font-family:Arial,sans-serif;color:#111827;line-height:1.55;font-size:12.5px}
.tc-header{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:3px solid #1d4ed8}
.tc-logo{background:#1d4ed8;color:#fff;font-weight:800;padding:10px 14px;border-radius:4px;font-size:16px;letter-spacing:.04em}
.tc-tag{font-size:11px;color:#1d4ed8;letter-spacing:.15em;text-transform:uppercase;font-weight:600}
.tc-doc h1{font-size:14px;font-weight:800;text-align:center;margin:20px 0 18px;text-transform:uppercase;letter-spacing:.04em}
.tc-doc h2{font-size:13px;font-weight:800;margin:18px 0 6px;text-transform:uppercase}
.tc-doc p{margin:4px 0;text-align:justify}
.tc-doc .lead{margin-bottom:14px}
.tc-doc .num{font-weight:700;color:#1d4ed8;margin-right:4px}
</style>
<div class="tc-doc">
<div class="tc-header"><div class="tc-logo">{{contratado_nome_curto}}</div><div class="tc-tag">Internet • Telefonia</div></div>

<h1>Contrato de Prestação de Serviço de Instalação de Internet</h1>

<p class="lead">São Partes na presente "CONTRATAÇÃO" do SERVIÇO DE INSTALAÇÃO DE INTERNET, devidamente qualificado na ORDEM DE SERVIÇO INSTALAÇÃO DE INTERNET, que à parte integrante deste instrumento, e do outro lado, o provedor de acesso {{contratado_nome}}, CNPJ {{contratado_cnpj}}, com sede em {{contratado_endereco}}, ora também designada CONTRATADA, e o cliente {{cliente_nome}}, CPF/CNPJ {{cliente_doc}}, com endereço em {{cliente_endereco}}.</p>

<h2><span class="num">1</span> Cláusula primeira — Do objeto</h2>
<p>Constitui objeto do presente contrato o serviço de instalação e a configuração de equipamentos para visibilizar o acesso à internet.</p>

<h2><span class="num">2</span> Cláusula segunda — Preço e forma de pagamento</h2>
<p><span class="num">2.1</span> Em contrapartida ao Serviço, objeto deste Contrato, o CONTRATANTE pagará a Taxa de instalação do Serviço de Acesso à Internet, conforme preço e forma de pagamento especificados na Ordem de Serviço de instalação do mesmo instrumento integrante deste instrumento.</p>
<p><span class="num">2.2</span> Os valores previstos nesta instrumento serão cobrados, pela CONTRATANTE para a instalação dos equipamentos e respectiva ativação do acesso que serão devidamente comunicados a CONTRATANTE.</p>
<p>Valor total contratado: <strong>{{valor_total}}</strong> &nbsp;•&nbsp; {{qtd_parcelas}} parcela(s)</p>
{{parcelas_tabela}}
<p><span class="num">2.3</span> O serviço será cobrado através de boleto bancário, cartão ou crédito (SPC, Serasa) e sua dívida será encaminhada ao Departamento Jurídico para execução legal.</p>
<p><span class="num">2.4</span> Em caso de inadimplência o CONTRATANTE será obrigado a suspender a prestação do serviço enquanto durar o motivo da inadimplência.</p>

<h2><span class="num">3</span> Cláusula terceira — Direitos, responsabilidades e obrigações da CONTRATADA</h2>
<p><span class="num">3.1</span> São de responsabilidade da CONTRATADA: a execução dos seguintes serviços e providências:</p>
<p>a) efetuar o Serviço de Instalação, objeto deste contrato, dentro dos padrões de qualidade que garantam a adequada funcionamento do acesso à internet;</p>

<h2><span class="num">4</span> Cláusula quarta — Prazo e vigência</h2>
<p>O presente contrato terá vigência de {{prazo_contrato}}, iniciando-se a partir de {{data_contrato}}.</p>

<h2><span class="num">5</span> Cláusula quinta — Foro</h2>
<p>Fica eleito o foro de {{foro_cidade}} para dirimir questões oriundas do presente contrato.</p>
</div>`,
};

// ─────────────────────────────────────────────────────────
// 4) SaaS / Assinatura recorrente
// ─────────────────────────────────────────────────────────
const TPL_SAAS: DefaultTemplate = {
  name: "Assinatura Recorrente / SaaS",
  description: "Contrato para serviços de assinatura recorrente com SLA e política de cancelamento.",
  cover_style: "saas",
  body_html: `<style>${PRINT_FIX}
.sa-doc{font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.6;font-size:13px}
.sa-doc h1{font-size:22px;font-weight:800;margin:0 0 4px;color:#7c3aed}
.sa-doc .meta{color:#64748b;font-size:12px;margin-bottom:24px}
.sa-doc h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#7c3aed;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #ede9fe}
.sa-card{background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:14px 18px;margin:12px 0}
.sa-card strong{color:#6b21a8}
</style>
<div class="sa-doc">
<h1>Contrato de Assinatura — {{contratado_nome}}</h1>
<div class="meta">Plano: <strong>{{plano_nome}}</strong> • Início: {{data_contrato}}</div>

<div class="sa-card">
<strong>CONTRATANTE:</strong> {{cliente_nome}} — {{cliente_doc}} — {{cliente_email}}<br>
<strong>CONTRATADO:</strong> {{contratado_nome}} — CNPJ {{contratado_cnpj}}
</div>

<h2>1. Objeto</h2>
<p>O CONTRATADO concede ao CONTRATANTE acesso ao serviço "{{plano_nome}}" mediante pagamento recorrente, conforme termos descritos neste contrato.</p>

<h2>2. Valor e cobrança recorrente</h2>
<p>Valor da assinatura: <strong>{{valor_total}}</strong> a cada ciclo. Cronograma das próximas cobranças:</p>
{{parcelas_tabela}}
<p>A cobrança será realizada automaticamente conforme método escolhido. A renovação é automática até manifestação contrária do CONTRATANTE com pelo menos 7 dias de antecedência ao próximo ciclo.</p>

<h2>3. SLA e disponibilidade</h2>
<p>O CONTRATADO compromete-se a manter disponibilidade mínima de 99% mensal, excetuadas as janelas de manutenção programada comunicadas com 48h de antecedência.</p>

<h2>4. Cancelamento</h2>
<p>O CONTRATANTE pode cancelar a qualquer momento. Não há reembolso de períodos já consumidos. Cancelamentos solicitados a menos de 7 dias do vencimento poderão ser efetivados apenas no ciclo seguinte.</p>

<h2>5. Suporte</h2>
<p>Suporte disponível através dos canais oficiais do CONTRATADO, com tempo médio de resposta de até 24h úteis.</p>

<h2>6. LGPD</h2>
<p>Ambas as partes comprometem-se ao cumprimento da Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

<h2>7. Foro</h2>
<p>Fica eleito o foro de {{foro_cidade}} para dirimir conflitos.</p>
</div>`,
};

// ─────────────────────────────────────────────────────────
// 5) Venda de Produto / Licença
// ─────────────────────────────────────────────────────────
const TPL_SALE: DefaultTemplate = {
  name: "Venda de Produto / Licença",
  description: "Modelo enxuto para venda de produto ou licença com cláusulas de entrega e garantia.",
  cover_style: "sale",
  body_html: `<style>${PRINT_FIX}
.sl-doc{font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;font-size:13px}
.sl-doc h1{font-size:20px;font-weight:800;text-align:center;margin:0 0 4px;color:#047857}
.sl-doc .sub{text-align:center;color:#6b7280;font-size:12px;margin-bottom:22px}
.sl-doc h2{font-size:13px;font-weight:700;color:#047857;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.05em}
.sl-doc .partes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
.sl-doc .partes div{background:#ecfdf5;padding:14px;border-radius:6px;border:1px solid #a7f3d0;font-size:12.5px}
.sl-doc p{margin:6px 0;text-align:justify}
</style>
<div class="sl-doc">
<h1>CONTRATO DE COMPRA E VENDA</h1>
<div class="sub">Emitido em {{data_contrato}}</div>

<div class="partes">
<div><strong>VENDEDOR</strong><br>{{contratado_nome}}<br>CNPJ {{contratado_cnpj}}<br>{{contratado_endereco}}</div>
<div><strong>COMPRADOR</strong><br>{{cliente_nome}}<br>CPF/CNPJ {{cliente_doc}}<br>{{cliente_endereco}}</div>
</div>

<h2>1. Objeto</h2>
<p>O VENDEDOR transfere ao COMPRADOR a propriedade do(s) seguinte(s) item(ns): {{produto_descricao}}.</p>

<h2>2. Preço e pagamento</h2>
<p>Valor total: <strong>{{valor_total}}</strong> em {{qtd_parcelas}} parcela(s):</p>
{{parcelas_tabela}}

<h2>3. Entrega</h2>
<p>A entrega ocorrerá em até {{prazo_entrega}} após confirmação do primeiro pagamento, no endereço informado pelo COMPRADOR.</p>

<h2>4. Garantia</h2>
<p>O VENDEDOR garante o produto pelo prazo de {{prazo_garantia}}, cobrindo defeitos de fabricação, excluindo mau uso, modificações não autorizadas ou desgaste natural.</p>

<h2>5. Suporte pós-venda</h2>
<p>Suporte técnico estará disponível pelos canais oficiais do VENDEDOR durante o período de garantia.</p>

<h2>6. Foro</h2>
<p>Fica eleito o foro de {{foro_cidade}} para dirimir conflitos.</p>
</div>`,
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  TPL_BLUE_ELEGANT,
  TPL_DELIVERY_REAL,
  TPL_TELECOM,
  TPL_SAAS,
  TPL_SALE,
];
