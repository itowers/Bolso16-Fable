// Esquema de dados, kit de fábrica, padrão demo e migração. Sem dependência de áudio ou DOM.
export const V = 2; // versão do esquema
export const DIVS = [['1/32', 2], ['1/16', 1], ['1/8', .5], ['1/4', .25], ['1/2', .125], ['1 comp', 1 / 16], ['2 comp', 1 / 32]];
export const fatorDiv = d => (DIVS.find(x => x[0] === d) || DIVS[1])[1];
export const DURS = [['1/64', .25], ['1/32', .5], ['1/16', 1], ['1/8', 2], ['1/4', 4], ['1/2', 8], ['1 comp', 16], ['Drone', Infinity]];
export const CONDS = ['sempre', '1:2', '2:2', '1:4', '50%', 'FILL', '!FILL'];
export const COMPS = [8, 16, 32, 64];
export const CORES = ['#FF9F0A', '#FF375F', '#64D2FF', '#30D158', '#BF5AF2'];
export const FX = [
  { id: 'loop4', n: 'Loop 4' }, { id: 'loop3', n: 'Loop 3' }, { id: 'loop2', n: 'Loop 2' }, { id: 'loop1', n: 'Loop 1' },
  { id: 'stutter', n: 'Stutter' }, { id: 'retrig', n: 'Retrig' }, { id: '68', n: '6/8' }, { id: 'oitU', n: 'Oit ↑' },
  { id: 'oitD', n: 'Oit ↓' }, { id: 'uni', n: 'Uníss' }, { id: 'rev', n: 'Revers' }, { id: 'scr', n: 'Scratch' },
  { id: 'filt', n: 'Filtro' }, { id: 'eco', n: 'Eco' }, { id: 'gate', n: 'Gate' },
];
export const PARAMS_TRAVA = ['corte', 'res', 'a', 'd', 's', 'r', 'vol', 'pan'];

