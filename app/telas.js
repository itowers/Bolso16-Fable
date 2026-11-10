// Abas Sequência, Som e Biblioteca, e todas as folhas (Tempo, Tom e estilo, Escolher som, Passo, Som na sequência, Editar padrão).
import { A } from './nucleo.js';
import { el, ic, bt, seg, linha, passos, barra, chave, titulo, cartao, confirma, confirmando } from './dom.js';
import { CORES, DIVS, DURS, CONDS, COMPS, temNotas, clona, defineComprimento, deslocaSom, novoPadrao, novoEstado } from './dados.js';
import { acorde, ESC_NOMES, NOMES_TOM, MODOS_TONAL, ARP_VEL, ARP_ORDEM, ARP_RITMO, mod } from './teoria.js';
import { renderOffline } from './relogio.js';
import { detectaAtaques, fatiasDe, marcasGrade, compassosDe, normaliza, mono } from './amostras.js';

const pct = v => Math.round(v * 100) + '%', ms = v => Math.round(v * 1000) + ' ms', seg2 = v => v < 1 ? ms(v) : v.toFixed(1) + ' s';
const hzDe = v => 40 * Math.pow(450, v), vDe = hz => Math.log(hz / 40) / Math.log(450), fhz = hz => hz >= 1000 ? (hz / 1000).toFixed(1) + ' k' : Math.round(hz) + ' Hz';
const cabSom = extra => { const s = A.E.ui.som, som = A.som(); return el('div', { class: 'cab' },
  bt(ic('esq'), () => { A.E.ui.som = mod(s - 1, 16); A.u.seqPag = 0; A.pinta(); }, { label: 'Som anterior', class: 'q' }),
  el('button', { type: 'button', class: 'bt nome', 'data-id': 'escolheSom', onclick: () => A.abreFolha('sons'), style: `--cor:${CORES[som.cor]}` }, el('i', { class: 'pt' }), el('span', { text: `Som ${s + 1}` }), ic('baixo')),
  bt(ic('dir'), () => { A.E.ui.som = mod(s + 1, 16); A.u.seqPag = 0; A.pinta(); }, { label: 'Próximo som', class: 'q' }), extra); };

// ================= Sequência =================
function tocaPadrao(i) {
  const E = A.E, u = A.u;
  if (u.armar && u.armar.tipo === 'copiaPad') { E.padroes[i] = clona(E.padroes[u.armar.de]); u.armar = null; A.aviso(`Copiado para P${i + 1}`); }
  else if (u.armar && u.armar.tipo === 'cadeia') { if (E.cadeia.length < 128) E.cadeia.push(i); }
  else { A.rel.armaPadrao(i); u.seqPag = 0; }
  A.sujo(); A.pinta();
}
function tocaPasso(loc) {
  const E = A.E, P = A.P(), s = E.ui.som, som = A.som();
  if (P.notas[s][loc]) { A.abreFolha('passo', loc); return; }
  const lc = som.lastChord || (s < 8 ? { notas: acorde(P.tom, P.escala, 0, '', som.inversao, som.oitava).notas, ac: { grau: 0, var: '', inv: som.inversao } } : { notas: [60] });
  P.notas[s][loc] = lc.notas.slice(); if (lc.ac) P.ac[s][loc] = { ...lc.ac };
  if (!A.rel.tocando) A.toca(s, lc.notas, { grava: false, lembra: false });
  A.sujo(); A.pinta();
}
const nomeAc = (P, a) => a ? acorde(P.tom, P.escala, a.grau, a.var, 0, 0).nome : '';
function infoSom(P, s) {
  const S = P.sons[s];
  if (s === P.prog && s < 8) return 'PROG';
  if (s < 8 && S.tonal === 'segue' && S.comp === P.comprimento && S.div === '1/16') return 'segue PROG';
  return `${S.comp}·${S.div}`;
}
export function pintaSequencia(c) {
  const E = A.E, u = A.u, rel = A.rel, pad = A.pad(), P = E.padroes[pad], s = E.ui.som, S = P.sons[s];
  const pags = Math.ceil(S.comp / 16); if (u.seqPag >= pags) u.seqPag = 0;
  c.append(el('div', { class: 'grade8', role: 'group', 'aria-label': 'Padrões' }, E.padroes.map((X, i) => el('button', { type: 'button', class: 'pd', 'data-padrao': i, 'aria-pressed': String(i === pad), 'data-arm': rel.tr.prox === i ? '1' : '0', 'aria-label': `Padrão ${i + 1}`, onclick: () => tocaPadrao(i) }, String(i + 1), temNotas(X) ? el('i', { class: 'pt' }) : null))));
  const btF = bt('Fill', null, { id: 'fillSeq', on: false, class: 'fill' });
  btF.addEventListener('pointerdown', e => { e.preventDefault(); try { btF.setPointerCapture(e.pointerId); } catch (x) { } rel.tr.fill = true; btF.setAttribute('aria-pressed', 'true'); });
  const sF = () => { rel.tr.fill = false; btF.setAttribute('aria-pressed', 'false'); }; btF.addEventListener('pointerup', sF); btF.addEventListener('pointercancel', sF);
  c.append(el('div', { class: 'ln3' },
    bt(`${P.comprimento} passos`, () => A.abreFolha('editar'), { id: 'comprimento' }), bt('Editar', () => A.abreFolha('editar'), { id: 'editar', class: 'txt' }), btF,
    seg('Ver', [['pagina', 'Página'], ['tudo', 'Tudo']], u.seqVer, v => { u.seqVer = v; A.pinta(); }, { semRotulo: true, id: 'ver' })));
  if (E.cadeiaOn && E.cadeia.length) { const t = E.cadeia.map(x => x + 1).join(' › '); c.append(el('p', { class: 'nota', text: 'Cadeia: ' + (t.length > 34 ? t.slice(0, 33) + '…' : t) })); }
  c.append(cabSom([el('span', { class: 'val', text: infoSom(P, s) }), bt('Ajustar', () => A.abreFolha('somSeq'), { id: 'ajustarSom', class: 'txt' })]));
  if (pags > 1 && u.seqVer === 'pagina') c.append(el('div', { class: 'ln3' },
    seg('Página', Array.from({ length: pags }, (_, i) => [i, 'Pág ' + (i + 1)]), u.seqPag, v => { u.seqPag = v; u.seguir = false; A.pinta(); }, { semRotulo: true, id: 'pags' }),
    bt('Seguir', () => { u.seguir = !u.seguir; A.pinta(); }, { on: u.seguir, id: 'seguir' })));
  const ini = u.seqVer === 'tudo' ? 0 : u.seqPag * 16, fim = u.seqVer === 'tudo' ? S.comp : Math.min(S.comp, ini + 16), g = el('div', { class: 'grade8 passos', role: 'group', 'aria-label': 'Passos' });
  for (let p = ini; p < fim; p++) {
    const n = P.notas[s][p], a = P.ac[s][p], tv = P.travas[s][p];
    g.append(el('button', { type: 'button', class: 'ps' + (n ? ' cheio' : '') + (tv && Object.keys(tv).length ? ' tv' : '') + (p % 4 === 0 ? ' t1' : ''), 'data-passo': p, style: `--cor:${CORES[A.som().cor]}`, 'aria-label': `Passo ${p + 1}${n ? ' com nota' : ' vazio'}`, onclick: () => tocaPasso(p) },
      el('small', { text: String(p + 1) }), el('b', { text: n ? (a && s < 8 ? nomeAc(P, a) : s < 8 && n.length === 1 ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n[0] % 12] : '●') : '' })));
  }
  c.append(g);
  // lista de sons do padrão
  const lista = el('div', { class: 'sons' });
  for (let k = 0; k < 16; k++) {
    const tem = Object.keys(P.notas[k]).length > 0; if (!tem && !u.todosSons && k !== s) continue;
    const X = P.sons[k], som = E.kit.sons[k], mini = el('span', { class: 'mini', 'data-mini': k, 'data-pag': u.seqPag });
    for (let i = 0; i < 16; i++) { const p = u.seqPag * 16 + i; mini.append(el('i', { class: p >= X.comp ? 'fora' : P.notas[k][p] ? 'on' : '' })); }
    lista.append(el('div', { class: 'sl', 'data-luz': k, style: `--cor:${CORES[som.cor]}` },
      el('button', { type: 'button', class: 'slb', 'aria-pressed': String(k === s), 'aria-label': `Som ${k + 1} ${som.nome}`, 'data-som': k, onclick: () => {
        if (u.armar && u.armar.tipo === 'copiaSom') { const d = u.armar.de; for (const key of ['notas', 'ac', 'travas']) P[key][k] = clona(P[key][d]); P.sons[k].comp = P.sons[d].comp; P.sons[k].div = P.sons[d].div; u.armar = null; A.aviso(`Copiado para o som ${k + 1}`); A.sujo(); }
        else { E.ui.som = k; u.seqPag = 0; } A.pinta();
      } }, el('i', { class: 'pt' }), el('span', { class: 'nm', text: som.nome }), el('span', { class: 'inf', text: infoSom(P, k) }), mini),
      bt('M', () => { X.mute = !X.mute; A.sujo(); A.pinta(); }, { on: X.mute, label: `Mudo: som ${k + 1}`, class: 'q' }),
      bt('S', () => { X.solo = !X.solo; A.sujo(); A.pinta(); }, { on: X.solo, label: `Solo: som ${k + 1}`, class: 'q' })));
  }
  c.append(lista, bt(u.todosSons ? 'Só sons com notas' : 'Mostrar os 16 sons', () => { u.todosSons = !u.todosSons; A.pinta(); }, { id: 'todosSons', class: 'txt larga' }));
}

