// Testes automáticos T1–T14 e T17 (rodam no navegador, inclusive no iPhone, por teste.html).
// T15 (interface) e T16 (PWA) rodam pelo Playwright em testes/run.mjs.
import { novoEstado, novoPadrao, defineComprimento, migra, clona, FX, V } from '../app/dados.js';
import { acorde, freq, mod } from '../app/teoria.js';
import { renderOffline, Relogio, arpAgenda, agendaPasso, avanca, novoTransporte } from '../app/relogio.js';
import { Motor } from '../app/motor.js';
import { detectaAtaques, fatiasDe, paraBuffer } from '../app/amostras.js';
import { Banco } from '../app/banco.js';
import { Perf } from '../app/perf.js';
import { Ferro } from '../app/shader.js';

const WK = new URL('../app/fita-worklet.js', import.meta.url).href;
const R = [];
const reg = (id, nome, ok, det) => { R.push({ id, nome, ok: !!ok, det }); if (window.aoTestar) window.aoTestar(R[R.length - 1]); };
const motorNav = () => /Firefox/.test(navigator.userAgent) ? 'firefox' : /Chrome|Chromium|Edg/.test(navigator.userAgent) ? 'chrome' : 'webkit';

export function limpo() { const E = novoEstado(); E.padroes = Array.from({ length: 16 }, novoPadrao); E.bpm = 120; E.swing = 0; E.master.duck.on = false; E.master.dust = 0; E.master.dj = 0; E.kit.sons.forEach(s => s.ligado = -1); return E; }
export function clique(E, s) { Object.assign(E.kit.sons[s].params, { o1: 'sine', o2: '', ruido: 0, fm: 0, pEnv: 0, nota: 96, palma: 0, ftipo: 'lowpass', corte: 18000, res: .7, fEnv: 0, a: .001, d: .006, s: 0, r: .004, vol: 1, pan: 0 }); E.kit.sons[s].vozEstilo = 'retrig'; E.kit.sons[s].fonte = 'synth'; }
export function ataques(ch, sr, lim = .02, gap = .012) { const out = [], g = gap * sr; let quieto = Infinity, armado = false; for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > lim * .5) { if (quieto >= g) armado = true; quieto = 0; } else quieto++; if (armado && a > lim) { out.push(i / sr); armado = false; } } return out; }
const mediana = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
async function sha(buf) {
  const n = buf.length, C = buf.numberOfChannels, i16 = new Int16Array(n * C);
  for (let c = 0; c < C; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) i16[i * C + c] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))); }
  const h = await crypto.subtle.digest('SHA-256', i16.buffer); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Padrão de teste fixo do T1/T2: bumbo, caixa, chimbal, swing 30%, uma trava (e um micro).
export function padraoFixo() {
  const E = limpo(), P = E.padroes[0]; E.swing = 30; P.comprimento = 32; P.sons.forEach(s => s.comp = 32);
  for (let p = 0; p < 32; p += 4) P.notas[8][p] = [60]; P.notas[8][10] = [60];
  for (let p = 4; p < 32; p += 8) P.notas[9][p] = [60];
  for (let p = 0; p < 32; p++) if (p % 2 === 0 || p % 8 === 3) P.notas[11][p] = [60];
  P.travas[11][6] = { corte: 3000, vol: .8 }; P.travas[9][20] = { micro: 20 };
  return E;
}
const relFalso = (E, lat = 0) => { const c = { t: 0, outputLatency: lat, get currentTime() { return this.t; } }; const r = new Relogio(c, null, E, {}); r.c = c; return r; };
const anda = (r, ate) => { while (r.c.t < ate) { r.c.t = Math.min(ate, r.c.t + .02); r.agendar(); } };