const P0 = { o1: 'saw', o2: '', semi: 0, det: 0, mix: .5, ruido: 0, rHP: 0, fm: 0, fmR: 2, fmD: .3, fmS: .2, pEnv: 0, pDec: .05, nota: 60, palma: 0, ftipo: 'lowpass', corte: 8000, res: .7, fEnv: 0, fDec: .2, a: .005, d: .3, s: .7, r: .2, vol: .8, pan: 0 };
const som = (nome, cor, params, extra = {}) => ({
  nome, cor, fonte: 'synth', params: { ...P0, ...params }, insert: 'nada', vozEstilo: 'poly', duracao: 3, ligado: -1,
  oitava: 0, inversao: 0, lastChord: null, estilo: 'acorde', strum: 1, arp: { vel: 2, ordem: '↑', ritmo: 0, alc: 1 },
  amostra: null, fatias: [], tex: { on: false, frz: false }, ...extra,
});
export function kitFabrica() {
  return {
    nome: 'Fábrica', sons: [
      som('Piano El', 0, { o1: 'sine', fm: 1.4, fmR: 1, fmD: .5, fmS: .15, corte: 5200, a: .003, d: 1.1, s: .25, r: .3, vol: .85 }, { duracao: 4 }),
      som('Pad', 0, { o1: 'saw', o2: 'saw', det: 14, corte: 1500, res: 1, a: .3, d: .6, s: .8, r: .9, vol: .6 }, { duracao: 5 }),
      som('Baixo Sub', 2, { o1: 'sine', o2: 'tri', mix: .3, corte: 700, a: .004, d: .25, s: .75, r: .1, vol: .95 }, { oitava: -2, estilo: 'nota', vozEstilo: 'mono', duracao: 3 }),
      som('Baixo Ác', 2, { o1: 'saw', corte: 420, res: 11, fEnv: 3.2, fDec: .16, a: .003, d: .2, s: .35, r: .08, vol: .6 }, { oitava: -2, estilo: 'nota', vozEstilo: 'mono', duracao: 2 }),
      som('Lead', 4, { o1: 'sq', o2: 'saw', det: 8, mix: .4, corte: 3400, res: 1.5, a: .008, d: .2, s: .8, r: .14, vol: .5 }, { estilo: 'nota', vozEstilo: 'legato', oitava: 1 }),
      som('Pluck', 4, { o1: 'saw', o2: 'sq', semi: 12, mix: .25, corte: 700, res: 2, fEnv: 3.6, fDec: .12, a: .002, d: .24, s: 0, r: .18, vol: .7 }, { estilo: 'arp', duracao: 2 }),
      som('Órgão', 3, { o1: 'sine', o2: 'sine', semi: 12, mix: .4, corte: 6000, a: .004, d: .05, s: 1, r: .05, vol: .55 }, { duracao: 3 }),
      som('Sino', 3, { o1: 'sine', fm: 2.6, fmR: 3.5, fmD: 1.2, fmS: .05, corte: 9000, a: .002, d: 1.6, s: 0, r: 1.2, vol: .5 }, { oitava: 1, estilo: 'nota', duracao: 4 }),
      som('Bumbo', 1, { o1: 'sine', nota: 30, pEnv: 30, pDec: .05, corte: 6000, a: .001, d: .3, s: 0, r: .08, vol: 1 }, { vozEstilo: 'retrig' }),
      som('Caixa', 1, { o1: 'tri', nota: 54, pEnv: 9, pDec: .03, ruido: .9, rHP: 1400, corte: 9000, a: .001, d: .15, s: 0, r: .06, vol: .8 }, { vozEstilo: 'retrig' }),
      som('Palma', 1, { o1: '', ruido: 1, palma: 1, ftipo: 'bandpass', corte: 1300, res: 1.4, a: .001, d: .16, s: 0, r: .08, vol: .75 }, { vozEstilo: 'retrig' }),
      som('Chimbal F', 3, { o1: '', ruido: 1, ftipo: 'highpass', corte: 7500, res: .8, a: .001, d: .035, s: 0, r: .02, vol: .5 }, { vozEstilo: 'mono' }),
      som('Chimbal A', 3, { o1: '', ruido: 1, ftipo: 'highpass', corte: 6800, res: .8, a: .001, d: .32, s: 0, r: .1, vol: .45 }, { vozEstilo: 'mono' }),
      som('Tom', 2, { o1: 'sine', nota: 45, pEnv: 10, pDec: .08, corte: 5000, a: .001, d: .26, s: 0, r: .08, vol: .85 }, { vozEstilo: 'retrig' }),
      som('Perc', 4, { o1: 'sq', o2: 'sq', semi: 7, nota: 73, ftipo: 'bandpass', corte: 1800, res: 3, a: .001, d: .07, s: 0, r: .04, vol: .55 }, { vozEstilo: 'retrig' }),
      som('Ruído FX', 4, { o1: 'sine', nota: 72, pEnv: 30, pDec: .3, ruido: .5, corte: 400, res: 4, fEnv: 4.5, fDec: .35, a: .002, d: .45, s: 0, r: .2, vol: .5 }, { vozEstilo: 'retrig' }),
    ],
  };
}
export function novoPadrao() {
  return {
    comprimento: 16, tom: 0, escala: 'Mai', prog: 0,
    sons: Array.from({ length: 16 }, (_, s) => ({ comp: 16, div: '1/16', mute: false, solo: false, tonal: s > 0 && s < 8 ? 'segue' : 'ignora' })),
    notas: Array.from({ length: 16 }, () => ({})), ac: Array.from({ length: 16 }, () => ({})),
    travas: Array.from({ length: 16 }, () => ({})), fx: {}, dj: {}, fita: {},
  };
}
export const temNotas = P => P.notas.some(o => Object.keys(o).length > 0);
// Padrão demo: acordes I–V–vi–IV, baixo comp 8 seguindo a progressão, arp no Pluck e bateria.
export function padraoDemo() {
  const P = novoPadrao(); P.comprimento = 32; P.sons.forEach(x => x.comp = 32);
  [[0, 0, [60, 64, 67]], [8, 4, [67, 71, 74]], [16, 5, [69, 72, 76]], [24, 3, [65, 69, 72]]].forEach(([p, g, n]) => {
    P.notas[0][p] = n; P.ac[0][p] = { grau: g, var: '', inv: 0 }; P.travas[0][p] = { comp: 7 };
  });
  P.sons[2].comp = 8; [0, 3, 6].forEach(p => P.notas[2][p] = [36]); P.notas[2][7] = [43];
  P.sons[5].comp = 16; [60, 64, 67, 72, 67, 64, 60, 64, 67, 72, 76, 72, 67, 64, 67, 72].forEach((n, i) => { if (i % 4 !== 3) P.notas[5][i] = [n]; });
  P.sons[8].comp = 16; [0, 7, 10].forEach(p => P.notas[8][p] = [60]);
  P.sons[9].comp = 16; [4, 12].forEach(p => P.notas[9][p] = [60]); P.travas[9][12] = { rat: 2, cond: '2:2' };
  P.sons[11].comp = 12; [0, 2, 4, 6, 8, 10, 11].forEach(p => P.notas[11][p] = [60]);
  P.sons[12].comp = 16; P.notas[12][14] = [60];
  return P;
}
export function novoEstado() {
  return {
    v: V, kit: kitFabrica(), padroes: [padraoDemo(), ...Array.from({ length: 15 }, novoPadrao)],
    cadeia: [], cadeiaOn: false, bpm: 96, swing: 30,
    cfg: { contagem: 1, met: 'rec', rept: 'off', metVol: .6, fade: .008, lat: 0 },
    master: { duck: { on: true, gatilho: 8, prof: .35, solt: .16 }, dust: 0, vol: .9, dj: 0 },
    perf: { q: '1 comp', faixas: Array.from({ length: 4 }, novaFaixa) },
    ui: { som: 0, pad: 0 },
  };
}
export const novaFaixa = () => ({ ev: [], comp: 0, camada: 0, refaz: [], estado: 'vazia', mute: false, fb: 1 });