// ================= Som =================
export function pintaSom(c) {
  const E = A.E, u = A.u, s = E.ui.som, som = A.som(), p = som.params, bat = s >= 8, set = (k, f) => (v, fim) => { A.setParam(s, k, f ? f(v) : v); if (fim) A.pinta(); };
  c.append(cabSom(el('span', { class: 'val nomeSom', text: som.nome })), seg('Seção', [['som', 'Som'], ['fonte', 'Fonte'], ['master', 'Master']], u.somSub, v => { u.somSub = v; A.pinta(); }, { semRotulo: true, id: 'somSub' }));
  if (u.somSub === 'som') {
    if (A.rel.rec && A.rel.tocando) c.append(el('p', { class: 'nota', text: 'REC ligado: cada ajuste vira trava no passo que soa' }));
    c.append(cartao(titulo('Filtro e envelope'),
      seg('Tipo', [['lowpass', 'LP'], ['highpass', 'HP'], ['bandpass', 'BP']], p.ftipo, v => { p.ftipo = v; A.sujo(); A.pinta(); }, { id: 'ftipo' }),
      barra('Corte', 0, 1, .005, vDe(p.corte), v => fhz(hzDe(v)), set('corte', hzDe), { id: 'corte' }),
      barra('Resson', .1, 20, .1, p.res, v => v.toFixed(1), set('res'), { id: 'res' }),
      barra('Ataque', .001, 2, .001, p.a, seg2, set('a'), { id: 'a' }), barra('Decai', .005, 3, .005, p.d, seg2, set('d'), { id: 'd' }),
      barra('Sust', 0, 1, .01, p.s, pct, set('s'), { id: 's' }), barra('Solta', .005, 3, .005, p.r, seg2, set('r'), { id: 'r' })),
      cartao(titulo('Volume e pan'),
        barra('Volume', 0, 1, .01, p.vol, pct, set('vol'), { id: 'vol' }), barra('Pan', -1, 1, .02, p.pan, v => Math.abs(v) < .02 ? 'centro' : (v < 0 ? 'E ' : 'D ') + Math.round(Math.abs(v) * 100), set('pan'), { id: 'pan' })),
      cartao(titulo('Voz'),
        seg('Insert', [['nada', 'Nada'], ['drive', 'Drive'], ['crush', 'Crush'], ['filtro', 'Filtro']], som.insert, v => { som.insert = v; A.M.atualiza(s); A.sujo(); A.pinta(); }, { id: 'insert' }),
        seg('Estilo', bat ? [['retrig', 'Retrig'], ['mono', 'Mono'], ['gate', 'Gate'], ['loop', 'Loop']] : [['poly', 'Poly'], ['mono', 'Mono'], ['legato', 'Legato']], som.vozEstilo, v => { som.vozEstilo = v; A.sujo(); A.pinta(); }, { id: 'vozEstilo' }),
        passos('Duração', DURS[som.duracao][0], () => { som.duracao = Math.max(0, som.duracao - 1); A.sujo(); A.pinta(); }, () => { som.duracao = Math.min(DURS.length - 1, som.duracao + 1); A.sujo(); A.pinta(); }, { id: 'duracao' }),
        passos('Ligado a', som.ligado < 0 ? 'nenhum' : `${som.ligado + 1} ${E.kit.sons[som.ligado].nome}`, () => { som.ligado = som.ligado <= -1 ? 15 : som.ligado - 1; if (som.ligado === s) som.ligado--; A.sujo(); A.pinta(); }, () => { som.ligado = som.ligado >= 15 ? -1 : som.ligado + 1; if (som.ligado === s) som.ligado = som.ligado >= 15 ? -1 : som.ligado + 1; A.sujo(); A.pinta(); }, { id: 'ligado', setas: true })));
  } else if (u.somSub === 'fonte') pintaFonte(c);
  else {
    const m = E.master, d = m.duck, ap = () => { A.M.aplicaMaster(); A.sujo(); };
    c.append(cartao(titulo('Duck'),
      chave('Ligado', d.on, v => { d.on = v; ap(); A.pinta(); }, { id: 'duckOn' }),
      passos('Gatilho', `${d.gatilho + 1} ${E.kit.sons[d.gatilho].nome}`, () => { d.gatilho = mod(d.gatilho - 1, 16); ap(); A.pinta(); }, () => { d.gatilho = mod(d.gatilho + 1, 16); ap(); A.pinta(); }, { id: 'duckGat', setas: true }),
      barra('Prof', 0, 1, .01, d.prof, pct, v => { d.prof = v; A.sujo(); }, { id: 'duckProf' }), barra('Solt', .03, .4, .005, d.solt, ms, v => { d.solt = v; A.sujo(); }, { id: 'duckSolt' })),
      cartao(titulo('Saída'),
        linha('Limitador', el('span', { class: 'val', text: 'sempre ligado' })),
        barra('Dust', 0, 1, .01, m.dust, pct, v => { m.dust = v; ap(); }, { id: 'dust' }), barra('Volume', 0, 1, .01, m.vol, pct, v => { m.vol = v; ap(); }, { id: 'volMaster' })));
  }
}
const ONDAS = [['', '—'], ['sine', 'Sen'], ['tri', 'Tri'], ['saw', 'Serra'], ['sq', 'Quad']];
function pintaFonte(c) {
  const E = A.E, u = A.u, s = E.ui.som, som = A.som(), p = som.params, bat = s >= 8, am = som.amostra && A.amostras.get(som.amostra.id), g = u.gravando;
  const sp = k => (v, fim) => { p[k] = v; A.sujo(); if (fim) A.pinta(); };
  const fontes = [['synth', 'Synth'], ['amostra', 'Amostra'], ['chop', 'CHOP'], ['textura', 'Textura']];
  c.append(seg('Fonte', fontes, som.fonte, v => {
    if ((v === 'chop' || v === 'textura') && !bat) { A.aviso('Fatias e textura ficam nos pads (sons 9–16)'); return; }
    if ((v === 'amostra' || v === 'chop') && !am) { A.aviso('Grave ou importe uma amostra primeiro'); u.semAm = v; }
    if (som.tex.on) A.M.texLiga(s, false); som.fonte = v === 'amostra' && !am ? som.fonte : v; if (v === 'chop' && !am) som.fonte = 'synth'; A.sujo(); A.pinta();
  }, { semRotulo: true, id: 'fonte' }));
  const inp = el('input', { type: 'file', accept: '.wav,.mp3,.m4a,.aac,audio/*', hidden: true, id: 'arqAudio', onchange: e => { const f = e.target.files[0]; if (f) A.importa(f); } });
  const gravar = cartao(titulo('Amostra'),
    el('div', { class: 'ln' }, el('span', { class: 'rt larga', text: am ? `${am.nome} · ${am.buf.duration.toFixed(1)} s` : 'sem amostra' }), g && g.g ? el('span', { class: 'val', id: 'gravT', text: '0.0 s' }) : null),
    el('div', { class: 'ln3' },
      el('button', { type: 'button', class: 'bt', 'data-id': 'gravar', 'aria-pressed': String(!!(g && g.tipo !== 'master')), onclick: () => A.gravaMic() }, ic('mic'), el('span', { text: g && g.tipo !== 'master' ? 'Parar' : 'Gravar' })),
      bt('Importar', () => inp.click(), { id: 'importar' }),
      bt(g && g.tipo === 'master' ? 'Parar' : 'Reamostrar', () => A.reamostra(), { id: 'reamostrar', on: !!(g && g.tipo === 'master') })), inp,
    chave('Contagem', u.micCont, v => { u.micCont = v; A.pinta(); }, { id: 'micCont' }),
    el('p', { class: 'nota', text: 'Até 40 s por gravação. O início em silêncio é cortado.' }));
  if (som.fonte === 'synth') c.append(cartao(titulo('Osciladores'),
    seg('Onda 1', ONDAS, p.o1, v => { p.o1 = v; A.sujo(); A.pinta(); }, { id: 'o1' }), seg('Onda 2', ONDAS, p.o2, v => { p.o2 = v; A.sujo(); A.pinta(); }, { id: 'o2' }),
    barra('Mistura', 0, 1, .01, p.mix, pct, sp('mix'), { id: 'mix' }), barra('Desafin', 0, 50, 1, p.det, v => v + ' ct', sp('det'), { id: 'det' }),
    barra('Ruído', 0, 1, .01, p.ruido, pct, sp('ruido'), { id: 'ruido' }), barra('FM', 0, 4, .05, p.fm, v => v.toFixed(1), sp('fm'), { id: 'fm' })), gravar);
  else if (som.fonte === 'amostra') c.append(gravar);
  else if (som.fonte === 'chop') {
    if (!som.marcas) som.marcas = som.fatias.filter(Boolean).map(f => f.ini);
    const comp = am ? compassosDe(am.buf.duration, E.bpm) : 0, onda = el('canvas', { class: 'onda', id: 'onda', 'aria-label': 'Forma de onda com as marcas das fatias' });
    c.append(cartao(titulo('CHOP'),
      onda,
      el('div', { class: 'ln3' }, bt(u.chopTap ? 'Marcar' : 'TAP', () => chopTap(), { id: 'chopTap', on: !!u.chopTap }), bt('Ataques', () => { som.marcas = detectaAtaques(am.dados, am.sr, u.sens); A.aviso(`${som.marcas.length} ataques`); A.sujo(); A.pinta(); }, { id: 'chopAtaques' }),
        bt('Grade', () => { som.marcas = marcasGrade(am.buf.duration, u.grade); A.aviso(`Grade de ${u.grade}` + (comp ? ` · alinhada a ${comp} comp` : '')); A.sujo(); A.pinta(); }, { id: 'chopGrade' })),
      passos('Sens', Math.round(u.sens * 100) + '', () => { u.sens = Math.max(0, +(u.sens - .1).toFixed(1)); A.pinta(); }, () => { u.sens = Math.min(1, +(u.sens + .1).toFixed(1)); A.pinta(); }, { id: 'chopSens' }),
      seg('Partes', [[4, '4'], [8, '8'], [16, '16']], u.grade, v => { u.grade = v; A.pinta(); }, { id: 'chopPartes' }),
      el('div', { class: 'ln3' }, el('span', { class: 'val', text: `${som.marcas.length} marcas` }),
        bt(confirmando('dist') ? 'Confirmar?' : 'Distribuir', () => confirma('dist', () => distribui(), A.pinta), { id: 'chopDistribuir' })),
      el('p', { class: 'nota', text: 'Arraste uma marca para mover. Toque duplo apaga.' })), gravar);
    requestAnimationFrame(() => desenhaOnda(onda));
  } else c.append(cartao(titulo('Textura'),
    chave('Tocando', som.tex.on, v => { A.M.texLiga(s, v); A.pinta(); }, { id: 'texOn' }), chave('Freeze', som.tex.frz, v => { som.tex.frz = v; A.sujo(); A.pinta(); }, { id: 'texFrz' }),
    el('p', { class: 'nota', text: 'Loop fora da grade. Volume e filtro ficam em Som. Sem amostra, usa um ambiente sintetizado.' })), gravar);
}
function distribui() {
  const som = A.som(), am = A.amostras.get(som.amostra.id), fs = fatiasDe(som.marcas, am.buf.duration); let i = 0, n = 0;
  const slots = Array.from({ length: 16 }, (_, k) => som.fatias[k] || null);
  for (const f of fs) { while (i < 16 && slots[i]) i++; if (i >= 16) break; slots[i++] = f; n++; }
  som.fatias = slots; A.u.pagFatia = 0; A.aviso(`${n} fatias nos pads`); A.sujo(); A.pinta();
}
function chopTap() {
  const u = A.u, som = A.som(), am = A.amostras.get(som.amostra.id), ctx = A.ctx;
  if (!u.chopTap) {
    const src = ctx.createBufferSource(); src.buffer = am.buf; src.connect(A.M.canal(A.E.ui.som).ent); const t0 = ctx.currentTime + .01; src.start(t0);
    u.chopTap = { src, t0, m: [0] }; src.onended = () => { if (u.chopTap && u.chopTap.src === src) { som.marcas = u.chopTap.m; u.chopTap = null; A.aviso(`${som.marcas.length} fatias por TAP`); A.sujo(); A.pinta(); } };
    A.aviso('Toque em Marcar a cada fatia'); A.pinta();
  } else { const pos = ctx.currentTime - A.rel.lat - u.chopTap.t0; if (pos > .02 && pos < am.buf.duration) u.chopTap.m.push(pos); }
}
function desenhaOnda(cv) {
  const som = A.som(), am = som.amostra && A.amostras.get(som.amostra.id); if (!am || !cv.isConnected) return;
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), W = cv.width = Math.round(r.width * d), H = cv.height = Math.round(r.height * d), g = cv.getContext('2d'), x = am.dados, D = am.buf.duration;
  const css = getComputedStyle(document.documentElement), cor = css.getPropertyValue('--text2').trim() || '#999', ac = css.getPropertyValue('--accent').trim() || '#FF9F0A';
  const des = () => {
    g.clearRect(0, 0, W, H); g.fillStyle = cor; const passo = Math.max(1, Math.floor(x.length / W));
    for (let i = 0; i < W; i++) { let m = 0; for (let j = i * passo, f = Math.min(x.length, j + passo); j < f; j += 8) m = Math.max(m, Math.abs(x[j])); g.fillRect(i, H / 2 - m * H * .46, 1, Math.max(1, m * H * .92)); }
    g.fillStyle = ac; som.marcas.forEach((m, i) => { g.fillRect(Math.round(m / D * W) - d, 0, 2 * d, H); g.font = `${11 * d}px sans-serif`; g.fillText(String(i + 1), m / D * W + 3 * d, 12 * d); });
  };
  des();
  let arr = -1, ult = { i: -1, t: 0 };
  const perto = e => { const px = (e.clientX - r.left) / r.width * D; let bi = -1, bd = 14 / r.width * D; som.marcas.forEach((m, i) => { const dd = Math.abs(m - px); if (dd < bd) { bd = dd; bi = i; } }); return [bi, px]; };
  cv.onpointerdown = e => { e.preventDefault(); const [bi, px] = perto(e), ag = performance.now();
    if (bi >= 0 && ult.i === bi && ag - ult.t < 350) { som.marcas.splice(bi, 1); ult = { i: -1, t: 0 }; A.sujo(); A.pinta(); return; }
    if (bi < 0) { if (som.marcas.length < 16) { som.marcas.push(Math.max(0, Math.min(D, px))); som.marcas.sort((a, b) => a - b); A.sujo(); A.pinta(); } return; }
    ult = { i: bi, t: ag }; arr = bi; try { cv.setPointerCapture(e.pointerId); } catch (z) { } };
  cv.onpointermove = e => { if (arr < 0) return; som.marcas[arr] = Math.max(0, Math.min(D * .999, (e.clientX - r.left) / r.width * D)); des(); };
  cv.onpointerup = cv.onpointercancel = () => { if (arr >= 0) { arr = -1; som.marcas.sort((a, b) => a - b); A.sujo(); des(); } };
}
// PERF › Reamost: render offline das 4 faixas, no compasso, para um pad.
export async function reamostraPerf() {
  const P = A.perf.paraPadrao(); if (!P) { A.aviso('Nada gravado nas faixas'); return; }
  A.aviso('Reamostrando…');
  const E2 = clona(A.E); E2.padroes[0] = P; E2.cadeiaOn = false; E2.master.dust = 0;
  const r = await renderOffline(E2, A.amostras, { passos: P.comprimento, sr: A.ctx.sampleRate, cauda: .05 });
  const d = normaliza(mono(r.buf)).slice(Math.round(r.t0 * r.sr), Math.round((r.t0 + P.comprimento * r.sd) * r.sr));
  const id = await A.addAmostra(d, r.sr, 'Loop PERF'), sons = A.E.kit.sons; let alvo = sons.findIndex((x, i) => i >= 8 && x.livre); if (alvo < 0) alvo = 15;
  const x = sons[alvo]; x.fonte = 'amostra'; x.amostra = { id, ini: 0, fim: d.length / r.sr, raiz: 60 }; x.fatias = []; x.nome = 'Loop PERF'; x.vozEstilo = 'retrig'; x.livre = false; x.params.a = .002; x.params.r = .03; x.params.corte = 18000; x.params.ftipo = 'lowpass'; x.params.fEnv = 0;
  A.sujo(); A.aviso(`Faixas → áudio no pad ${alvo + 1}`); A.pinta();
}

