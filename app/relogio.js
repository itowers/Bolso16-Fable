// Relógio e sequenciador. agendaPasso() é a única função que transforma dados em som;
// roda ao vivo (lookahead) e no render offline (testes), com o mesmo código.
import { DURS, fatorDiv, FX, clona } from './dados.js';
import { tonal, passoEscala, mod, rng, arpNota, ARP_VEL, tempoSwing } from './teoria.js';
import { Motor } from './motor.js';

export const LOOK = .12, TICK = 20;
const NADA = {};
const FX_VOZ = ['oitU', 'oitD', 'uni', 'rev', 'scr'];

export function novoTransporte(pad = 0, semente = 1) {
  return { pad, pos: 0, n: 0, voltas: new Array(16).fill(0), desloc: new Array(16).fill(0), ficou: {}, fill: false, fxSeg: -1, fxAtual: -1, fxAnc: 0,
    ultNota: new Array(16).fill(null), drone: {}, rand: rng(semente), prox: -1, cadeiaPos: 0, borr: new Set(), pular: new Map(), djTrav: false, fitaTrav: false };
}
// Passo local do som s quando o padrão está no passo pos (polimetria: sempre desde o início do padrão).
export function locDe(P, s, pos, desloc) { const S = P.sons[s]; return mod(Math.floor(pos * fatorDiv(S.div)) + (desloc ? desloc[s] : 0), S.comp); }
export function acordeVigente(P, desloc, pos) {
  const lp = locDe(P, P.prog, pos, desloc), A = P.ac[P.prog], N = P.notas[P.prog];
  for (let i = lp; i >= 0; i--) if (A[i] && N[i]) return A[i];
  return null;
}
export function agendaPasso(E, M, tr, tb, sd, ao = {}) {
  const P = E.padroes[tr.pad], pos = tr.pos, len = P.comprimento;
  const t0 = tb + ((pos & 1) ? E.swing / 100 * sd * .5 : 0);
  const ent = { tempo: t0, tb, passo: pos, padrao: tr.pad, notasFinais: {}, volta: tr.voltas[tr.pad], sorte: {}, desloc: tr.desloc.slice(), n: tr.n };
  const fx = tr.fxSeg >= 0 ? tr.fxSeg : (P.fx[pos] ?? -1);
  if (fx !== tr.fxAtual) { tr.fxAtual = fx; tr.fxAnc = pos; if (M) M.fxBus(fx, t0, sd); }
  if (M && fx >= 0) M.fxPasso(fx, t0, sd, pos);
  ent.fx = fx;
  const id = fx >= 0 && FX[fx] ? FX[fx].id : '', fxVoz = FX_VOZ.includes(id) ? id : '';
  if (M) {
    const dj = P.dj[pos];
    if (dj != null) { M.dj(dj, t0); tr.djTrav = true; } else if (tr.djTrav) { M.dj(E.master.dj, t0); tr.djTrav = false; }
    const ft = P.fita[pos];
    if (ft) { if (tr.fitaTrav !== ft) M.fita(true, ft, t0); tr.fitaTrav = ft; } else if (tr.fitaTrav) { if (!tr.fitaSeg) M.fita(false, {}, t0); tr.fitaTrav = false; }
  }
  // Conteúdo: FX de agendamento escolhem qual passo toca e quando.
  let conts, esc = 1; const a = tr.fxAnc;
  if (id.startsWith('loop')) { const N = +id[4], base = N === 4 ? a - (a % 4) : N === 2 ? a - (a % 2) : a; conts = [[mod(base + mod(pos - base, len) % N, len), t0]]; }
  else if (id === 'stutter') { conts = [0, 1, 2, 3].map(i => [pos, t0 + i * sd / 4]); esc = .25; }
  else if (id === 'retrig') conts = [[mod(pos - a, len), t0]];
  else if (id === '68') { const i = pos % 4; conts = i < 3 ? [[pos, tb - i * sd + i * sd * 4 / 3]] : []; }
  else conts = [[pos, t0]];
  const algumSolo = P.sons.some(x => x.solo);
  const cond = (c, chave) => {
    const v = ent.volta;
    switch (c) {
      case '1:2': return v % 2 === 0; case '2:2': return v % 2 === 1; case '1:4': return v % 4 === 0;
      case '50%': { const ok = tr.rand() < .5; ent.sorte[chave] = ok; return ok; }
      case 'FILL': return !!tr.fill; case '!FILL': return !tr.fill; default: return true;
    }
  };
  const evento = (s, S, loc, t, sdl, cp) => {
    const notas = P.notas[s][loc], tv = P.travas[s][loc];
    if (tr.borr.has(s)) { if (notas) { delete P.notas[s][loc]; delete P.ac[s][loc]; ent.sujo = true; } return; }
    if (!notas || !notas.length) return;
    const T = tv || NADA, mel = T.mel;
    if (mel && mel.t === 'salto') { // move o playhead do som
      const c = S.comp, k = s + ':' + loc; let alvo;
      switch (mel.a) {
        case '2/4': alvo = c >> 2; break; case '3/4': alvo = c >> 1; break; case '4/4': alvo = (3 * c) >> 2; break;
        case '+1': alvo = loc + 2; break; case '-1': alvo = loc - 1; break; case 'al': alvo = Math.floor(tr.rand() * c); break;
        case 'fica': if (tr.ficou[k]) { delete tr.ficou[k]; alvo = loc + 1; } else { tr.ficou[k] = 1; alvo = loc; } break;
        default: alvo = 0;
      }
      tr.desloc[s] = mod(tr.desloc[s] + alvo - (loc + 1), c);
    }
    const chave = tr.pad + ':' + s + ':' + loc, pl = tr.pular.get(chave);
    if (pl !== undefined) { tr.pular.delete(chave); if (t <= pl + sd) return; }
    if (S.mute || (algumSolo && !S.solo)) return;
    if (T.tie && s < 8) return;
    if (!cond(T.cond, s + ':' + loc)) return;
    const som = E.kit.sons[s]; let ns = notas;
    if (s < 8 && s !== P.prog) {
      const modo = T.tonal || (S.tonal === 'segue' ? 'transp' : 'ignora');
      if (modo !== 'ignora') { const acv = acordeVigente(P, tr.desloc, cp); ns = notas.map(n => tonal(n, modo, acv, P.tom, P.escala)); }
    }
    const p = tv ? { ...som.params, ...tv } : som.params;
    let dur = (T.comp != null ? T.comp * sdl : DURS[som.duracao][1] * sd) * esc;
    if (s < 8) { let k = 1; while (k < S.comp && P.travas[s][mod(loc + k, S.comp)] && P.travas[s][mod(loc + k, S.comp)].tie) k++; if (k > 1) dur = Math.max(dur, k * sdl); }
    let tt = t + (T.micro || 0) / 100 * sdl;
    tt = Math.max(tt, t - (LOOK - .02)); if (ao.agora != null) tt = Math.max(tt, ao.agora + .002);
    const lista = [], rat = T.rat || 1;
    if (mel && mel.t === 'quebra') {
      const L = [...ns].sort((x, y) => x - y), N = mel.n || 4;
      for (let i = 0; i < N; i++) { const o = mel.oit === 'al' ? Math.floor(tr.rand() * 3) : mel.oit === 3 ? Math.floor(i / L.length) % 3 : 0; lista.push({ n: [L[i % L.length] + 12 * o], t: tt + i * sdl, dur: Math.min(dur, sdl), g: 1 }); }
    } else if (mel && (mel.t === 'rampaU' || mel.t === 'rampaD')) {
      const dir = mel.t === 'rampaU' ? 1 : -1, N = mel.n || 4;
      for (let i = 0; i < N; i++) lista.push({ n: [passoEscala(ns[0], P.tom, P.escala, dir * i)], t: tt + i * sdl, dur: Math.min(dur, sdl), g: 1 });
    } else {
      const extra = {};
      if (mel && mel.t === 'glide' && tr.ultNota[s] != null) { extra.glideDe = tr.ultNota[s]; extra.glideT = sdl * ((mel.v === 'al' ? 1 + Math.floor(tr.rand() * 8) : (mel.v || 8)) / 8); }
      if (mel && mel.t === 'varre') extra.varre = { alvo: mel.alvo || 'filtro', dur: (mel.n || 1) * sdl };
      if (rat > 1 || esc < 1) extra.curto = true;
      for (let i = 0; i < rat; i++) lista.push({ n: ns, t: tt + i * sdl / rat, dur: rat > 1 ? Math.min(dur, sdl / rat) : dur, g: 1 - .1 * i, extra });
    }
    const ant = tr.drone[s]; if (ant) { for (const v of ant) v.solta(tt); delete tr.drone[s]; }
    for (const it of lista) {
      if (M) { const v = M.tocar(s, it.n, it.t, it.dur, { p, g: it.g, fx: fxVoz, ...(it.extra || NADA) }); if (v && it.dur === Infinity) (tr.drone[s] = tr.drone[s] || []).push(v); }
      if (ao.log) for (const n of it.n) ao.log.push({ s, n, t: it.t, passo: pos, loc });
      tr.ultNota[s] = it.n[0];
      (ent.notasFinais[s] = ent.notasFinais[s] || []).push(...it.n);
      if (M && s === E.master.duck.gatilho) M.duck(it.t);
    }
    if (som.ligado >= 0 && som.ligado !== s) {
      const L = E.kit.sons[som.ligado], nn = (L.lastChord && L.lastChord.notas) || [60], dl = DURS[L.duracao][1];
      if (M) M.tocar(som.ligado, nn, tt, (isFinite(dl) ? dl : 4) * sd, {});
      (ent.lig = ent.lig || []).push(som.ligado);
    }
  };
  for (const [cp, tc] of conts) for (let s = 0; s < 16; s++) {
    const S = P.sons[s], f = fatorDiv(S.div);
    if (f >= 1) { for (let j = 0; j < f; j++) evento(s, S, mod(cp * f + j + tr.desloc[s], S.comp), tc + j * sd / f, sd / f, cp); }
    else { const A = Math.floor(cp * f); if (cp === 0 || A !== Math.floor((cp - 1) * f)) evento(s, S, mod(A + tr.desloc[s], S.comp), tc, sd / f, cp); }
  }
  if (ao.perf) ao.perf(ent, t0, sd, fxVoz);
  return ent;
}
// Avança um passo. Devolve true quando o padrão deu a volta (aí troca de padrão, se armado ou em cadeia).
export function avanca(E, tr) {
  tr.pos++; tr.n++;
  if (tr.pos < E.padroes[tr.pad].comprimento) return false;
  tr.pos = 0; tr.voltas[tr.pad]++; tr.desloc.fill(0); tr.ficou = {};
  if (E.cadeiaOn && E.cadeia.length) { tr.cadeiaPos = (tr.cadeiaPos + 1) % E.cadeia.length; tr.pad = E.cadeia[tr.cadeiaPos]; }
  if (tr.prox >= 0) { tr.pad = tr.prox; tr.prox = -1; }
  return true;
}
export async function renderOffline(E, amostras, o = {}) {
  const sr = o.sr || 44100, sd = 60 / E.bpm / 4, passos = o.passos || 32, dur = passos * sd + (o.cauda ?? .5), t0 = .02;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  let worklet = false;
  if (o.worklet && ctx.audioWorklet) { try { await ctx.audioWorklet.addModule(o.worklet); worklet = true; } catch (e) { } }
  const M = new Motor(ctx, E, amostras, { offline: true, worklet }), tr = novoTransporte(o.pad || 0, o.semente || 1), fila = [], log = [];
  if (E.cadeiaOn && E.cadeia.length) tr.pad = E.cadeia[0];
  if (o.prep) o.prep(M, tr, ctx, t0, sd);
  // Agenda em blocos de 1 tempo (suspend/resume): nós criados com muita antecedência custam CPU o render inteiro.
  let i = 0;
  const bloco = () => {
    const fim = Math.min(passos, i + 4);
    for (; i < fim; i++) { const tb = t0 + i * sd; if (o.porPasso) o.porPasso(i, tr, M, tb, sd); fila.push(agendaPasso(E, M, tr, tb, sd, { log, perf: o.perf })); avanca(E, tr); }
    if (i < passos && ctx.suspend) ctx.suspend(Math.max(0, t0 + i * sd - .11)).then(() => { bloco(); ctx.resume(); });
    else if (i < passos) bloco();
  };
  bloco();
  const buf = await ctx.startRendering();
  return { buf, fila, log, t0, sd, sr };
}
// Agenda do arp: mesma conta ao vivo e nos testes.
export function arpAgenda(cfg, notas, k0, n, sd, swing, semente = 1) {
  const u = ARP_VEL[cfg.vel][1], out = [];
  for (let k = 0; k < n; k++) { const nota = arpNota(cfg, notas, k, semente); if (nota != null) out.push({ t: tempoSwing((k0 + k) * u, sd, swing), nota, dur: u * sd * .9 }); }
  return out;
}
export const tempoDoToque = (agora, latSaida, ajuste) => agora - (latSaida || 0) - (ajuste || 0);