// ---------- Comprimento: esticar duplica, encurtar não apaga ----------
export function defineComprimento(P, novo) {
  const ant = P.comprimento; if (novo === ant) return;
  P.sons.forEach((S, s) => {
    if (S.comp !== ant) return; // som com comprimento próprio (polimetria) não acompanha
    if (novo > ant) {
      const teto = S.max || ant; // até onde já houve conteúdo próprio: não duplica por cima
      for (const k of ['notas', 'ac', 'travas']) {
        const o = P[k][s];
        for (const key of Object.keys(o)) { const p = +key; if (p >= ant) continue;
          for (let q = p + ant; q < novo; q += ant) if (q >= teto && o[q] === undefined) o[q] = JSON.parse(JSON.stringify(o[p])); }
      }
      S.max = Math.max(teto, novo);
    } else S.max = Math.max(S.max || 0, ant);
    S.comp = novo;
  });
  P.comprimento = novo;
}
export function deslocaSom(P, s, d) {
  const c = P.sons[s].comp;
  for (const k of ['notas', 'ac', 'travas']) {
    const o = P[k][s], n = {};
    for (const key of Object.keys(o)) { const p = +key; if (p < c) n[((p + d) % c + c) % c] = o[key]; else n[p] = o[key]; }
    P[k][s] = n;
  }
}
export const clona = o => JSON.parse(JSON.stringify(o));

// ---------- Migração ----------
// v1 (esquema inicial): notas de bateria como 1/true, sem ac/travas/dj/fita/perf, cfg sem lat/fade, sons sem estilo/arp.
export function migra(e) {
  if (!e || typeof e !== 'object') return novoEstado();
  let v = e.v || 1;
  if (v < 2) {
    const base = novoEstado();
    e.kit = e.kit || base.kit;
    e.kit.sons = (e.kit.sons || []).map((x, i) => ({ ...base.kit.sons[i], ...x, params: { ...base.kit.sons[i].params, ...(x.params || {}) } }));
    while (e.kit.sons.length < 16) e.kit.sons.push(base.kit.sons[e.kit.sons.length]);
    e.padroes = (e.padroes || []).map(P => {
      const N = novoPadrao();
      N.comprimento = P.comprimento || P.len || 16; N.tom = P.tom || 0; N.escala = P.escala || 'Mai'; N.prog = P.prog || 0;
      (P.sons || []).forEach((S, s) => Object.assign(N.sons[s], S));
      N.sons.forEach(S => { if (!S.comp) S.comp = N.comprimento; });
      (P.notas || []).forEach((o, s) => { for (const k of Object.keys(o || {})) { const x = o[k]; if (x) N.notas[s][k] = Array.isArray(x) ? x : [60]; } });
      (P.travas || []).forEach((o, s) => { if (o) N.travas[s] = o; });
      if (P.fx) N.fx = P.fx;
      return N;
    });
    while (e.padroes.length < 16) e.padroes.push(novoPadrao());
    e.cfg = { ...base.cfg, ...(e.cfg || {}) }; e.master = { ...base.master, ...(e.master || {}), duck: { ...base.master.duck, ...((e.master || {}).duck || {}) } };
    e.perf = e.perf || base.perf; e.ui = e.ui || base.ui; e.cadeia = e.cadeia || []; e.bpm = e.bpm || 120; e.swing = e.swing || 0;
    v = 2;
  }
  e.v = V;
  // saneamento que vale para qualquer versão
  const b = novoEstado();
  e.cfg = { ...b.cfg, ...e.cfg }; e.master = { ...b.master, ...e.master, duck: { ...b.master.duck, ...(e.master && e.master.duck) } };
  e.ui = { ...b.ui, ...e.ui }; if (!e.perf || !e.perf.faixas) e.perf = b.perf;
  e.perf.faixas.forEach(f => { if (f.estado === 'rec' || f.estado === 'overdub') f.estado = f.ev.length ? 'play' : 'vazia'; });
  e.padroes.forEach(P => { for (const k of ['fx', 'dj', 'fita']) if (!P[k]) P[k] = {}; for (const k of ['notas', 'ac', 'travas']) for (let s = 0; s < 16; s++) if (!P[k][s]) P[k][s] = {}; });
  e.kit.sons.forEach(x => { if (!x.tex) x.tex = { on: false, frz: false }; x.tex.on = false; if (!x.fatias) x.fatias = []; });
  return e;
}
