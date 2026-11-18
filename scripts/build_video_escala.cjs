const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = process.argv[2] || __dirname;
const def = JSON.parse(fs.readFileSync('/home/user/escala-compliance-pro/src/data/escalaDefinida.json', 'utf8'));
const D = ['SEG','TER','QUA','QUI','SEX','SAB','DOM'];
const DL = { SEG:'Seg', TER:'Ter', QUA:'Qua', QUI:'Qui', SEX:'Sex', SAB:'Sáb', DOM:'Dom' };
const DLONG = { SEG:'Segunda', TER:'Terça', QUA:'Quarta', QUI:'Quinta', SEX:'Sexta', SAB:'Sábado', DOM:'Domingo' };
const SECT = [
  ['SDR','SDR · Pré-vendas'], ['VENDAS','Vendas'], ['PREPARACAO','Preparação'], ['MARKETING','Marketing'],
  ['DOCUMENTACAO','Documentação'], ['SUCESSO_CLIENTE','Sucesso do Cliente'], ['FINANCEIRO','Financeiro'],
];
const emps = def.employees.filter(e => e.contractType !== 'LICENCA_MATERNIDADE');
const ordered = SECT.flatMap(([id, label]) => emps.filter(e => e.department === id).map(e => ({ e, label })));
// Ciclo: S1 começa em 02/11/2026. Próximas ocorrências a partir de 16/11.
const WEEK_DATES = { 3: ['16/11','22/11'], 4: ['23/11','29/11'], 1: ['30/11','06/12'], 2: ['07/12','13/12'] };
const SAT_DATE = { 3:'21/11', 4:'28/11', 1:'05/12', 2:'12/12' };
const ORDER = [3,4,1,2];

