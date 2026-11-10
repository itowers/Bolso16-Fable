// Roda tudo: T1–T14 e T17 em teste.html, T15 (interface) e T16 (PWA) no app. Uso: npm run teste [-- --atualizar] [--rapido] [--prints]
// Navegador: WebKit se estiver instalado (npx playwright install webkit); senão, o Chrome do sistema.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright'; import { servir } from './servidor.mjs';
const aqui = path.dirname(fileURLToPath(import.meta.url)), arg = f => process.argv.includes(f);
const TAM = { externo: [390, 844], interno: [538, 765], largo: [1076, 765] };
const { srv, url } = await servir();
let nav, motor = 'webkit';
try { nav = await webkit.launch(); } catch (e) { motor = 'chrome'; nav = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); }
const R = [], reg = (id, nome, ok, det) => { R.push({ id, nome, ok: !!ok, det }); console.log(`${ok ? 'OK   ' : 'FALHA'} ${id} ${nome}: ${det}`); };
const abre = async (cx, q = '') => { const p = await cx.newPage(); p.on('pageerror', e => console.log('  [erro na página]', e.message)); await p.goto(url + q); await p.waitForSelector('html[data-pronto]', { timeout: 15000 }); return p; };

// ---------- T1–T14, T17 ----------
{
  const cx = await nav.newContext(), p = await cx.newPage(); p.on('pageerror', e => console.log('  [erro na página]', e.message));
  await p.goto(url + 'teste.html?auto=1' + (arg('--rapido') ? '&rapido=1' : '') + (arg('--atualizar') ? '&atualizar=1' : ''));
  await p.waitForFunction(() => window.resultado, null, { timeout: 240000 });
  for (const r of await p.evaluate(() => window.resultado)) reg(r.id, r.nome, r.ok, r.det);
  if (arg('--atualizar')) { const h = await p.evaluate(() => window.hashAtual), f = path.join(aqui, 'golden.json'), g = JSON.parse(fs.readFileSync(f, 'utf8')); g[h.nav] = h.h; fs.writeFileSync(f, JSON.stringify(g, null, 1) + '\n'); console.log('  golden.json atualizado para', h.nav); }
  await cx.close();
}
// ---------- T9 (parte 2): recarregar o app de verdade ----------
{
  const cx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }), q = '?semsw&db=t9-' + Date.now(), p = await abre(cx, q);
  const antes = await p.evaluate(async () => { const A = B16, E = A.E, P = E.padroes[3]; E.ui.pad = 3; E.bpm = 133; E.swing = 45; P.tom = 7; P.escala = 'Blues'; P.notas[9][5] = [60]; P.travas[9][5] = { rat: 3, corte: 1234 }; P.sons[9].comp = 12; E.kit.sons[4].vozEstilo = 'mono'; E.master.duck.prof = .8; E.cfg.lat = .02;
    const id = await A.addAmostra(new Float32Array(4000).map((_, i) => Math.sin(i / 5)), 44100, 'seno'); A.usaAmostra(9, id); E.kit.sons[9].fonte = 'chop'; E.kit.sons[9].fatias = [{ ini: 0, fim: .04 }, { ini: .04, fim: .09 }]; A.salvaJa(); await new Promise(r => setTimeout(r, 400));
    return JSON.stringify([E.bpm, E.swing, P.tom, P.escala, P.notas[9], P.travas[9], P.sons[9].comp, E.kit.sons[4].vozEstilo, E.master.duck.prof, E.cfg.lat, E.kit.sons[9].fatias, E.ui.pad]); });
  await p.reload(); await p.waitForSelector('html[data-pronto]');
  const depois = await p.evaluate(() => { const E = B16.E, P = E.padroes[3]; return [JSON.stringify([E.bpm, E.swing, P.tom, P.escala, P.notas[9], P.travas[9], P.sons[9].comp, E.kit.sons[4].vozEstilo, E.master.duck.prof, E.cfg.lat, E.kit.sons[9].fatias, E.ui.pad]), B16.amostras.size, E.kit.sons[9].amostra && B16.amostras.has(E.kit.sons[9].amostra.id)]; });
  // backup: exporta, zera, importa
  const volta = await p.evaluate(async () => { const A = B16, b = JSON.parse(JSON.stringify(await A.exporta())); A.carregaEstado((await import('./app/dados.js')).novoEstado()); const zerou = A.E.bpm !== 133; await A.importaBackup(b); return zerou && A.E.bpm === 133 && A.amostras.size === 1 && A.E.padroes[3].travas[9][5].corte === 1234; });
  const i = R.findIndex(r => r.id === 'T9'), ok = antes === depois[0] && depois[1] === 1 && depois[2] && volta;
  R[i].ok = R[i].ok && ok; R[i].det += ` · recarregar o app: ${antes === depois[0] ? 'estado idêntico' : 'ESTADO MUDOU'}, amostra ${depois[2] ? 'voltou' : 'SUMIU'} · exportar/zerar/importar backup: ${volta ? 'ok' : 'FALHOU'}`;
  console.log(`${ok ? 'OK   ' : 'FALHA'} T9 (recarga real): ${R[i].det.split(' · ').slice(-2).join(' · ')}`); await cx.close();
}
// ---------- T15 Interface ----------
const FUN = JSON.parse(fs.readFileSync(path.join(aqui, 'funcoes.json'), 'utf8'));
const medir = () => { // roda dentro da página: rótulos numa linha, alvos ≥ 44, contraste ≥ 4,5
  const vis = e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.closest('[hidden]')) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none') return false;
    for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'hidden' || o === 'scroll') { const q = p.getBoundingClientRect(); if (r.bottom <= q.top + 1 || r.top >= q.bottom - 1) return false; } } return true; };
  const cor = t => { const m = t.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const fundo = e => { const pilha = []; for (let p = e; p; p = p.parentElement) { const c = cor(getComputedStyle(p).backgroundColor); if (c.a > 0) { pilha.push(c); if (c.a >= 1) break; } } let b = { r: 0, g: 0, b: 0 }; for (const c of pilha.reverse()) b = { r: c.r * c.a + b.r * (1 - c.a), g: c.g * c.a + b.g * (1 - c.a), b: c.b * c.a + b.b * (1 - c.a) }; return b; };
  const ruins = [], nome = e => (e.dataset.id || e.id || e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 28);
  let rot = 0, alvos = 0, textos = 0, cmin = 99;
  for (const e of document.querySelectorAll('#app button, #app .rt, #app .val, #app h2, #pos, #visor, #app .heroNome, #app .heroSub')) {
    if (!vis(e)) continue; rot++;
    if (e.scrollWidth > e.clientWidth + 1) ruins.push(`estoura: "${nome(e)}" ${e.scrollWidth}>${e.clientWidth}`);
    for (const t of e.querySelectorAll('span, b, small')) { if (t.children.length || !t.textContent.trim()) continue; const lh = parseFloat(getComputedStyle(t).lineHeight) || parseFloat(getComputedStyle(t).fontSize) * 1.25; if (t.getBoundingClientRect().height > lh * 1.7) ruins.push(`quebra linha: "${nome(t)}"`); }
    if (!e.children.length && e.textContent.trim()) { const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.25; if (e.tagName !== 'BUTTON' && e.getBoundingClientRect().height > lh * 1.7) ruins.push(`quebra linha: "${nome(e)}"`); }
  }
  for (const e of document.querySelectorAll('#app button, #app input[type=range], #atualiza')) { if (!vis(e)) continue; alvos++; const r = e.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) ruins.push(`alvo pequeno: "${nome(e)}" ${r.width.toFixed(0)}×${r.height.toFixed(0)}`); }
  const w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!n.textContent.trim() || !vis(e) || e.closest(':disabled') || e.closest('#aviso')) continue; textos++;
    const s = getComputedStyle(e), c = cor(s.color), b = fundo(e), f = { r: c.r * c.a + b.r * (1 - c.a), g: c.g * c.a + b.g * (1 - c.a), b: c.b * c.a + b.b * (1 - c.a) }, l1 = lum(f), l2 = lum(b), k = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    cmin = Math.min(cmin, k); if (k < 4.5) ruins.push(`contraste ${k.toFixed(2)}: "${n.textContent.trim().slice(0, 20)}"`); }
  const d = document.documentElement, c = document.getElementById('corpo'), tocar = document.getElementById('app').dataset.aba === 'tocar';
  if (d.scrollWidth > innerWidth || d.scrollHeight > innerHeight) ruins.push(`página rola ${d.scrollWidth}×${d.scrollHeight}`);
  if (c.scrollWidth > c.clientWidth + 1) ruins.push(`corpo rola na horizontal ${c.scrollWidth}>${c.clientWidth}`);
  if (tocar && c.scrollHeight > c.clientHeight + 1) ruins.push(`aba Tocar rola ${c.scrollHeight}>${c.clientHeight}`);
  if (tocar) { const s = document.getElementById('sup').getBoundingClientRect(); if (s.bottom > innerHeight + .5 || s.right > innerWidth + .5) ruins.push('superfície cortada'); }
  return { ruins, rot, alvos, textos, cmin };
};
const ESTADOS = [ // [nome, preparo dentro da página]
  ['Tocar teclado', A => { A.u.aba = 'tocar'; A.u.modo = 'tocar'; A.E.ui.som = 0; }], ['Tocar pads', A => { A.E.ui.som = 11; }], ['Tocar + REC', A => { A.rel.rec = true; }], ['FX efeitos + REC', A => { A.u.modo = 'fx'; A.u.fxSub = 'efeitos'; }],
  ['FX fita', A => { A.rel.rec = false; A.u.fxSub = 'fita'; }], ['Perf + REC', A => { A.u.modo = 'perf'; A.rel.rec = true; }], ['Perf teclado', A => { A.rel.rec = false; A.E.ui.som = 2; }],
  ['Folha Tempo', A => { A.u.modo = 'tocar'; A.u.folha = 'tempo'; }], ['Folha Tom', A => { A.u.folha = 'tom'; }], ['Folha Sons', A => { A.u.folha = 'sons'; }],
  ['Sequência', A => { A.u.folha = null; A.u.aba = 'seq'; A.E.ui.som = 0; A.u.todosSons = true; }], ['Sequência tudo', A => { A.u.seqVer = 'tudo'; }], ['Folha Passo', A => { A.u.seqVer = 'pagina'; A.u.folha = 'passo'; A.u.folhaArg = 0; A.E.padroes[0].travas[0][0] = { comp: 7, mel: { t: 'salto', a: 'ini' } }; }],
  ['Folha Som na seq', A => { A.u.folha = 'somSeq'; }], ['Folha Editar', A => { A.u.folha = 'editar'; A.E.cadeia = [0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 15, 14, 13, 12]; }], ['Banner copiar', A => { A.u.folha = null; A.u.armar = { tipo: 'copiaPad', de: 0 }; }],
  ['Som', A => { A.u.armar = null; A.u.aba = 'som'; A.u.somSub = 'som'; }], ['Som bateria', A => { A.E.ui.som = 9; }], ['Fonte synth', A => { A.u.somSub = 'fonte'; }], ['Fonte textura', A => { A.E.kit.sons[9].fonte = 'textura'; }], ['Master', A => { A.E.kit.sons[9].fonte = 'synth'; A.u.somSub = 'master'; }],
  ['Bib kits', A => { A.u.aba = 'bib'; A.u.bibSub = 'kits'; }], ['Bib padrões', A => { A.u.bibSub = 'padroes'; }], ['Bib amostras', A => { A.u.bibSub = 'amostras'; }], ['Bib backup', A => { A.u.bibSub = 'backup'; }], ['Bib config', A => { A.u.bibSub = 'config'; }], ['Bib ajuda', A => { A.u.bibSub = 'ajuda'; }],
];
{
  const falhas = [], num = { rot: 0, alvos: 0, textos: 0, cmin: 99, estados: 0, linhas: 0 };
  for (const [nome, [w, h]] of Object.entries(TAM)) {
    const cx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 }), p = await abre(cx, '?semsw&db=t15-' + nome + Date.now());
    const lay = await p.evaluate(() => document.getElementById('app').dataset.layout); if (lay !== nome) falhas.push(`${nome}: layout "${lay}"`);
    // (a–d) medidas em cada estado da interface
    for (const [en, prep] of ESTADOS) {
      await p.evaluate(`(${prep.toString()})(B16); B16.pinta();`); await p.waitForTimeout(arg('--prints') ? 260 : 40);
      const m = await p.evaluate(medir); num.estados++; num.rot += m.rot; num.alvos += m.alvos; num.textos += m.textos; num.cmin = Math.min(num.cmin, m.cmin);
      for (const r of m.ruins) falhas.push(`${nome} · ${en} · ${r}`);
      if (arg('--prints') && ['Tocar teclado', 'Tocar pads', 'Sequência', 'Som', 'Bib kits', 'FX efeitos + REC', 'Perf teclado', 'Folha Tempo', 'Folha Tom', 'Folha Passo', 'Folha Editar', 'Folha Som na seq', 'Fonte synth', 'Master', 'Bib config'].includes(en)) { fs.mkdirSync(path.join(aqui, 'prints'), { recursive: true }); await p.screenshot({ path: path.join(aqui, 'prints', `${nome}-${en.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`) }); }
    }
    // (e) cada linha da tabela: no máx. 2 toques a partir da aba, sem segurar nada
    for (const f of FUN) {
      await p.evaluate(([aba, som]) => { const A = B16; if (A.rel.tocando) { A.rel.stop(); A.perf.parou(); } A.rel.rec = false; Object.assign(A.u, { aba, modo: 'tocar', fxSub: 'efeitos', somSub: 'som', bibSub: 'kits', folha: null, armar: null, seqVer: 'pagina', seqPag: 0, todosSons: false }); A.E.ui.som = som; A.E.ui.pad = 0; A.rel.tr.pad = 0; A.pinta(); }, [f.aba, f.som]);
      let erro = '';
      if (f.toques.length > 2) erro = 'mais de 2 toques';
      for (const t of f.toques) { try { const l = p.locator(t).first(); await l.scrollIntoViewIfNeeded({ timeout: 1500 }); await l.tap({ timeout: 1500 }); } catch (e) { erro = `não consegui tocar em ${t}`; break; } await p.waitForTimeout(30); }
      if (!erro) for (const a of f.alvos) {
        const ok = await p.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.closest('[hidden]')) return false; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && (e.contains(x) || x.contains(e)); }, a);
        if (!ok) { erro = `não alcança ${a}`; break; }
      }
      num.linhas++; if (erro) falhas.push(`${nome} · "${f.funcao.slice(0, 40)}" (${f.lugar}): ${erro}`);
    }
    // (f) superfície certa para cada tipo de som
    const sup = await p.evaluate(async () => { const A = B16, tipo = s => { if (A.rel.tocando) A.rel.stop(); A.u.aba = 'tocar'; A.u.modo = 'tocar'; A.u.folha = null; A.E.ui.som = s; A.pinta(); return document.getElementById('sup').dataset.tipo + ':' + document.querySelectorAll('#sup [data-tecla]').length + ':' + document.querySelectorAll('#sup [data-pad]').length; };
      const a = tipo(2), b = tipo(11), sr = 44100, d = new Float32Array(sr).map((_, i) => Math.sin(2 * Math.PI * 440 * i / sr) * .5), id = await A.addAmostra(d, sr, 'la'); A.usaAmostra(1, id); const c = tipo(1);
      const { Motor } = await import('./app/motor.js'), ctx = new OfflineAudioContext(1, sr * .5, sr), M = new Motor(ctx, A.E, A.amostras, { offline: true }); M.tocar(1, 72, .01, .3, {}); const ch = (await ctx.startRendering()).getChannelData(0); let z = 0; for (let i = sr * .1; i < sr * .3; i++) if (ch[i] <= 0 && ch[i + 1] > 0) z++;
      return { a, b, c, hz: z / .2, fonte: A.E.kit.sons[1].fonte }; });
    if (sup.a !== 'tec:7:0') falhas.push(`${nome}: som 3 não abriu o teclado (${sup.a})`); if (sup.b !== 'pads:0:16') falhas.push(`${nome}: som 12 não abriu os pads (${sup.b})`);
    if (sup.c !== 'tec:7:0' || Math.abs(sup.hz - 880) > 12) falhas.push(`${nome}: amostra no som 2 → ${sup.c}, uma oitava acima deu ${sup.hz} Hz (esperava 880)`);
    num.hz = sup.hz;
    // multitoque: dois pads ao mesmo tempo
    if (nome === 'externo') { const mt = await p.evaluate(() => { const A = B16; A.E.ui.som = 8; A.pinta(); const [a, b] = [document.querySelector('[data-pad="0"]'), document.querySelector('[data-pad="1"]')], ev = (e, t, id) => e.dispatchEvent(new PointerEvent(t, { pointerId: id, bubbles: true, pointerType: 'touch', isPrimary: id === 11 })); ev(a, 'pointerdown', 11); ev(b, 'pointerdown', 12); const juntos = a.classList.contains('ap') && b.classList.contains('ap'); ev(a, 'pointerup', 11); ev(b, 'pointerup', 12); return juntos && !a.classList.contains('ap'); }); if (!mt) falhas.push('multitoque: dois pads não ficaram apertados juntos'); }
    await cx.close();
  }
  // (g) dobrar/desdobrar troca o layout sem recarregar nem perder estado
  {
    const cx = await nav.newContext({ viewport: { width: 538, height: 765 }, hasTouch: true }), p = await abre(cx, '?semsw&db=t15-dobra' + Date.now());
    await p.evaluate(() => { window.__marca = 1; const A = B16; A.u.aba = 'seq'; A.E.ui.som = 5; A.E.bpm = 101; A.pinta(); document.getElementById('play').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    const le = () => p.evaluate(() => [document.getElementById('app').dataset.layout, window.__marca, B16.u.aba, B16.E.ui.som, B16.E.bpm, B16.rel.tocando].join());
    const a = await le(); await p.setViewportSize({ width: 1076, height: 765 }); await p.waitForTimeout(150); const b = await le(); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150); const c = await le();
    if (a !== 'interno,1,seq,5,101,true' || b !== 'largo,1,seq,5,101,true' || c !== 'externo,1,seq,5,101,true') falhas.push(`dobrar: ${a} → ${b} → ${c}`);
    num.dobra = `${a.split(',')[0]} → ${b.split(',')[0]} → ${c.split(',')[0]}`; await cx.close();
  }
  reg('T15', 'Interface', !falhas.length, `3 tamanhos × ${ESTADOS.length} estados: ${num.rot} rótulos numa linha, ${num.alvos} alvos ≥ 44 px, ${num.textos} textos com contraste mín ${num.cmin.toFixed(2)}:1 · ${FUN.length} linhas da tabela × 3 tamanhos alcançadas em ≤ 2 toques · som 3 = teclado, som 12 = pads, amostra no som 2 = teclado afinado (${num.hz} Hz) · dobrar: ${num.dobra} sem perder estado` + (falhas.length ? ` · ${falhas.length} FALHAS: ` + falhas.slice(0, 14).join(' | ') : ''));
  if (falhas.length > 14) console.log(falhas.slice(14).join('\n'));
}
// ---------- T16 PWA ----------
{
  const cx = await nav.newContext({ viewport: { width: 390, height: 844 } }), p = await abre(cx, '?db=t16-' + Date.now()), det = [];
  const man = await (await fetch(url + 'manifest.webmanifest')).json(), icones = await Promise.all(man.icons.map(async i => (await fetch(url + i.src)).ok));
  const manOk = man.name && man.short_name && man.display === 'standalone' && man.start_url && man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512') && icones.every(Boolean);
  det.push(`manifest ${manOk ? 'válido' : 'INVÁLIDO'} (standalone, ${man.icons.length} ícones)`);
  const sw = await p.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise(x => setTimeout(() => x(null), 8000))]); if (!r) return false; for (let i = 0; i < 40 && !(await caches.keys()).length; i++) await new Promise(x => setTimeout(x, 100)); const c = await caches.open((await caches.keys())[0]); return (await c.keys()).length; });
  det.push(sw ? `service worker ativo, ${sw} arquivos em cache` : 'service worker NÃO registrou');
  await cx.setOffline(true); let off = false;
  try { await p.reload({ timeout: 10000 }); await p.waitForSelector('html[data-pronto]', { timeout: 8000 }); off = await p.evaluate(() => !!document.querySelector('#abas button') && !!B16.M && document.styleSheets.length > 0 && getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'); } catch (e) { }
  det.push(off ? 'abre offline depois da primeira carga' : 'NÃO abriu offline');
  reg('T16', 'PWA', manOk && sw && off, det.join(' · ')); await cx.close();
}
R.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
fs.writeFileSync(path.join(aqui, 'resultado.json'), JSON.stringify({ quando: new Date().toISOString(), navegador: motor + ' ' + nav.version(), ok: R.filter(r => r.ok).length, total: R.length, testes: R }, null, 1) + '\n');
console.log(`\nRESUMO (${motor} ${nav.version()}): ${R.filter(r => r.ok).length}/${R.length} OK`);
await nav.close(); srv.close(); process.exit(R.every(r => r.ok) ? 0 : 1);