// ================= Biblioteca =================
async function carregaBib() { A.bib = A.banco.db ? (await Promise.all((await A.banco.chaves('biblio')).map(async k => ({ k, ...(await A.banco.get('biblio', k)) })))).sort((a, b) => a.quando < b.quando ? 1 : -1) : []; A.pinta(); }
async function salvaBib(tipo, dados, base) { const n = (A.bib || []).filter(x => x.tipo === tipo).length + 1; if (!A.banco.db) { A.aviso('Sem armazenamento neste aparelho'); return; } await A.banco.set('biblio', tipo + Date.now(), { tipo, nome: `${base} ${n}`, dados: clona(dados), quando: new Date().toISOString() }); A.aviso(`${base} ${n} salvo`); carregaBib(); }
const AJUDA = [
  ['Tocar', 'Sons 1–8 tocam no teclado de 7 acordes; o joystick trava uma variação até você tocar no ●. Sons 9–16 tocam nos pads: embaixo os 8 sons, em cima as fatias ou afinações do som escolhido. FX e Perf trocam o painel do meio.'],
  ['Sequência', 'Escolha o padrão na fileira 1–16. Toque num passo vazio para escrever o último acorde tocado; toque num passo cheio para ajustar repetição, micro, condição, efeito e trava. Editar cuida de comprimento, cópia e cadeia.'],
  ['Som', 'Filtro, envelope, volume, insert e estilo de voz do som atual. Em Fonte você grava do microfone, importa e fatia (CHOP). Em Master ficam Duck, Dust e volume. Com REC ligado e tocando, cada ajuste vira trava no passo.'],
  ['Biblioteca', 'Guarde kits e padrões, veja as amostras, exporte ou importe um backup e ajuste metrônomo, fade e latência em Config.'],
  ['Pílula', 'REC grava ao vivo (com contagem). PLAY toca e para. Toque no BPM para abrir Tempo: BPM, TAP, swing, metrônomo e REPT.'],
];
export function pintaBiblioteca(c) {
  const E = A.E, u = A.u; if (!A.bib) { A.bib = []; carregaBib(); }
  c.append(seg('Seção', [['kits', 'Kits'], ['padroes', 'Padrões'], ['amostras', 'Amostr'], ['backup', 'Backup'], ['config', 'Config'], ['ajuda', 'Ajuda']], u.bibSub, v => { u.bibSub = v; A.pinta(); }, { semRotulo: true, id: 'bibSub' }));
  const lista = (tipo, usar) => A.bib.filter(x => x.tipo === tipo).map(x => el('div', { class: 'ln' }, el('span', { class: 'rt larga', text: x.nome }),
    bt('Usar', () => usar(x), { class: 'txt' }), bt(confirmando('del' + x.k) ? 'Conf?' : 'Apagar', () => confirma('del' + x.k, async () => { await A.banco.del('biblio', x.k); carregaBib(); }, A.pinta), { class: 'txt' })));
  if (u.bibSub === 'kits') c.append(cartao(titulo('Kits'),
    el('div', { class: 'ln3' }, bt('Salvar kit atual', () => salvaBib('kit', E.kit, 'Kit'), { id: 'salvarKit' }), bt(confirmando('fab') ? 'Confirmar?' : 'Kit de fábrica', () => confirma('fab', () => { A.kitFabrica(); A.aviso('Kit de fábrica carregado'); }, A.pinta), { id: 'kitFabrica' })),
    lista('kit', x => { E.kit = clona(x.dados); A.M.aplicaMaster(); A.sujo(); A.aviso(x.nome + ' carregado'); A.pinta(); }), A.bib.some(x => x.tipo === 'kit') ? null : el('p', { class: 'nota', text: 'Nenhum kit salvo ainda.' })));
  else if (u.bibSub === 'padroes') c.append(cartao(titulo('Padrões salvos'),
    el('div', { class: 'ln3' }, bt(`Salvar P${A.pad() + 1}`, () => salvaBib('padrao', A.P(), 'Padrão'), { id: 'salvarPadrao' })),
    lista('padrao', x => { E.padroes[A.pad()] = clona(x.dados); A.sujo(); A.aviso(`${x.nome} → P${A.pad() + 1}`); A.pinta(); }), A.bib.some(x => x.tipo === 'padrao') ? null : el('p', { class: 'nota', text: 'Nenhum padrão salvo ainda. "Usar" carrega no padrão atual.' })));
  else if (u.bibSub === 'amostras') {
    const as = [...A.amostras.values()], tot = as.reduce((a, x) => a + x.dados.length * 4, 0), mb = b => (b / 1048576).toFixed(1) + ' MB';
    c.append(cartao(titulo('Amostras'), linha('Uso total', el('span', { class: 'val', id: 'usoAmostras', text: mb(tot) })),
      as.map(x => el('div', { class: 'ln' }, el('span', { class: 'rt larga', text: `${x.nome} · ${x.buf.duration.toFixed(1)} s · ${mb(x.dados.length * 4)}` }),
        bt('Usar', () => { A.usaAmostra(E.ui.som, x.id); A.aviso(`No som ${E.ui.som + 1}`); A.pinta(); }, { class: 'txt' }), bt(confirmando('da' + x.id) ? 'Conf?' : 'Apagar', () => confirma('da' + x.id, async () => { await A.delAmostra(x.id); A.pinta(); }, A.pinta), { class: 'txt' }))),
      as.length ? null : el('p', { class: 'nota', text: 'Nenhuma amostra. Grave ou importe em Som › Fonte.' })));
  } else if (u.bibSub === 'backup') {
    const inp = el('input', { type: 'file', accept: '.json,application/json', hidden: true, id: 'arqBackup', onchange: async e => { const f = e.target.files[0]; if (!f) return; try { await A.importaBackup(JSON.parse(await f.text())); A.aviso('Backup restaurado'); } catch (x) { A.aviso('Arquivo de backup inválido'); } } });
    c.append(cartao(titulo('Backup'), el('div', { class: 'ln3' },
      bt('Exportar', async () => { const blob = new Blob([JSON.stringify(await A.exporta())], { type: 'application/json' }), nome = `bolso16-${new Date().toISOString().slice(0, 10)}.json`;
        try { const f = new File([blob], nome, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (x) { if (x && x.name === 'AbortError') return; }
        const a = el('a', { href: URL.createObjectURL(blob), download: nome }); document.body.append(a); a.click(); a.remove(); A.aviso('Backup exportado'); }, { id: 'exportar', class: 'txt' }),
      bt('Importar', () => inp.click(), { id: 'importarBackup', class: 'txt' })), inp,
      el('p', { class: 'nota', text: 'Um arquivo .json com kit, padrões, ajustes e amostras. Importar substitui tudo.' })));
  } else if (u.bibSub === 'config') {
    const cf = E.cfg, cal = u.calib;
    const toque = el('button', { type: 'button', class: 'bt larga', 'data-id': 'calToque' }, cal ? `Toque junto com o clique · ${cal.toques.length}/8` : 'Calibrar latência');
    toque.addEventListener('pointerdown', e => { e.preventDefault(); calibra(); });
    c.append(cartao(titulo('Configurações'),
      barra('Vol MET', 0, 1, .01, cf.metVol, pct, v => { cf.metVol = v; A.sujo(); }, { id: 'metVol' }),
      barra('Fade', 0, .05, .001, cf.fade, ms, v => { cf.fade = v; A.sujo(); }, { id: 'fade' }),
      passos('Latência', (cf.lat >= 0 ? '+' : '') + Math.round(cf.lat * 1000) + ' ms', () => { cf.lat = Math.max(-.08, +(cf.lat - .005).toFixed(3)); A.sujo(); A.pinta(); }, () => { cf.lat = Math.min(.08, +(cf.lat + .005).toFixed(3)); A.sujo(); A.pinta(); }, { id: 'latencia' }),
      toque, el('p', { class: 'nota', text: 'Calibrar: toque 8 vezes junto com o metrônomo. A mediana do erro vira o ajuste.' })),
      cartao(titulo('Tudo de novo'), bt(confirmando('zera') ? 'Confirmar: apaga tudo?' : 'Voltar ao estado de fábrica', () => confirma('zera', () => { A.carregaEstado(novoEstado()); A.aviso('Estado de fábrica'); }, A.pinta), { id: 'zerar', class: 'txt larga' })));
  } else c.append(cartao(titulo('Ajuda'), AJUDA.map(([t, x]) => el('p', { class: 'aj' }, el('b', { text: t + '. ' }), x))));
}
function calibra() {
  const u = A.u, ctx = A.ctx, cf = A.E.cfg;
  if (!u.calib) { const t0 = ctx.currentTime + .8; u.calib = { cliques: Array.from({ length: 14 }, (_, i) => t0 + i * .5), toques: [] }; u.calib.cliques.forEach((t, i) => A.M.clique(t, i % 4 === 0)); u.calib.fim = setTimeout(() => { u.calib = null; A.pinta(); }, 8500); A.pinta(); return; }
  const t = ctx.currentTime - A.rel.lat, c = u.calib.cliques.reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a); u.calib.toques.push(t - c);
  if (u.calib.toques.length >= 8) { const m = [...u.calib.toques].sort((a, b) => a - b), med = (m[3] + m[4]) / 2; cf.lat = Math.max(-.08, Math.min(.08, +med.toFixed(3))); clearTimeout(u.calib.fim); u.calib = null; A.sujo(); A.aviso(`Latência ajustada: ${Math.round(cf.lat * 1000)} ms`); }
  A.pinta();
}

// ================= Folhas =================
let taps = [];
export function pintaFolha(f) {
  const E = A.E, u = A.u, nome = u.folha, P = A.P(), s = E.ui.som, som = A.som(), S = P.sons[s], re = () => { A.sujo(); A.pinta(); };
  const cab = t => el('div', { class: 'fcab' }, el('h2', { text: t }), bt(ic('fechar'), () => A.fechaFolha(), { label: 'Fechar', class: 'q' }));
  if (nome === 'tempo') {
    const cf = E.cfg, bpm = d => { E.bpm = Math.max(60, Math.min(240, E.bpm + d)); re(); };
    f.append(cab('Tempo'),
      linha('BPM', el('div', { class: 'stp', 'data-id': 'bpmStp' }, el('button', { type: 'button', 'aria-label': 'BPM menos', 'data-id': 'bpmMenos', onclick: () => bpm(-1) }, '−'), el('span', { class: 'val', text: String(E.bpm) }), el('button', { type: 'button', 'aria-label': 'BPM mais', 'data-id': 'bpmMais', onclick: () => bpm(1) }, '+')),
        bt('TAP', () => { const t = performance.now(); taps = taps.filter(x => t - x < 2500); taps.push(t); if (taps.length > 1) { const m = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); E.bpm = Math.max(60, Math.min(240, Math.round(60000 / m))); re(); } }, { id: 'tap' })),
      passos('Swing', E.swing + '%', () => { E.swing = Math.max(0, E.swing - 5); re(); }, () => { E.swing = Math.min(100, E.swing + 5); re(); }, { id: 'swing' }),
      seg('Contagem', [[0, '0'], [1, '1 comp']], cf.contagem, v => { cf.contagem = v; re(); }, { id: 'contagem' }),
      seg('Metrôn', [['off', 'Desl.'], ['rec', 'No REC'], ['sempre', 'Sempre']], cf.met, v => { cf.met = v; re(); }, { id: 'met' }),
      seg('REPT', [['off', 'Desl'], ['1/8', '1/8'], ['1/16', '1/16'], ['1/32', '1/32']], cf.rept, v => { cf.rept = v; re(); }, { id: 'rept' }));
  } else if (nome === 'tom') {
    const a = som.arp;
    f.append(cab('Tom e estilo'),
      passos('Tom', NOMES_TOM[P.tom], () => { P.tom = mod(P.tom - 1, 12); re(); }, () => { P.tom = mod(P.tom + 1, 12); re(); }, { id: 'tomStp' }),
      seg('Escala', ESC_NOMES.map(x => [x, x]), P.escala, v => { P.escala = v; re(); }, { id: 'escala' }),
      seg('Inversão', [[0, 'F'], [1, '1ª'], [2, '2ª']], som.inversao, v => { som.inversao = v; re(); }, { id: 'inversao' }),
      passos('Oitava', (som.oitava > 0 ? '+' : '') + som.oitava, () => { som.oitava = Math.max(-3, som.oitava - 1); re(); }, () => { som.oitava = Math.min(3, som.oitava + 1); re(); }, { id: 'oitava' }),
      seg('Strum', [[0, 'Lento'], [1, 'Méd'], [2, 'Ráp']], som.strum, v => { som.strum = v; re(); }, { id: 'strum' }),
      seg('Arp vel', ARP_VEL.map((x, i) => [i, x[0]]), a.vel, v => { a.vel = v; re(); }, { id: 'arpVel' }),
      seg('Ordem', ARP_ORDEM.map(x => [x, x]), a.ordem, v => { a.ordem = v; re(); }, { id: 'arpOrdem' }),
      passos('Ritmo', `${a.ritmo + 1} ${ARP_RITMO[a.ritmo]}`, () => { a.ritmo = mod(a.ritmo - 1, 6); re(); }, () => { a.ritmo = mod(a.ritmo + 1, 6); re(); }, { id: 'arpRitmo' }),
      seg('Alcance', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], a.alc, v => { a.alc = v; re(); }, { id: 'arpAlc' }));
  } else if (nome === 'sons') {
    f.append(cab('Escolher som'), el('div', { class: 'grade4' }, E.kit.sons.map((x, i) => el('button', { type: 'button', class: 'bt somb', 'aria-pressed': String(i === s), style: `--cor:${CORES[x.cor]}`, 'data-somb': i, onclick: () => { E.ui.som = i; u.folha = null; u.seqPag = 0; re(); } }, el('small', { text: String(i + 1) }), el('span', { text: x.nome })))));
  } else if (nome === 'editar') {
    const pad = A.pad(), t = E.cadeia.map(x => x + 1).join(' › ');
    f.append(cab(`Editar padrão ${pad + 1}`),
      seg('Compr', COMPS.map(x => [x, String(x)]), P.comprimento, v => { defineComprimento(P, v); u.seqPag = 0; re(); }, { id: 'comprSeg' }),
      el('div', { class: 'ln3' }, bt('Copiar padrão para…', () => { u.armar = { tipo: 'copiaPad', de: pad }; u.folha = null; A.pinta(); }, { id: 'copiarPadrao' }),
        bt(confirmando('limpaP') ? 'Confirmar?' : 'Limpar padrão', () => confirma('limpaP', () => { const N = novoPadrao(); N.tom = P.tom; N.escala = P.escala; N.comprimento = P.comprimento; N.sons.forEach(x => x.comp = P.comprimento); E.padroes[pad] = N; re(); }, A.pinta), { id: 'limparPadrao' })),
      linha('Cadeia', el('span', { class: 'val', id: 'cadeiaTxt', text: t ? (t.length > 26 ? '…' + t.slice(-25) : t) : 'vazia' })),
      el('div', { class: 'ln3' }, bt('Montar', () => { u.armar = { tipo: 'cadeia' }; u.folha = null; A.pinta(); }, { id: 'cadeiaMontar' }), bt('Desfazer', () => { E.cadeia.pop(); re(); }, { id: 'cadeiaDesfazer' }), bt('Nova', () => { E.cadeia = []; E.cadeiaOn = false; re(); }, { id: 'cadeiaNova' })),
      chave('Tocar em cadeia', E.cadeiaOn, v => { E.cadeiaOn = v && E.cadeia.length > 0; if (v && !E.cadeia.length) A.aviso('Monte a cadeia primeiro'); re(); }, { id: 'cadeiaOn' }));
  } else if (nome === 'somSeq') {
    const di = DIVS.findIndex(x => x[0] === S.div);
    f.append(cab(`${som.nome} na sequência`),
      passos('Compr', String(S.comp), () => { S.comp = Math.max(1, S.comp - 1); re(); }, () => { S.comp = Math.min(64, S.comp + 1); re(); }, { id: 'somComp' }),
      passos('Divisão', S.div, () => { S.div = DIVS[Math.max(0, di - 1)][0]; re(); }, () => { S.div = DIVS[Math.min(DIVS.length - 1, di + 1)][0]; re(); }, { id: 'somDiv' }),
      passos('Deslocar', 'notas', () => { deslocaSom(P, s, -1); re(); }, () => { deslocaSom(P, s, 1); re(); }, { id: 'deslocar', setas: true }),
      el('div', { class: 'ln3' }, bt('Copiar som para…', () => { u.armar = { tipo: 'copiaSom', de: s }; u.todosSons = true; u.folha = null; A.pinta(); }, { id: 'copiarSom' }),
        bt(confirmando('limpaS') ? 'Confirmar?' : 'Limpar som', () => confirma('limpaS', () => { P.notas[s] = {}; P.ac[s] = {}; P.travas[s] = {}; re(); }, A.pinta), { id: 'limparSom' })),
      s < 8 ? chave('Conduz a harmonia', P.prog === s, v => { if (v) { P.prog = s; S.tonal = 'ignora'; } else A.aviso('Escolha outro som para conduzir'); re(); }, { id: 'conduz' }) : null,
      s < 8 ? chave('Segue a harmonia', S.tonal === 'segue' && P.prog !== s, v => { if (P.prog === s) { A.aviso('Este som conduz a harmonia'); return; } S.tonal = v ? 'segue' : 'ignora'; re(); }, { id: 'segue' }) : null);
  } else if (nome === 'passo') {
    const loc = u.folhaArg, n = P.notas[s][loc]; if (!n) { u.folha = null; f.hidden = true; return; }
    const T = P.travas[s][loc] || {}, mel = T.mel || {}, st = (k, v, padrao) => { const t = P.travas[s][loc] = P.travas[s][loc] || {}; if (v === padrao || v == null) delete t[k]; else t[k] = v; if (!Object.keys(t).length) delete P.travas[s][loc]; A.sujo(); }, sr = (k, v, d) => { st(k, v, d); A.pinta(); };
    const smel = o => { sr('mel', o); }, base = som.params;
    f.append(cab(`Passo ${loc + 1} · ${som.nome}`),
      seg('Repetir', [[1, '1×'], [2, '2×'], [3, '3×'], [4, '4×']], T.rat || 1, v => sr('rat', v, 1), { id: 'pRat' }),
      barra('Micro', -50, 50, 1, T.micro || 0, v => (v > 0 ? '+' : '') + v + '%', (v, fim) => { st('micro', v, 0); if (fim) A.pinta(); }, { id: 'pMicro' }),
      seg('Quando', CONDS.map(x => [x, x]), T.cond || 'sempre', v => sr('cond', v, 'sempre'), { id: 'pCond' }),
      passos('Duração', T.comp == null ? 'do som' : T.comp + ' p', () => sr('comp', T.comp == null ? null : T.comp <= 1 ? null : T.comp - 1), () => sr('comp', Math.min(64, (T.comp || 0) + 1)), { id: 'pComp' }));
    if (s < 8) {
      f.append(chave('Ligar à anterior', !!T.tie, v => sr('tie', v || null), { id: 'pTie' }),
        seg('Efeito', [['', '—'], ['quebra', 'Quebra'], ['rampaU', 'Rmp ↑'], ['rampaD', 'Rmp ↓'], ['glide', 'Glide'], ['varre', 'Varre'], ['salto', 'Salto']], mel.t || '', v => smel(v ? { t: v, ...(v === 'quebra' ? { n: 4, oit: 1 } : v === 'glide' ? { v: 8 } : v === 'varre' ? { alvo: 'filtro', n: 1 } : v === 'salto' ? { a: 'ini' } : { n: 4 }) } : null), { id: 'pMel' }));
      if (mel.t === 'quebra' || mel.t === 'rampaU' || mel.t === 'rampaD') f.append(passos('Passos', String(mel.n), () => smel({ ...mel, n: Math.max(2, mel.n - 1) }), () => smel({ ...mel, n: Math.min(6, mel.n + 1) }), { id: 'pMelN' }));
      if (mel.t === 'quebra') f.append(seg('Oitavas', [[1, '1'], [3, '3'], ['al', 'aleat']], mel.oit, v => smel({ ...mel, oit: v })));
      if (mel.t === 'glide') f.append(passos('Tempo', mel.v === 'al' ? 'aleat' : mel.v + '/8', () => smel({ ...mel, v: mel.v === 'al' ? 8 : mel.v <= 1 ? 'al' : mel.v - 1 }), () => smel({ ...mel, v: mel.v === 'al' ? 1 : mel.v >= 8 ? 'al' : mel.v + 1 })));
      if (mel.t === 'varre') f.append(seg('Alvo', [['filtro', 'Filtro'], ['tom', 'Tom'], ['pan', 'Pan']], mel.alvo, v => smel({ ...mel, alvo: v })), seg('Dura', [[1, '1 passo'], [4, '4 passos']], mel.n, v => smel({ ...mel, n: v })));
      if (mel.t === 'salto') f.append(seg('Vai para', [['ini', 'início'], ['2/4', '2/4'], ['3/4', '3/4'], ['4/4', '4/4'], ['+1', '+1'], ['-1', '−1'], ['al', 'aleat'], ['fica', 'fica']], mel.a, v => smel({ ...mel, a: v })));
      f.append(seg('Harmonia', MODOS_TONAL.map(x => [x, x]), T.tonal || '', v => sr('tonal', T.tonal === v ? null : v), { id: 'pTonal' }));
    }
    f.append(el('h3', { class: 'tit', text: 'Som só neste passo' }),
      barra('Corte', 0, 1, .005, vDe(T.corte ?? base.corte), v => fhz(hzDe(v)), (v, fim) => { st('corte', hzDe(v)); if (fim) A.pinta(); }, { id: 'pCorte' }),
      barra('Volume', 0, 1, .01, T.vol ?? base.vol, pct, (v, fim) => { st('vol', v); if (fim) A.pinta(); }, { id: 'pVol' }),
      barra('Pan', -1, 1, .02, T.pan ?? base.pan, v => Math.round(v * 100) + '', (v, fim) => { st('pan', v); if (fim) A.pinta(); }, { id: 'pPan' }),
      el('div', { class: 'ln3' },
        bt('Limpar travas', () => { const t = P.travas[s][loc]; if (t) { for (const k of ['corte', 'res', 'a', 'd', 's', 'r', 'vol', 'pan']) delete t[k]; if (!Object.keys(t).length) delete P.travas[s][loc]; } re(); }, { id: 'pLimpaTravas' }),
        bt(s < 8 ? 'Trocar pelo acorde atual' : 'Trocar pela última nota', () => { const lc = som.lastChord; if (!lc) { A.aviso('Toque algo neste som primeiro'); return; } P.notas[s][loc] = lc.notas.slice(); if (lc.ac) P.ac[s][loc] = { ...lc.ac }; else delete P.ac[s][loc]; re(); }, { id: 'pTrocar' })),
      bt('Apagar', () => { delete P.notas[s][loc]; delete P.ac[s][loc]; delete P.travas[s][loc]; u.folha = null; re(); }, { id: 'pApagar', class: 'txt larga' }));
  }
}