export class Relogio {
  constructor(ctx, M, E, h = {}) {
    this.ctx = ctx; this.M = M; this.E = E; this.h = h; this.tr = novoTransporte(E.ui.pad); this.fila = []; this.tocando = false; this.rec = false;
    this.cont = 0; this.tProx = 0; this.desfaz = []; this.reps = []; this.fxRec = false; this.fitaSeg = null; this.livre0 = null;
    this.agora = h.agora || (() => ctx.currentTime); this.zeraStats();
  }
  zeraStats() { this.stats = { passos: 0, erroMax: 0, antMin: Infinity, curtos: 0, ref: null }; }
  get sd() { return 60 / this.E.bpm / 4; }
  get lat() { return (this.ctx && (this.ctx.outputLatency || this.ctx.baseLatency)) || 0; }
  liga() { if (this.timer) return; const f = () => { this.timer = setTimeout(f, TICK); this.agendar(); }; f(); }
  desliga() { clearTimeout(this.timer); this.timer = null; }
  play(contagem = 0) {
    if (this.tocando) return;
    const E = this.E, v = this.tr, pad = E.cadeiaOn && E.cadeia.length ? E.cadeia[0] : E.ui.pad;
    this.tr = Object.assign(novoTransporte(pad, (Date.now() & 0xffff) + 1), { fill: v.fill, fxSeg: v.fxSeg, borr: v.borr });
    this.cont = contagem; this.tProx = this.agora() + .06; this.fila.length = 0; this.tocando = true; this.zeraStats(); this.livre0 = null;
    for (const r of this.reps) { r.k = 0; r.k0 = 0; }
  }
  stop() {
    if (!this.tocando) return;
    this.tocando = false; this.rec = false; this.cont = 0; this.E.ui.pad = this.tr.pad; this.tr.prox = -1;
    for (const k of Object.keys(this.tr.drone)) for (const v of this.tr.drone[k]) v.solta(this.agora());
    this.tr.drone = {};
    if (this.M) { this.M.calarTudo(); this.M.fxBus(-1, this.agora(), this.sd); this.M.dj(this.E.master.dj, this.agora()); if (this.tr.fitaTrav && !this.fitaSeg) this.M.fita(false, {}); }
    this.tr.fxAtual = -1; this.fila.length = 0; this.livre0 = null; for (const r of this.reps) r.k = null;
  }
  alternaRec() {
    if (!this.tocando) { this.rec = true; this.desfaz = [clona(this.E.padroes[this.E.cadeiaOn && this.E.cadeia.length ? this.E.cadeia[0] : this.E.ui.pad])]; this.play(this.E.cfg.contagem ? 16 : 0); }
    else { this.rec = !this.rec; if (this.rec) this.desfaz = [clona(this.E.padroes[this.tr.pad])]; }
  }
  armaPadrao(i) { if (this.tocando) this.tr.prox = (i === this.tr.pad ? -1 : i); else { this.E.ui.pad = i; this.tr.pad = i; } }
  desfazVolta() { const s = this.desfaz.pop(); if (!s) return false; this.E.padroes[this.tr.pad] = s; if (!this.desfaz.length) this.desfaz.push(clona(s)); return true; }
  agendar() {
    const now = this.agora(), E = this.E, M = this.M, sd = this.sd;
    if (this.tocando) {
      if (now - this.tProx > .3) { this.tProx = now + .05; this.stats.ref = null; } // aba dormiu: não despeja passos atrasados
      let guarda = 0;
      while (this.tProx < now + LOOK && guarda++ < 64) {
        const tb = this.tProx, tr = this.tr;
        if (this.cont > 0) {
          if ((16 - this.cont) % 4 === 0 && M) M.clique(tb, this.cont === 16);
          this.fila.push({ tempo: tb, passo: -1, cont: Math.ceil(this.cont / 4) }); this.cont--; this.tProx += sd; continue;
        }
        const st = this.stats; if (!st.ref || st.ref.sd !== sd) st.ref = { t: tb, n: tr.n, sd };
        st.passos++; st.erroMax = Math.max(st.erroMax, Math.abs(tb - (st.ref.t + (tr.n - st.ref.n) * sd))); st.antMin = Math.min(st.antMin, tb - now); if (tb - now < .01) st.curtos++;
        if (M && (E.cfg.met === 'sempre' || (E.cfg.met === 'rec' && this.rec)) && tr.pos % 4 === 0) M.clique(tb, tr.pos % 16 === 0);
        tr.fitaSeg = this.fitaSeg;
        const ent = agendaPasso(E, M, tr, tb, sd, { agora: now, perf: this.h.perf });
        this.fila.push(ent); if (ent.sujo && this.h.sujo) this.h.sujo();
        const P = E.padroes[tr.pad];
        if (this.fxRec && tr.fxSeg >= 0) { P.fx[tr.pos] = tr.fxSeg; if (this.h.sujo) this.h.sujo(); }
        if (this.fitaRec && this.fitaSeg) { P.fita[tr.pos] = { ...this.fitaSeg }; if (this.h.sujo) this.h.sujo(); }
        if (avanca(E, tr)) { if (this.rec) { this.desfaz.push(clona(E.padroes[tr.pad])); if (this.desfaz.length > 8) this.desfaz.shift(); } if (this.h.volta) this.h.volta(tr); }
        this.tProx += sd;
      }
    } else if (M && this.tr.fxSeg !== this.tr.fxAtual) { this.tr.fxAtual = this.tr.fxSeg; M.fxBus(this.tr.fxSeg, now, sd); }
    this.repsTick(now);
    if (M) M.texTick(now);
    while (this.fila.length > 8 && this.fila[0].tempo < now - 2) this.fila.shift();
  }
  // Entrada da fila que está soando agora (para a UI).
  atual() {
    const t = this.agora() - this.lat; let m = null;
    for (const e of this.fila) { if (e.tempo <= t) m = e; else break; }
    return m;
  }
  fxVoz() { const f = this.tr.fxSeg, id = f >= 0 && FX[f] ? FX[f].id : ''; return FX_VOZ.includes(id) ? id : ''; }
  maisProximo(t) {
    let m = null, d = Infinity;
    for (const e of this.fila) { if (e.passo < 0) continue; const x = Math.abs(e.tempo - t); if (x < d) { d = x; m = e; } }
    if (this.tocando) {
      const tr = this.tr, sd = this.sd, tt = this.tProx + this.cont * sd + ((tr.pos & 1) ? this.E.swing / 100 * sd * .5 : 0);
      if (Math.abs(tt - t) < d) m = { tempo: tt, passo: tr.pos, padrao: tr.pad, desloc: tr.desloc.slice(), n: tr.n, futuro: true };
    }
    return m;
  }
  // Grava notas ao vivo no passo mais próximo (quantizado, com swing e compensação de latência).
  grava(s, notas, ac, tToque = this.agora(), compensa = true) {
    if (!this.rec || !this.tocando) return null;
    const E = this.E, t = compensa ? tempoDoToque(tToque, this.lat, E.cfg.lat) : tToque, q = this.maisProximo(t); if (!q) return null;
    const P = E.padroes[q.padrao], loc = locDe(P, s, q.passo, q.desloc);
    let ns = notas;
    if (s < 8 && s !== P.prog && P.sons[s].tonal === 'segue') { const acv = acordeVigente(P, q.desloc, q.passo); ns = notas.map(n => tonal(n, 'transp', acv, P.tom, P.escala, true)); }
    P.notas[s][loc] = [...new Set([...(P.notas[s][loc] || []), ...ns])].sort((a, b) => a - b);
    if (ac) P.ac[s][loc] = ac;
    if (q.futuro) this.tr.pular.set(q.padrao + ':' + s + ':' + loc, q.tempo + .001);
    if (this.h.sujo) this.h.sujo();
    return { passo: q.passo, loc, padrao: q.padrao };
  }
  // "Sem cadeado": com REC + tocando, mexer num ajuste grava trava no passo que soa.
  trava(s, chave, valor) {
    if (!this.rec || !this.tocando) return false;
    const e = this.atual(); if (!e || e.passo < 0) return true;
    const P = this.E.padroes[e.padrao], loc = locDe(P, s, e.passo, e.desloc);
    if (P.notas[s][loc]) { (P.travas[s][loc] = P.travas[s][loc] || {})[chave] = valor; if (this.h.sujo) this.h.sujo(); }
    return true;
  }
  // ---------- Repetidores no relógio: arp e REPT ----------
  xAgora(now) {
    if (this.tocando) return this.tr.n - (this.tProx + this.cont * this.sd - now) / this.sd;
    if (this.livre0 == null) this.livre0 = now + .012;
    return (now - this.livre0) / this.sd;
  }
  tX(x) {
    const sd = this.sd, sw = this.E.swing;
    return this.tocando ? this.tProx + this.cont * sd - this.tr.n * sd + tempoSwing(x, sd, sw) : this.livre0 + tempoSwing(x, sd, sw);
  }
  // rep = {s, u (passos), fn(i) → notas|null, ac, toca(notas,t,dur)}
  repLiga(rep, pulaPrimeira) {
    const now = this.agora(), x = this.xAgora(now);
    rep.k = Math.ceil(x / rep.u - 1e-6); if (pulaPrimeira && rep.k * rep.u - x < rep.u * .35) rep.k++;
    rep.k0 = rep.k; this.reps.push(rep); return rep;
  }
  repDesliga(rep) { const i = this.reps.indexOf(rep); if (i >= 0) this.reps.splice(i, 1); if (!this.reps.length && !this.tocando) this.livre0 = null; }
  repsTick(now) {
    for (const r of this.reps) {
      if (r.k == null) { r.k = Math.ceil(this.xAgora(now) / r.u - 1e-6); r.k0 = r.k; }
      let g = 0;
      while (g++ < 32) {
        const t = this.tX(r.k * r.u); if (t >= now + LOOK) break;
        if (t >= now) { const ns = r.fn(r.k - r.k0); if (ns && ns.length) { r.toca(ns, t, r.u * this.sd * .9); if (this.rec && this.tocando) this.grava(r.s, ns, r.ac ? r.ac() : null, t, false); } }
        r.k++;
      }
    }
  }
}