const T = {
  async T1() {
    const o = await renderOffline(padraoFixo(), new Map(), { passos: 32, sr: 44100, worklet: WK }), h = await sha(o.buf), nav = motorNav();
    let gold = {}; try { gold = await (await fetch(new URL('golden.json', import.meta.url), { cache: 'no-store' })).json(); } catch (e) { }
    window.hashAtual = { nav, h };
    if (new URLSearchParams(location.search).has('atualizar')) return reg('T1', 'Hash de áudio', true, `golden ATUALIZADO (${nav}) ${h.slice(0, 16)}…`);
    reg('T1', 'Hash de áudio', gold[nav] === h, gold[nav] ? `${nav} ${h.slice(0, 16)}… ${gold[nav] === h ? '= golden' : '≠ golden ' + gold[nav].slice(0, 16)}` : `sem golden para ${nav} (${h.slice(0, 16)}…): rode ?atualizar=1`);
  },
  async T2() {
    let pior = 0, n = 0, atraso = 0;
    for (const s of [8, 9, 11]) {
      const E = padraoFixo(); E.padroes[0].sons[s].solo = true;
      const o = await renderOffline(E, new Map(), { passos: 32, sr: 44100 }), ch = o.buf.getChannelData(0), pk = ch.reduce((a, x) => Math.max(a, Math.abs(x)), 0), det = ataques(ch, 44100, pk * (s === 11 ? .12 : .3), s === 11 ? .006 : .02), esp = o.log.map(x => x.t);
      if (det.length !== esp.length) return reg('T2', 'Timing', false, `som ${s + 1}: ${det.length} ataques, esperava ${esp.length} · faltam ${esp.filter(e => !det.some(x => Math.abs(x - e - .006) < .01)).map(e => ((e - o.t0) / o.sd).toFixed(2)).join(' ')}`);
      const d = mediana(det.map((x, i) => x - esp[i])); atraso = d; det.forEach((x, i) => { pior = Math.max(pior, Math.abs(x - esp[i] - d)); n++; });
    }
    reg('T2', 'Timing', pior < .001, `${n} notas · erro máx ${(pior * 1000).toFixed(3)} ms (atraso fixo do limitador ${(atraso * 1000).toFixed(1)} ms)`);
  },
  async T3() {
    const E = limpo(), P = E.padroes[0]; P.comprimento = 64; P.sons.forEach(s => s.comp = 64); P.sons[8].comp = 16; P.sons[9].comp = 12; P.notas[8][0] = [60]; P.notas[9][0] = [60];
    const tr = novoTransporte(0), sd = .125, log = []; let tb = 0;
    for (let i = 0; i < 64; i++) { agendaPasso(E, null, tr, tb, sd, { log }); avanca(E, tr); tb += sd; }
    const a = log.filter(x => x.s === 8).map(x => x.passo), b = log.filter(x => x.s === 9).map(x => x.passo), junto = a.filter(x => b.includes(x));
    const t49 = log.filter(x => x.passo === 48).map(x => x.t), erro = Math.max(...t49.map(t => Math.abs(t - 48 * sd)));
    reg('T3', 'Polimetria', junto.join() === '0,48' && t49.length === 2 && erro < 1e-9 && a.join() === '0,16,32,48' && b.join() === '0,12,24,36,48,60', `A em ${a.join(' ')} · B em ${b.join(' ')} · coincidem no passo ${junto[1] + 1} · erro ${erro.toExponential(1)} s`);
  },
  async T4(o = {}) {
    const seg = o.seg || (new URLSearchParams(location.search).has('rapido') ? 6 : 30);
    const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC({ latencyHint: 'interactive' }); try { await ctx.resume(); } catch (e) { }
    if (ctx.state !== 'running') { ctx.close(); return reg('T4', 'Jitter ao vivo', false, 'AudioContext não iniciou (toque em "Rodar testes" para liberar o áudio)'); }
    const E = novoEstado(); E.bpm = 120; E.master.vol = .02; const M = new Motor(ctx, E, new Map(), {}), rel = new Relogio(ctx, M, E, {});
    const cv = document.getElementById('ferroTeste'), fe = cv ? new Ferro(cv) : null; let vivo = true, quadros = 0;
    const anim = () => { if (!vivo) return; quadros++; const e = rel.atual(); if (e && fe) { fe.nivel(M.nivel() * 20); if (e.tb !== anim.u) { anim.u = e.tb; fe.nota(60 + e.passo, '#FF9F0A'); if (e.passo % 4 === 0) fe.batida(); } const x = document.getElementById('andamento'); if (x) x.textContent = `T4: passo ${e.n + 1}`; } requestAnimationFrame(anim); };
    if (fe) fe.setTocando(true); rel.liga(); rel.play(); requestAnimationFrame(anim);
    await new Promise(r => setTimeout(r, seg * 1000));
    const st = rel.stats; vivo = false; rel.stop(); rel.desliga(); if (fe) fe.setTocando(false); await ctx.close();
    const esperado = seg * 8;
    reg('T4', 'Jitter ao vivo', st.erroMax < .0005 && st.curtos === 0 && st.passos > esperado * .9, `${seg} s · ${st.passos} passos · jitter máx ${(st.erroMax * 1000).toFixed(4)} ms · antecedência mín ${(st.antMin * 1000).toFixed(1)} ms · passos com <10 ms: ${st.curtos} · shader ${fe ? fe.modo : 'sem'} ${fe ? fe.quadros : 0} quadros`);
  },
  async T5() {
    const det = [];
    { const E = limpo(), P = E.padroes[0]; clique(E, 8); P.notas[8][0] = [60]; P.notas[8][4] = [60]; P.travas[8][4] = { rat: 3 };
      const o = await renderOffline(E, new Map(), { passos: 8, sr: 44100 }), at = ataques(o.buf.getChannelData(0), 44100).filter(t => t > o.t0 + 3.5 * o.sd), vols = o.log.filter(x => x.passo === 4).length;
      det.push(['ratchet 3 = ' + at.length + ' ataques', at.length === 3 && vols === 3 && Math.abs((at[1] - at[0]) - o.sd / 3) < .001]); }
    { const E = limpo(), P = E.padroes[0]; clique(E, 0); P.notas[0][0] = [72]; P.notas[0][1] = [72]; P.travas[0][1] = { tie: true };
      const o = await renderOffline(E, new Map(), { passos: 4, sr: 44100 }), at = ataques(o.buf.getChannelData(0), 44100);
      det.push(['tie = ' + (at.length - 1) + ' ataque', at.length === 1 && o.log.length === 1]); }
    { const E = limpo(), P = E.padroes[0]; P.notas[8][0] = [60]; P.travas[8][0] = { cond: '1:2' }; P.notas[9][0] = [60]; P.travas[9][0] = { cond: 'FILL' }; P.notas[10][0] = [60]; P.travas[10][0] = { cond: '!FILL' };
      for (let p = 0; p < 16; p++) { P.notas[11][p] = [60]; P.travas[11][p] = { cond: '50%' }; }
      const o = await renderOffline(E, new Map(), { passos: 96, sr: 22050, cauda: .1, porPasso: (i, tr) => { tr.fill = i >= 32 && i < 48; } });
      const v = s => o.log.filter(x => x.s === s).map(x => Math.floor((x.t - o.t0) / (16 * o.sd) + 1e-6) + 1).join();
      det.push(['1:2 nas voltas ' + v(8), v(8) === '1,3,5']); det.push(['FILL só na volta ' + v(9), v(9) === '3']); det.push(['!FILL nas voltas ' + v(10), v(10) === '1,2,4,5,6']);
      let bate = true, sim = 0; o.fila.forEach((e, i) => { const k = '11:' + e.passo, soou = (e.notasFinais[11] || []).length > 0; if (e.sorte[k] !== soou) bate = false; if (soou) sim++; });
      det.push([`50%: fila = som (${sim}/96 tocaram)`, bate && sim > 24 && sim < 72]); }
    reg('T5', 'Passo rico', det.every(x => x[1]), det.map(x => (x[1] ? '✓ ' : '✗ ') + x[0]).join(' · '));
  },
  async T6() {
    const E = limpo(), r = relFalso(E, .04); r.rec = true; r.play(); const t0 = r.tProx, sd = r.sd; let ok = true; const det = [];
    for (const [passo, erro] of [[4, 0], [5, .03], [6, -.03], [9, .05], [12, -.05]]) {
      anda(r, t0 + passo * sd + .04 + erro); // o músico toca junto com o que OUVE: passo + 40 ms de latência (+ erro humano)
      const g = r.grava(8, [60], null, r.c.t); if (!g || g.passo !== passo) ok = false; det.push(`${passo + 1}${erro ? (erro > 0 ? '+' : '−') + Math.abs(erro * 1000) : ''}→${g ? g.passo + 1 : '∅'}`);
    }
    const semComp = (() => { const E2 = limpo(), q = relFalso(E2, 0); q.rec = true; q.play(); anda(q, q.tProx + 4 * q.sd + .04 + .03); const g = q.grava(8, [60], null, q.c.t); return g && g.passo; })();
    reg('T6', 'Latência', ok, `outputLatency 40 ms: toques ${det.join(' · ')} · (sem compensar, o toque do passo 5 +30 ms cairia no passo ${semComp + 1})`);
  },
  async T7() {
    const E = limpo(), P = E.padroes[0]; Object.assign(E.master.duck, { on: true, prof: 1, solt: .1, gatilho: 8 });
    Object.assign(E.kit.sons[0].params, { o1: 'sine', o2: '', fm: 0, corte: 18000, a: .001, d: .01, s: 1, r: .01, vol: .8 }); E.kit.sons[8].params.vol = 0;
    P.notas[0][0] = [96]; P.travas[0][0] = { comp: 16 }; P.notas[8][4] = [60];
    const o = await renderOffline(E, new Map(), { passos: 16, sr: 44100 }), ch = o.buf.getChannelData(0), tk = o.log.find(x => x.s === 8).t;
    const pico = (a, b) => { let m = 0; for (let i = Math.round(a * 44100); i < Math.round(b * 44100); i++) m = Math.max(m, Math.abs(ch[i])); return m; };
    // envelope por pico de uma senoide de 2 kHz em janelas de 1,5 ms; o limitador atrasa ~6 ms, então procura o mínimo logo após o bumbo
    const ref = pico(tk - .1, tk - .02); let min = 1; for (let t = tk; t < tk + .02; t += .0005) min = Math.min(min, pico(t, t + .0015));
    const dbM = 20 * Math.log10(Math.max(min, 1e-6) / ref), dbV = 20 * Math.log10(pico(tk + .1 + .03, tk + .1 + .08) / ref);
    const E2 = limpo(), P2 = E2.padroes[0]; E2.kit.sons.forEach(s => { s.params.vol = 1; }); for (let s = 0; s < 16; s++) for (const p of [0, 4, 8, 12]) P2.notas[s][p] = s < 8 ? [48 + s * 3, 55 + s * 3, 60 + s * 3] : [60];
    const o2 = await renderOffline(E2, new Map(), { passos: 16, sr: 44100 }); let pk2 = 0; for (let c = 0; c < 2; c++) { const d = o2.buf.getChannelData(c); for (let i = 0; i < d.length; i++) pk2 = Math.max(pk2, Math.abs(d[i])); }
    const dbP = 20 * Math.log10(pk2);
    reg('T7', 'DUCK e limitador', dbM < -20 && Math.abs(dbV) < .5 && dbP <= -.5, `duck 100%: ${dbM.toFixed(1)} dB após o bumbo, ${dbV.toFixed(2)} dB após a soltura · 16 sons no máximo: pico ${dbP.toFixed(2)} dBFS`);
  },
  async T8() {
    const sr = 44100, tempos = [.05, .31, .52, .9, 1.13, 1.48, 1.71, 2.2], d = new Float32Array(sr * 2.6); let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
    for (const t of tempos) for (let i = 0, o = Math.round(t * sr); i < sr * .12; i++) d[o + i] += rnd() * .8 * Math.exp(-i / (sr * .02));
    const m = detectaAtaques(d, sr, .5), f = fatiasDe(m, d.length / sr), erro = m.length === 8 ? Math.max(...m.map((x, i) => Math.abs(x - tempos[i]))) : NaN;
    reg('T8', 'CHOP', f.length === 8 && erro < .005, `${f.length} fatias · erro máx de início ${(erro * 1000).toFixed(2)} ms`);
  },
  async T9() {
    const nome = 'bolso16-teste-' + Date.now(), b = new Banco(nome); if (!await b.abrir()) return reg('T9', 'Persistência', false, 'IndexedDB indisponível');
    const E = limpo(), P = E.padroes[2];
    P.sons[3].comp = 12; P.sons[3].div = '1/8'; P.sons[9].mute = true; P.sons[10].solo = true; P.tom = 5; P.escala = 'Dór'; P.prog = 1; P.sons[4].tonal = 'ignora';
    P.notas[3][5] = [48, 55]; P.ac[3][5] = { grau: 4, var: '7', inv: 1 }; P.travas[3][5] = { corte: 900, rat: 3, micro: -20, cond: '1:4', mel: { t: 'quebra', n: 4, oit: 3 }, tonal: 'quant' }; P.fx[7] = 4; P.dj[3] = -.5;
    Object.assign(E.master.duck, { on: true, prof: .7, solt: .25, gatilho: 9 }); E.cfg.lat = .035; E.cfg.metVol = .33; E.cfg.fade = .02;
    const s = E.kit.sons; s[9].fonte = 'chop'; s[9].amostra = { id: 'x1', ini: 0, fim: 1 }; s[9].fatias = [{ ini: 0, fim: .4 }, { ini: .4, fim: 1 }]; s[4].vozEstilo = 'legato'; s[10].ligado = 12; s[2].params.fm = 2.2; s[2].params.o2 = 'sq';
    E.perf.faixas[1] = { ev: [{ p: 3, s: 8, n: [60], c: 0 }], comp: 2, camada: 1, refaz: [], estado: 'play', mute: true, fb: .7, gan: [1, 1] }; E.cadeia = [2, 0, 2]; E.cadeiaOn = true;
    await b.set('kv', 'estado', clona(E)); await b.set('amostras', 'x1', { id: 'x1', nome: 't', sr: 8000, dados: new Float32Array([0, .5, -.5, .25]) }); b.db.close();
    const b2 = new Banco(nome); await b2.abrir(); const L = migra(await b2.get('kv', 'estado')), am = await b2.get('amostras', 'x1'); b2.db.close(); indexedDB.deleteDatabase(nome);
    const campos = { 'comp/div': [L.padroes[2].sons[3], P.sons[3]], travas: [L.padroes[2].travas[3], P.travas[3]], DUCK: [L.master.duck, E.master.duck], 'calibração': [L.cfg.lat, .035], fatias: [L.kit.sons[9].fatias, s[9].fatias], 'tom/escala': [[L.padroes[2].tom, L.padroes[2].escala], [5, 'Dór']],
      PROG: [L.padroes[2].prog, 1], tonal: [L.padroes[2].sons[4].tonal, 'ignora'], 'estilo de voz': [L.kit.sons[4].vozEstilo, 'legato'], 'ligações': [L.kit.sons[10].ligado, 12], componentes: [[L.kit.sons[2].params.fm, L.kit.sons[2].params.o2], [2.2, 'sq']],
      'mute/solo': [[L.padroes[2].sons[9].mute, L.padroes[2].sons[10].solo], [true, true]], 'volume do MET': [L.cfg.metVol, .33], 'faixas PERF': [L.perf.faixas[1], E.perf.faixas[1]], cadeia: [[L.cadeia, L.cadeiaOn], [[2, 0, 2], true]], amostra: [Array.from(am.dados), [0, .5, -.5, .25]], notas: [L.padroes[2].notas[3], P.notas[3]], fx: [[L.padroes[2].fx, L.padroes[2].dj], [P.fx, P.dj]] };
    const ruins = Object.keys(campos).filter(k => JSON.stringify(campos[k][0]) !== JSON.stringify(campos[k][1]));
    // backup de versão anterior (v1) abre e toca igual ao equivalente atual
    const v1 = await (await fetch(new URL('backup-v1.json', import.meta.url), { cache: 'no-store' })).json(), M1 = migra(clona(v1.estado));
    const eq = limpo(); eq.bpm = 110; eq.swing = 20; for (const p of [0, 4, 8, 12]) eq.padroes[0].notas[8][p] = [60]; for (const p of [4, 12]) eq.padroes[0].notas[9][p] = [60]; for (let p = 0; p < 16; p += 2) eq.padroes[0].notas[11][p] = [60]; eq.padroes[0].travas[11][6] = { corte: 2500 };
    const h1 = await sha((await renderOffline(M1, new Map(), { passos: 16, sr: 22050 })).buf), h2 = await sha((await renderOffline(eq, new Map(), { passos: 16, sr: 22050 })).buf);
    reg('T9', 'Persistência', !ruins.length && M1.v === V && h1 === h2, `${Object.keys(campos).length} grupos de campos voltaram${ruins.length ? ' · FALHOU: ' + ruins.join(', ') : ''} · backup v1 → v${M1.v}: ${h1 === h2 ? 'toca igual (hash idêntico)' : 'TOCA DIFERENTE'}`);
  },
  async T10() {
    const E = novoEstado(), P = E.padroes[0]; E.bpm = 120; E.master.dust = .4; E.kit.sons.forEach((s, i) => { s.insert = ['drive', 'crush', 'filtro', 'nada'][i % 4]; });
    P.comprimento = 16; P.sons.forEach(s => s.comp = 16);
    for (let s = 0; s < 16; s++) for (let p = s % 4; p < 16; p += 4) { P.notas[s][p] = s < 8 ? [48 + s * 2, 55 + s * 2, 60 + s * 2] : [60]; if ((p + s) % 3 === 0) P.travas[s][p] = { rat: 2 + (p + s) % 3 }; }
    const t = performance.now(), o = await renderOffline(E, new Map(), { passos: 128, sr: 44100, worklet: WK, porPasso: (i, tr, M, tb, sd) => { tr.fxSeg = Math.floor(i / 8) % 16 === 15 ? -1 : Math.floor(i / 8) % 16; if (i === 100) M.fita(true, { atras: 16 * sd, loop: 2 * sd, vel: .5, filt: .6 }, tb); if (i === 108) M.fita(false, {}, tb); } });
    const ms = performance.now() - t, pct = ms / (o.buf.duration * 1000) * 100;
    reg('T10', 'CPU', pct < 25, `8 compassos · 16 sons · ${o.log.length} notas com ratchet · 15 FX + fita + dust + inserts: ${ms.toFixed(0)} ms para ${o.buf.duration.toFixed(1)} s de áudio = ${pct.toFixed(1)}%`);
  },
  async T11() {
    const nomes = [0, 1, 2, 3, 4, 5, 6].map(g => acorde(0, 'Mai', g).nome), dom = [0, 1, 2, 3, 4, 5, 6].every(g => { const c = acorde(0, 'Mai', g, '7'), r = c.notas[0]; return c.notas.map(n => n - r).join() === '0,4,7,10'; }), inv = acorde(0, 'Mai', 0, '', 1).notas;
    reg('T11', 'Acordes', nomes.join() === 'C,Dm,Em,F,G,Am,Bdim' && dom && inv.join() === '64,67,72', `I–vii° = ${nomes.join(' ')} · ↗ = dominante nas 7 teclas: ${dom} · 1ª inversão de C = ${inv.map(n => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12]).join(' ')}`);
  },
  async T12() {
    const E = limpo(); E.swing = 30; const r = relFalso(E, 0); r.rec = true; r.play(); const t0 = r.tProx, sd = r.sd, c7 = acorde(0, 'Mai', 0, '7');
    anda(r, t0 + 4 * sd + .012); r.grava(0, c7.notas, { grau: 0, var: '7', inv: 0 }, r.c.t);
    const N = E.padroes[0].notas[0], ks = Object.keys(N);
    // e um toque um pouco antes de um passo ímpar (com swing) tem de cair nele
    anda(r, t0 + 7 * sd + .3 * sd * .5 - .01); const g = r.grava(8, [60], null, r.c.t);
    reg('T12', 'Gravar acorde', ks.join() === '4' && N[4].join() === '60,64,67,70' && g.passo === 7, `C7 gravou [${(N[4] || []).join(',')}] no(s) passo(s) ${ks.map(k => +k + 1).join()} · swing 30%: toque 10 ms antes do passo 8 atrasado → passo ${g.passo + 1}`);
  },
  async T13() {
    const det = [], nomes = n => n.map(x => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][x % 12]).join(' ');
    { const E = limpo(), P = E.padroes[0]; clique(E, 0); E.kit.sons[0].params.nota = 60; P.notas[0][2] = acorde(0, 'Mai', 0, 'maj7').notas; P.travas[0][2] = { mel: { t: 'quebra', n: 4, oit: 1 } };
      const o = await renderOffline(E, new Map(), { passos: 8, sr: 44100 }), at = ataques(o.buf.getChannelData(0), 44100, .01), ns = o.log.map(x => x.n), passo = o.log.map(x => Math.round((x.t - o.t0) / o.sd));
      det.push([`Quebra 4 de Cmaj7 = ${at.length} ataques (${nomes(ns)})`, at.length === 4 && ns.join() === '60,64,67,71' && passo.join() === '2,3,4,5']); }
    { const E = limpo(), P = E.padroes[0]; P.notas[0][0] = [62]; P.travas[0][0] = { mel: { t: 'rampaU', n: 6 } }; const o = await renderOffline(E, new Map(), { passos: 8, sr: 8000 }), ns = o.log.map(x => x.n);
      det.push([`Rampa ↑ 6 = ${nomes(ns)}`, ns.length === 6 && ns.every(n => [0, 2, 4, 5, 7, 9, 11].includes(n % 12)) && ns.join() === '62,64,65,67,69,71']); }
    { const E = limpo(), P = E.padroes[0]; Object.assign(E.kit.sons[0].params, { o1: 'sine', o2: '', fm: 0, corte: 18000, a: .001, d: .01, s: 1, r: .005 }); E.kit.sons[0].vozEstilo = 'mono';
      P.notas[0][0] = [60]; P.notas[0][4] = [72]; P.travas[0][4] = { mel: { t: 'glide', v: 8 }, comp: 2 };
      const o = await renderOffline(E, new Map(), { passos: 8, sr: 44100 }), ch = o.buf.getChannelData(0), meio = o.t0 + 4.5 * o.sd + .006, a = Math.round((meio - .012) * 44100), b = Math.round((meio + .012) * 44100), z = [];
      for (let i = a; i < b; i++) if (ch[i] <= 0 && ch[i + 1] > 0) z.push(i + ch[i] / (ch[i] - ch[i + 1]));
      const f = (z.length - 1) / ((z[z.length - 1] - z[0]) / 44100);
      det.push([`Glide no meio do passo: ${f.toFixed(0)} Hz (entre ${freq(60).toFixed(0)} e ${freq(72).toFixed(0)})`, f > freq(60) * 1.1 && f < freq(72) * .9]); }
    { const E = limpo(), P = E.padroes[0]; P.comprimento = 32; P.sons.forEach(s => s.comp = 32); P.sons[0].comp = 16; for (let p = 0; p < 16; p++) P.notas[0][p] = [60 + p]; P.travas[0][7] = { mel: { t: 'salto', a: 'ini' } }; E.padroes[1].notas[8][0] = [60];
      const o = await renderOffline(E, new Map(), { passos: 40, sr: 8000, porPasso: (i, tr) => { if (i === 3) tr.prox = 1; } }), locs = o.log.filter(x => x.s === 0).map(x => x.loc), pads = o.fila.map(e => e.padrao);
      det.push([`Salto início no passo 8: toca ${locs.slice(0, 10).map(x => x + 1).join(' ')}… · padrão troca no passo ${pads.indexOf(1) + 1}`, locs.length === 32 && locs.every((l, i) => l === i % 8) && pads.indexOf(1) === 32]); }
    reg('T13', 'Efeitos melódicos', det.every(x => x[1]), det.map(x => (x[1] ? '✓ ' : '✗ ') + x[0]).join(' · '));
  },
  async T14() {
    const det = [], pc = n => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12];
    const monta = modo => { const E = limpo(), P = E.padroes[0]; [[0, 0], [4, 3], [8, 4], [12, 0]].forEach(([p, g]) => { P.notas[0][p] = acorde(0, 'Mai', g).notas; P.ac[0][p] = { grau: g, var: '', inv: 0 }; P.notas[2][p] = [36]; if (modo === 'quant') { P.notas[2][p] = [38]; P.travas[2][p] = { tonal: 'quant' }; } }); P.sons[2].tonal = modo === 'ignora' ? 'ignora' : 'segue'; return E; };
    for (const modo of ['segue', 'ignora', 'quant']) {
      const o = await renderOffline(monta(modo), new Map(), { passos: 16, sr: 8000 }), ns = o.fila.filter(e => e.notasFinais[2]).map(e => e.notasFinais[2][0]), txt = ns.map(pc).join(' ');
      const ok = modo === 'segue' ? txt === 'C F G C' : modo === 'ignora' ? txt === 'C C C C' : ns.every((n, i) => acorde(0, 'Mai', [0, 3, 4, 0][i]).notas.map(x => x % 12).includes(n % 12));
      det.push([`baixo ${modo}: ${txt}`, ok]);
    }
    { const sr = 44100, sd = .125, ag = arpAgenda({ vel: 2, ordem: '↑', ritmo: 0, alc: 2 }, [60, 64, 67], 0, 6, sd, 0), E = limpo(); clique(E, 0); E.kit.sons[0].params.nota = 60;
      const ctx = new OfflineAudioContext(1, sr, sr), M = new Motor(ctx, E, new Map(), { offline: true }); ag.forEach(a => M.tocar(0, a.nota, .02 + a.t, .03, {}));
      const buf = await ctx.startRendering(), at = ataques(buf.getChannelData(0), sr, .01), d = mediana(at.map((x, i) => x - (.02 + i * sd))), erro = Math.max(...at.map((x, i) => Math.abs(x - (.02 + i * sd) - d)));
      det.push([`Arp ↑ 1/16 alc 2 = ${ag.map(a => pc(a.nota) + (a.nota >= 72 ? "'" : '')).join(' ')} · erro máx ${(erro * 1000).toFixed(3)} ms`, ag.map(a => a.nota).join() === '60,64,67,72,76,79' && at.length === 6 && erro < .001]); }
    reg('T14', 'Progressão e Arp', det.every(x => x[1]), det.map(x => (x[1] ? '✓ ' : '✗ ') + x[0]).join(' · '));
  },
  async T17() {
    const det = [];
    { const E = limpo(); E.padroes[1].comprimento = 32; E.padroes[1].sons.forEach(s => s.comp = 32); const tr = novoTransporte(0), pads = [];
      for (let i = 0; i < 70; i++) { if (i === 5) tr.prox = 1; pads.push(agendaPasso(E, null, tr, i * .125, .125).padrao); avanca(E, tr); }
      det.push([`troca armada no passo 6 entra no passo ${pads.indexOf(1) + 1}`, pads.indexOf(1) === 16]);
      E.cadeia = [0, 1]; E.cadeiaOn = true; const t2 = novoTransporte(0), seq = []; for (let i = 0; i < 96; i++) { seq.push(agendaPasso(E, null, t2, i * .125, .125).padrao); avanca(E, t2); }
      const blocos = seq.reduce((a, p) => { if (a.length && a[a.length - 1][0] === p) a[a.length - 1][1]++; else a.push([p, 1]); return a; }, []).map(x => `P${x[0] + 1}×${x[1]}`).join(' ');
      det.push([`cadeia 16 › 32: ${blocos}`, blocos === 'P1×16 P2×32 P1×16 P2×32']); }
    { const P = novoPadrao(); P.notas[8][0] = [60]; P.notas[8][5] = [60]; P.travas[8][5] = { rat: 2 }; defineComprimento(P, 32);
      const dup = Object.keys(P.notas[8]).join() === '0,5,16,21' && P.travas[8][21].rat === 2 && P.sons[8].comp === 32; det.push(['esticar 16→32 duplica (passos ' + Object.keys(P.notas[8]).map(k => +k + 1).join(' ') + ')', dup]);
      delete P.notas[8][21]; P.notas[8][30] = [60]; defineComprimento(P, 16); const curto = P.comprimento === 16 && P.notas[8][30]; defineComprimento(P, 32);
      det.push(['encurtar/esticar não perde nem duplica de novo (passos ' + Object.keys(P.notas[8]).map(k => +k + 1).join(' ') + ')', curto && Object.keys(P.notas[8]).join() === '0,5,16,30']); }
    reg('T17', 'Padrões e cadeia', det.every(x => x[1]), det.map(x => (x[1] ? '✓ ' : '✗ ') + x[0]).join(' · '));
  },
};
export async function rodaTestes(quais) {
  R.length = 0;
  for (const id of quais || Object.keys(T)) { try { await T[id](); } catch (e) { reg(id, id, false, 'ERRO: ' + (e && e.message) + ' ' + ((e && e.stack) || '').split('\n')[1]); } }
  return R;
}
window.rodaTestes = rodaTestes;
