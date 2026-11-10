// PERF: looper de 4 faixas que grava eventos de nota (não áudio) por cima do padrão, pelo mesmo relógio.
import { DURS, novaFaixa, novoPadrao, temNotas } from './dados.js';
import { mod } from './teoria.js';

export const ESTADO_NOME = { vazia: 'VAZIA', rec: 'REC', overdub: 'OVERDUB', play: 'PLAY' };
const arred = c => [1, 2, 4, 8].reduce((a, b) => Math.abs(Math.log2(b / c)) < Math.abs(Math.log2(a / c)) ? b : a, 1);

export class Perf {
  constructor(E, M, rel, h = {}) { this.E = E; this.M = M; this.rel = rel; this.h = h; this.rt = [0, 1, 2, 3].map(() => ({ ini: 0, arm: null, gravIni: 0 })); this.sel = 0; this.livre = null; }
  get fx() { return this.E.perf.faixas; }
  limite(n) { const q = this.E.perf.q; return q === '1 comp' ? Math.ceil(n / 16) * 16 : q === '1 tempo' ? Math.ceil(n / 4) * 4 : n; }
  tudoVazio() { return this.fx.every(f => f.estado === 'vazia'); }
  arma(i, acao) {
    const rel = this.rel;
    if (!rel.tocando) {
      if (acao === 'ciclo' && this.E.perf.q === 'Livre' && this.tudoVazio()) return this.livreIni(i);
      if (acao === 'ciclo' && this.livre && this.livre.i === i) return this.livreFim();
      rel.play();
    }
    this.rt[i].arm = { acao, n: this.limite(rel.tr.n) }; this.sel = i;
  }
  // Modo Livre: o tempo entre os dois REC define o loop e o BPM (70–180).
  livreIni(i) { const f = this.fx[i]; Object.assign(f, novaFaixa(), { estado: 'rec' }); this.livre = { i, t: this.rel.agora(), ev: [] }; this.sel = i; }
  livreFim() {
    const L = this.livre, f = this.fx[L.i], dur = Math.max(.3, this.rel.agora() - L.t); this.livre = null;
    let comp = 1, bpm = 60 * 4 / dur;
    for (const c of [1, 2, 4, 8]) { const b = 60 * c * 4 / dur; if (b >= 70 && b <= 180) { comp = c; bpm = b; break; } if (b < 70) { comp = c; bpm = b; } }
    this.E.bpm = Math.round(Math.min(180, Math.max(70, bpm))); f.comp = comp; f.camada = 1; f.gan = [1, 1]; f.estado = 'overdub';
    f.ev = L.ev.map(e => ({ p: Math.round(e.t / dur * comp * 16) % (comp * 16), s: e.s, n: e.n, c: 0 }));
    this.rel.play(); this.rt[L.i].ini = 0; if (this.h.sujo) this.h.sujo();
  }
  executa(i, acao, n) {
    const f = this.fx[i], r = this.rt[i];
    if (acao === 'ciclo') {
      if (f.estado === 'vazia') { Object.assign(f, novaFaixa(), { estado: 'rec', gan: [1] }); r.gravIni = n; }
      else if (f.estado === 'rec') {
        const L = (f.comp = arred(Math.max(1, (n - r.gravIni) / 16))) * 16; r.ini = r.gravIni;
        f.ev.forEach(e => { e.p = mod(e.p, L); }); f.camada = 1; f.gan[1] = 1; f.estado = 'overdub';
      }
      else if (f.estado === 'overdub') f.estado = 'play';
      else { f.estado = 'overdub'; f.camada++; f.gan[f.camada] = 1; f.refaz = []; }
    } else if (acao === 'mute') f.mute = !f.mute;
    else if (acao === 'x2' && f.comp && f.comp < 8) { const L = f.comp * 16; f.ev = f.ev.filter(e => e.p < L); f.ev.push(...f.ev.map(e => ({ ...e, p: e.p + L }))); f.comp *= 2; }
    else if (acao === 'meio' && f.comp > 1) f.comp /= 2;
    if (this.h.sujo) this.h.sujo();
  }
  // Chamado pelo relógio a cada passo agendado.
  passo(ent, t0, sd, fxVoz) {
    const n = ent.n, E = this.E, M = this.M;
    this.fx.forEach((f, i) => {
      const r = this.rt[i];
      if (r.arm && n >= r.arm.n) { const a = r.arm; r.arm = null; this.executa(i, a.acao, n); }
      if (!f.comp || (f.estado !== 'play' && f.estado !== 'overdub')) return;
      const L = f.comp * 16, p = mod(n - r.ini, L);
      if (p === 0 && n > r.ini && f.estado === 'overdub' && f.fb < 1) this.realimenta(f);
      if (f.mute) return;
      for (const e of f.ev) {
        if (e.p !== p) continue; if (e.pula === n) { delete e.pula; continue; }
        const som = E.kit.sons[e.s], d = DURS[som.duracao][1], g = (f.gan && f.gan[e.c]) ?? 1;
        if (M) M.tocar(e.s, e.n, t0, (isFinite(d) ? d : 4) * sd, { g, fx: fxVoz });
        if (M && e.s === E.master.duck.gatilho) M.duck(t0);
        (ent.notasFinais[e.s] = ent.notasFinais[e.s] || []).push(...e.n);
      }
    });
  }
  realimenta(f) { // FB: camadas antigas perdem volume a cada volta; fracas demais caem
    for (let c = 0; c < f.camada; c++) {
      if (f.gan[c] == null) continue; f.gan[c] *= f.fb;
      if (f.gan[c] < .1 || (f.fb < .5 && f.gan[c] < .5 && Math.random() < .5)) { f.ev = f.ev.filter(e => e.c !== c); f.gan[c] = null; }
    }
  }
  // Nota tocada ao vivo: entra na faixa que está em REC/OVERDUB.
  nota(s, notas, t) {
    if (this.livre) { this.livre.ev.push({ t: t - this.livre.t, s, n: notas.slice() }); return; }
    const rel = this.rel; if (!rel.tocando) return;
    this.fx.forEach((f, i) => {
      if (f.estado !== 'rec' && f.estado !== 'overdub') return;
      const q = rel.maisProximo(t - rel.lat - this.E.cfg.lat); if (!q) return;
      const r = this.rt[i], ev = { s, n: notas.slice(), c: f.camada };
      ev.p = f.estado === 'rec' ? Math.max(0, q.n - r.gravIni) : mod(q.n - r.ini, f.comp * 16);
      if (q.futuro && f.estado === 'overdub') ev.pula = q.n;
      f.ev.push(ev); if (this.h.sujo) this.h.sujo();
    });
  }
  desf(i) { const f = this.fx[i]; if (!f.ev.length) return; const c = Math.max(...f.ev.map(e => e.c)); f.refaz.push(f.ev.filter(e => e.c === c)); f.ev = f.ev.filter(e => e.c !== c); if (this.h.sujo) this.h.sujo(); }
  refaz(i) { const f = this.fx[i], x = f.refaz.pop(); if (x) { f.ev.push(...x); if (this.h.sujo) this.h.sujo(); } }
  limpa(i) { Object.assign(this.fx[i], novaFaixa()); this.rt[i].arm = null; if (this.h.sujo) this.h.sujo(); }
  parou() { this.rt.forEach(r => { r.arm = null; r.ini = 0; }); this.fx.forEach(f => { if (f.estado === 'rec') Object.assign(f, novaFaixa()); else if (f.estado === 'overdub') f.estado = 'play'; }); }
  // As faixas com conteúdo viram um padrão (notas absolutas).
  paraPadrao() {
    const fs = this.fx.filter(f => f.comp && f.ev.length); if (!fs.length) return null;
    const P = novoPadrao(), at = this.E.padroes[this.rel.tr.pad]; P.tom = at.tom; P.escala = at.escala;
    const len = Math.min(64, Math.max(...fs.map(f => f.comp * 16))); P.comprimento = len; P.sons.forEach(S => { S.comp = len; S.tonal = 'ignora'; });
    for (const f of fs) { const L = f.comp * 16; for (const e of f.ev) { if (e.p >= L) continue; for (let p = e.p; p < len; p += L) P.notas[e.s][p] = [...new Set([...(P.notas[e.s][p] || []), ...e.n])].sort((a, b) => a - b); } }
    return P;
  }
  salvar() {
    const P = this.paraPadrao(); if (!P) return -1;
    let i = this.E.padroes.findIndex((x, k) => k !== this.rel.tr.pad && !temNotas(x)); if (i < 0) return -2;
    this.E.padroes[i] = P; if (this.E.cadeia.length < 128) this.E.cadeia.push(i); if (this.h.sujo) this.h.sujo(); return i;
  }
  // Para o visor e o anel de progresso (n = passo que soa agora).
  info(n) {
    const i = this.rt.findIndex(r => r.arm); if (i < 0) return null;
    const a = this.rt[i].arm, f = this.fx[i], falta = Math.max(0, a.n - n), prox = a.acao === 'ciclo' ? ({ vazia: 'REC', rec: 'OVERDUB', overdub: 'PLAY', play: 'OVERDUB' })[f.estado] : a.acao === 'mute' ? (f.mute ? 'SOM' : 'MUTE') : a.acao === 'x2' ? '×2' : '½';
    return { i, texto: `F${i + 1} ▸ ${prox} · em ${Math.max(1, Math.ceil(falta / 4))} t`, tempos: Math.ceil(falta / 4) };
  }
  progresso(i, n) { const f = this.fx[i], r = this.rt[i]; if (!f.comp || f.estado === 'vazia' || f.estado === 'rec') return f.estado === 'rec' && !this.livre ? (mod(n - r.gravIni, 16) / 16) : 0; return mod(n - r.ini, f.comp * 16) / (f.comp * 16); }
}