const name = e => e.contractType === 'ESTAGIARIO' ? e.shortName.replace(/\s*\(.*\)/,'') + ' <small>(estágio)</small>' : e.shortName;
const cell = s => {
  if (!s) return '<td></td>';
  if (s.type === 'FOLGA_5X2') return '<td class="folga">FOLGA</td>';
  if (s.type === 'FOLGA_DSR') return '<td class="dsr">DSR</td>';
  if (s.type === 'TRABALHO') return `<td class="work">${s.startTime}–${s.endTime}</td>`;
  return `<td class="dsr">${s.type}</td>`;
};
const folgaOf = (e, w) => D.filter(d => d !== 'DOM' && e.weeksSchedule[w][d].type === 'FOLGA_5X2');

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1920px;height:1080px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#0f172a;color:#0f172a;overflow:hidden}
.slide{position:absolute;inset:0;background:#f8fafc;display:flex;flex-direction:column}
.top{background:#0f172a;color:#fff;padding:28px 64px;display:flex;justify-content:space-between;align-items:center}
.top .brand{font-weight:800;font-size:26px}.top .brand b{color:#60a5fa}
.top .tag{font-size:20px;color:#a7f3d0;font-weight:700;border:2px solid #34d399;padding:6px 16px;border-radius:999px}
.body{flex:1;padding:40px 64px;display:flex;flex-direction:column;gap:24px}
h1{font-size:64px;font-weight:800;letter-spacing:-1px;line-height:1.1}
h2{font-size:46px;font-weight:800;letter-spacing:-.5px}
.sub{font-size:28px;color:#475569}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.card{background:#fff;border:2px solid #e2e8f0;border-radius:18px;padding:28px}
.card .k{font-size:22px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.card .v{font-size:44px;font-weight:800;margin-top:8px}
.card p{font-size:24px;color:#334155;margin-top:10px;line-height:1.35}
ul.big{font-size:32px;line-height:1.55;padding-left:36px;color:#1e293b}
ul.big b{color:#0f172a}
table{border-collapse:collapse;width:100%;font-size:21px;background:#fff}
th{background:#1e293b;color:#fff;padding:8px 10px;font-size:20px}
th.sat{background:#1d4ed8}
td{border:1px solid #e2e8f0;padding:4px 10px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:19px}
td.n{text-align:left;font-family:inherit;font-weight:700;font-size:21px;white-space:nowrap}
td.n small{font-weight:500;color:#64748b;font-size:16px}
td.sec{background:#eef2ff;text-align:left;font-family:inherit;font-weight:800;font-size:16px;color:#3730a3;text-transform:uppercase;letter-spacing:.5px;padding:3px 10px;vertical-align:middle}
tr.grp td{border-top:3px solid #94a3b8}
td.folga{background:#059669;color:#fff;font-weight:800;font-family:inherit}
td.dsr{color:#94a3b8;font-family:inherit;font-size:17px}
td.work{color:#1e3a8a}
td.satcol{background:#eff6ff}
.legend{display:flex;gap:28px;font-size:22px;color:#334155;align-items:center}
.sw{display:inline-block;width:22px;height:22px;border-radius:5px;vertical-align:-4px;margin-right:8px}
.note{background:#fffbeb;border:2px solid #fbbf24;border-radius:14px;padding:16px 22px;font-size:24px;color:#78350f}
.ok{background:#ecfdf5;border:2px solid #34d399;border-radius:14px;padding:16px 22px;font-size:24px;color:#065f46}
.timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.wk{background:#fff;border:3px solid #cbd5e1;border-radius:16px;padding:22px;text-align:center}
.wk.now{border-color:#2563eb;background:#eff6ff}
.wk .s{font-size:54px;font-weight:800}.wk .d{font-size:26px;color:#475569;margin-top:6px}.wk .x{font-size:22px;margin-top:10px;font-weight:700;color:#1d4ed8}
.pills{display:flex;flex-wrap:wrap;gap:14px}
.pill{background:#fff;border:2px solid #cbd5e1;border-radius:999px;padding:10px 22px;font-size:28px;font-weight:700}
.pill.off{background:#059669;border-color:#059669;color:#fff}
.foot{padding:0 64px 22px;font-size:18px;color:#94a3b8;display:flex;justify-content:space-between}
`;

const top = (tag='Escala Inicial') => `<div class="top" style="padding:22px 64px"><div class="brand">Seu Carro PE <b>· Escala 5x2</b></div><div class="tag">${tag} · vigente a partir de 21/11/2026</div></div>`;
const foot = (n, total) => `<div class="foot"><span>Escala inicial definida em reunião — ajustes futuros partem desta base</span><span>${n}/${total}</span></div>`;

const slides = [];
// 1. Abertura
slides.push({ dur: 7, html: `${top()}<div class="body" style="justify-content:center;gap:34px">
  <div class="sub" style="font-weight:700;color:#2563eb;font-size:32px">ESCALA INICIAL</div>
  <h1 style="font-size:96px">Escala de Trabalho e Folgas<br>Seu Carro PE</h1>
  <div class="sub" style="font-size:36px">Matriz 546 &amp; Filial 777 · Ciclo de 4 semanas (S1 a S4)</div>
  <div class="ok" style="font-size:30px;max-width:1400px">Esta é a <b>escala inicial</b>, definida em reunião. Ela começa a valer no <b>sábado, 21 de novembro de 2026</b>. Este vídeo explica como ela funciona e mostra as tabelas de folga de cada semana.</div>
</div>` });
// 2. Como funciona
slides.push({ dur: 11, html: `${top()}<div class="body">
  <h2>Como a escala funciona</h2>
  <div class="cards">
    <div class="card"><div class="k">Modelo</div><div class="v">5x2</div><p>Cada pessoa trabalha 5 dias e folga 2 por semana: o <b>domingo</b> (DSR) e <b>mais 1 dia</b>, que muda conforme a semana.</p></div>
    <div class="card"><div class="k">Segunda a sexta</div><div class="v">08:00–17:30</div><p>Com cerca de 1 hora de almoço, em horários escalonados para o setor nunca ficar vazio.</p></div>
    <div class="card"><div class="k">Sábado</div><div class="v">08:00–17:00</div><p>Com 1 hora de almoço. Documentação e Financeiro da Filial: 08:00–13:00.</p></div>
  </div>
  <ul class="big">
    <li>A escala roda em um <b>ciclo de 4 semanas: S1, S2, S3 e S4</b>. Depois da S4, volta para a S1.</li>
    <li>Os sábados são feitos em <b>rodízio</b>. Quem trabalha no sábado folga em um dia útil daquela semana.</li>
    <li>A carga semanal fica <b>dentro do limite de 42h</b> (EC 141/2026 · Fase 1).</li>
  </ul>
</div>` });
// 3. Sábado
slides.push({ dur: 11, html: `${top()}<div class="body">
  <h2>O horário de sábado</h2>
  <ul class="big">
    <li>Horário formal: <b>08:00 às 17:00, com 1 hora de intervalo</b>.</li>
    <li>Esse é o horário em que o colaborador <b>deve estar à disposição</b> da loja.</li>
    <li>Dependendo do movimento do comércio local, a <b>liderança pode liberar a equipe mais cedo</b>.</li>
    <li>Documentação, Financeiro e Estágio da Filial seguem com o sábado curto (manhã).</li>
  </ul>
  <div class="note">Na tela da reunião o sábado aparecia como “saída às 16h” só porque não era possível marcar o almoço. O correto é <b>08:00–17:00 com 1h de almoço</b>.</div>
</div>` });
// 4. Calendário do ciclo
slides.push({ dur: 9, html: `${top()}<div class="body">
  <h2>Qual semana é qual</h2>
  <div class="sub">O ciclo se repete a cada 4 semanas. As próximas semanas ficam assim:</div>
  <div class="timeline">${ORDER.map(w => `<div class="wk ${w===3?'now':''}"><div class="s">S${w}</div><div class="d">${WEEK_DATES[w][0]} a ${WEEK_DATES[w][1]}</div><div class="x">${w===3?'Início: sábado 21/11':'Sábado '+SAT_DATE[w]}</div></div>`).join('')}</div>
  <div class="ok">O <b>primeiro sábado da escala (21/11)</b> é o sábado da <b>semana S3</b>. Depois vêm S4 (23 a 29/11), S1 (30/11 a 06/12) e S2 (07 a 13/12), e o ciclo recomeça.</div>
</div>` });
// 5-8. Tabelas semanais
for (const w of ORDER) {
  let rows = '', lastSec = '';
  for (const { e, label } of ordered) {
    const first = label !== lastSec; lastSec = label;
    const span = ordered.filter(o => o.label === label).length;
    rows += `<tr class="${first?'grp':''}">${first ? `<td class="sec" rowspan="${span}">${label}</td>` : ''}<td class="n">${name(e)}</td>${D.map(d => cell(e.weeksSchedule[w][d]).replace('<td class="work">', d==='SAB' ? '<td class="work satcol">' : '<td class="work">')).join('')}</tr>`;
  }
  slides.push({ dur: 13, html: `${top('Semana S' + w)}<div class="body" style="gap:12px;padding-top:22px">
    <div style="display:flex;justify-content:space-between;align-items:flex-end"><h2>Semana S${w} <span style="color:#64748b;font-weight:600;font-size:32px">· ${WEEK_DATES[w][0]} a ${WEEK_DATES[w][1]} (e a cada 4 semanas)</span></h2>
    <div class="legend"><span><span class="sw" style="background:#059669"></span>Folga 5x2</span><span><span class="sw" style="background:#eff6ff;border:1px solid #93c5fd"></span>Sábado</span><span>DSR = domingo</span></div></div>
    <table><thead><tr><th style="text-align:left;width:190px">Setor</th><th style="text-align:left">Colaborador</th>${D.map(d => `<th class="${d==='SAB'?'sat':''}">${DL[d]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
  </div>` });
}
// 9. Resumo de folgas
{
  let rows = '', lastSec = '';
  for (const { e, label } of ordered) {
    const first = label !== lastSec; lastSec = label;
    const span = ordered.filter(o => o.label === label).length;
    rows += `<tr class="${first?'grp':''}">${first ? `<td class="sec" rowspan="${span}">${label}</td>` : ''}<td class="n">${name(e)}</td>${ORDER.map(w => { const f = folgaOf(e, w); return f.length ? `<td class="folga">${f.map(d=>DLONG[d]).join(' + ')}</td>` : '<td class="dsr">só domingo</td>'; }).join('')}</tr>`;
  }
  slides.push({ dur: 15, html: `${top('Resumo das folgas')}<div class="body" style="gap:12px;padding-top:22px">
    <h2>Folga semanal de cada colaborador <span style="color:#64748b;font-weight:600;font-size:30px">(além do domingo)</span></h2>
    <table><thead><tr><th style="text-align:left;width:190px">Setor</th><th style="text-align:left">Colaborador</th>${ORDER.map(w => `<th>S${w} · ${WEEK_DATES[w][0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
  </div>` });
}
// 10. Sábado 21/11
{
  const work = emps.filter(e => e.weeksSchedule[3].SAB.type === 'TRABALHO');
  const off = emps.filter(e => e.weeksSchedule[3].SAB.type !== 'TRABALHO');
  slides.push({ dur: 10, html: `${top()}<div class="body">
    <h2>Primeiro sábado: 21/11 (semana S3)</h2>
    <div class="sub" style="font-weight:700;color:#1e293b">Trabalham (${work.length}):</div>
    <div class="pills">${work.map(e => `<span class="pill">${e.shortName.replace(/\s*\(.*\)/,'')}</span>`).join('')}</div>
    <div class="sub" style="font-weight:700;color:#1e293b;margin-top:10px">De folga (${off.length}):</div>
    <div class="pills">${off.map(e => `<span class="pill off">${e.shortName.replace(/\s*\(.*\)/,'')}</span>`).join('')}</div>
    <div class="note" style="margin-top:14px">Horário deste sábado: <b>08:00–17:00 com 1h de almoço</b> (Matriz e Vendas) · Marielly e João Pedro <b>08:00–13:00</b> · Matheus (estágio) <b>08:40–12:40</b>. A liderança pode liberar mais cedo conforme o movimento.</div>
  </div>` });
}
// 11. Ajuste Winona
slides.push({ dur: 10, html: `${top()}<div class="body">
  <h2>Ajuste feito após a reunião</h2>
  <ul class="big">
    <li><b>Winona</b> e <b>João Alexandre</b> folgam juntos (folgas vinculadas).</li>
    <li>Na versão da reunião, a semana S2 ficava <b>sem folga</b> e a S3 tinha <b>duas folgas</b> (quinta e sábado).</li>
    <li>Correção: a folga de sábado passou da S3 para a S2.</li>
  </ul>
  <div class="ok" style="font-size:30px">Folgas da Winona e do João Alexandre: <b>S1 quinta · S2 sábado · S3 quinta · S4 segunda</b></div>
</div>` });
// 12. Encerramento
slides.push({ dur: 8, html: `${top()}<div class="body" style="justify-content:center;gap:30px">
  <h1>Esta é a escala inicial</h1>
  <ul class="big">
    <li>Começa a valer no <b>sábado, 21/11/2026</b>.</li>
    <li>Pode ser ajustada conforme a operação e o movimento das lojas.</li>
    <li>Em caso de dúvida sobre sua folga ou horário, procure a liderança.</li>
  </ul>
</div>` });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const list = [];
  for (let i = 0; i < slides.length; i++) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><div class="slide">${slides[i].html}${foot(i+1, slides.length)}</div></body></html>`;
    await p.setContent(html, { waitUntil: 'networkidle' }).catch(() => p.setContent(html));
    const f = path.join(OUT, `s${String(i+1).padStart(2,'0')}.png`);
    await p.screenshot({ path: f });
    const over = await p.evaluate(() => document.querySelector('.slide').scrollHeight > 1080);
    list.push({ f, dur: slides[i].dur, over });
  }
  fs.writeFileSync(path.join(OUT, 'slides.json'), JSON.stringify(list, null, 1));
  console.log(list.map(x => `${path.basename(x.f)} ${x.dur}s ${x.over ? 'OVERFLOW' : ''}`).join('\n'));
  await b.close();
})();
