// Motor de áudio. Funciona igual em AudioContext e OfflineAudioContext.
// Ordem: voz → INSERT → vol/pan → barramento → DUCK → FX perf → Fita → FILT DJ → DUST → limitador → destino.
import { freq, rng } from './teoria.js';
import { FX } from './dados.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ONDA = { sine: 'sine', tri: 'triangle', saw: 'sawtooth', sq: 'square' };
const curva = (n, f) => { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = f(i / (n - 1) * 2 - 1); return c; };
const C_DRIVE = curva(1024, x => Math.tanh(3 * x) / Math.tanh(3));
const C_CRUSH = curva(4096, x => Math.round(x * 7) / 7);
const C_DUST = curva(4096, x => Math.round(x * 12) / 12);
const C_TETO = curva(4096, x => { const a = Math.abs(x), k = .8; return Math.sign(x) * (a < k ? a : k + (.94 - k) * Math.tanh((a - k) / (.94 - k))); });

export class Motor {
  // E = estado (lido ao vivo); amostras = Map id → {buf: AudioBuffer}; opts.worklet = true se o módulo da fita já foi carregado
  constructor(ctx, E, amostras, opts = {}) {
    this.ctx = ctx; this.E = E; this.amostras = amostras || new Map(); this.ch = []; this.vozes = Array.from({ length: 16 }, () => []);
    this.rand = rng(12345); this.tex = {}; this.fxAtivo = -1; this.rev = new Map(); this.fmax = Math.min(20000, ctx.sampleRate * .45);
    const g = () => ctx.createGain();
    this.busDuck = g(); this.busGat = g(); this.soma = g();
    this.busDuck.connect(this.soma); this.busGat.connect(this.soma);
    // FX de performance no barramento
    this.fxFilt = ctx.createBiquadFilter(); this.fxFilt.type = 'lowpass'; this.fxFilt.frequency.value = this.fmax; this.fxFilt.Q.value = 5;
    this.ecoEnv = g(); this.ecoEnv.gain.value = 0; this.eco = ctx.createDelay(2); this.ecoFb = g(); this.ecoFb.gain.value = .45;
    this.fxGate = g(); this.posFx = g();
    this.soma.connect(this.fxFilt); this.fxFilt.connect(this.fxGate); this.fxGate.connect(this.posFx);
    this.fxGate.connect(this.ecoEnv); this.ecoEnv.connect(this.eco); this.eco.connect(this.ecoFb); this.ecoFb.connect(this.eco); this.eco.connect(this.posFx);
    // Fita
    this.fitaFilt = ctx.createBiquadFilter(); this.fitaFilt.type = 'lowpass'; this.fitaFilt.frequency.value = this.fmax;
    this.fitaNo = null;
    if (opts.worklet) { try { this.fitaNo = new AudioWorkletNode(ctx, 'fita', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { seg: 16.5 } }); } catch (e) { this.fitaNo = null; } }
    if (this.fitaNo) { this.posFx.connect(this.fitaNo); this.fitaNo.connect(this.fitaFilt); } else this.posFx.connect(this.fitaFilt);
    // FILT DJ
    this.djLP = ctx.createBiquadFilter(); this.djLP.type = 'lowpass'; this.djLP.frequency.value = this.fmax; this.djLP.Q.value = 1.2;
    this.djHP = ctx.createBiquadFilter(); this.djHP.type = 'highpass'; this.djHP.frequency.value = 10; this.djHP.Q.value = 1.2;
    this.fitaFilt.connect(this.djLP); this.djLP.connect(this.djHP);
    // DUST
    this.dustSeco = g(); this.dustMolh = g(); this.dustMolh.gain.value = 0; this.dustSh = ctx.createWaveShaper(); this.dustSh.curve = C_DUST;
    this.dustRuido = g(); this.dustRuido.gain.value = 0;
    this.vol = g();
    this.djHP.connect(this.dustSeco); this.djHP.connect(this.dustSh); this.dustSh.connect(this.dustMolh);
    this.dustSeco.connect(this.vol); this.dustMolh.connect(this.vol); this.dustRuido.connect(this.vol);
    // Limitador
    this.lim = ctx.createDynamicsCompressor();
    this.lim.threshold.value = -1; this.lim.ratio.value = 20; this.lim.attack.value = .001; this.lim.release.value = .1; this.lim.knee.value = 0;
    this.teto = ctx.createWaveShaper(); this.teto.curve = C_TETO; // teto de segurança (o compressor do navegador aplica ganho de compensação)
    this.vol.connect(this.lim); this.lim.connect(this.teto); this.teto.connect(ctx.destination);
    this.metro = g(); this.metro.connect(ctx.destination); // fora de tudo
    if (ctx.createAnalyser && !opts.offline) { this.an = ctx.createAnalyser(); this.an.fftSize = 512; this.teto.connect(this.an); this.anBuf = new Float32Array(512); this.anPre = ctx.createAnalyser(); this.anPre.fftSize = 512; this.vol.connect(this.anPre); }
    // ruído branco determinístico (1 s) e ruído de vinil
    const sr = ctx.sampleRate, r = rng(777);
    this.ruido = ctx.createBuffer(1, sr, sr); const d = this.ruido.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = r() * 2 - 1;
    this.vinil = ctx.createBuffer(1, sr * 2, sr); const v = this.vinil.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = (r() * 2 - 1) * .08 + (r() < .0006 ? (r() * 2 - 1) : 0);
    this.aplicaMaster();
  }
  aplicaMaster() {
    const m = this.E.master, t = this.ctx.currentTime;
    this.vol.gain.setTargetAtTime(m.vol, t, .01);
    this.dustMolh.gain.setTargetAtTime(m.dust, t, .02); this.dustSeco.gain.setTargetAtTime(1 - m.dust, t, .02);
    this.dustRuido.gain.setTargetAtTime(m.dust * .25, t, .02);
    if (m.dust > 0 && !this.vinilSrc) { const s = this.ctx.createBufferSource(); s.buffer = this.vinil; s.loop = true; s.connect(this.dustRuido); s.start(); this.vinilSrc = s; }
    this.dj(m.dj, t);
    for (let s = 0; s < 16; s++) this.atualiza(s);
  }
  dj(v, t) {
    const lp = v < 0 ? this.fmax * Math.pow(.006, -v) : this.fmax, hp = v > 0 ? 10 * Math.pow(600, v) : 10;
    this.djLP.frequency.setTargetAtTime(lp, t, .015); this.djHP.frequency.setTargetAtTime(hp, t, .015);
  }
  criaInsert(tipo) {
    const c = this.ctx;
    if (tipo === 'drive') { const w = c.createWaveShaper(); w.curve = C_DRIVE; return w; }
    if (tipo === 'crush') { const w = c.createWaveShaper(); w.curve = C_CRUSH; return w; }
    if (tipo === 'filtro') { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; f.Q.value = 5; return f; }
    return null;
  }
  canal(s) {
    let c = this.ch[s]; if (c) return c;
    const x = this.ctx; c = { ent: x.createGain(), vol: x.createGain(), pan: x.createStereoPanner(), ins: null, tipo: undefined, bus: null };
    c.vol.connect(c.pan); this.ch[s] = c; this.atualiza(s, true); return c;
  }
  atualiza(s, forca) {
    const c = this.ch[s]; if (!c) return;
    const som = this.E.kit.sons[s], p = som.params;
    c.vol.gain.value = p.vol; c.pan.pan.value = p.pan;
    if (forca || c.tipo !== som.insert) {
      try { c.ent.disconnect(); } catch (e) { } if (c.ins) try { c.ins.disconnect(); } catch (e) { }
      c.ins = this.criaInsert(som.insert); c.tipo = som.insert;
      if (c.ins) { c.ent.connect(c.ins); c.ins.connect(c.vol); } else c.ent.connect(c.vol);
    }
    const bus = this.E.master.duck.gatilho === s ? this.busGat : this.busDuck;
    if (c.bus !== bus) { if (c.bus) try { c.pan.disconnect(); } catch (e) { } c.pan.connect(bus); c.bus = bus; }
  }
  duck(t) {
    const d = this.E.master.duck; if (!d.on || d.prof <= 0) return;
    const g = this.busDuck.gain; g.setValueAtTime(Math.max(0, 1 - d.prof), t); g.setTargetAtTime(1, t, d.solt / 5);
  }
  clique(t, acento) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), v = this.E.cfg.metVol;
    o.type = 'square'; o.frequency.value = acento ? 1760 : 1175;
    g.gain.setValueAtTime(v * .5, t); g.gain.exponentialRampToValueAtTime(.0005, t + .045);
    o.connect(g); g.connect(this.metro); o.start(t); o.stop(t + .05);
  }
  reverso(buf) {
    let r = this.rev.get(buf); if (r) return r;
    r = this.ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) { const a = buf.getChannelData(c), b = r.getChannelData(c); for (let i = 0, n = a.length; i < n; i++) b[i] = a[n - 1 - i]; }
    this.rev.set(buf, r); return r;
  }
  // Toca uma nota do som s. dur em segundos (Infinity = segura até solta()). o: {p, g, fx, glideDe, glideT, varre:{alvo,dur}, det}
  tocar(s, midi, t, dur, o = {}) {
    const som = this.E.kit.sons[s]; if (!som || som.fonte === 'textura') return null;
    const ctx = this.ctx, p = o.p || som.params, ch = this.canal(s), bat = s >= 8, fx = o.fx || '';
    const desl = fx === 'oitU' ? 12 : fx === 'oitD' ? -12 : 0, notas = (Array.isArray(midi) ? midi : [midi]).map(n => n + desl);
    if (!notas.length) return null;
    const uni = fx === 'uni' ? [0, 17, -17] : [0];
    let g = (o.g ?? 1) * (bat ? .9 : .3) * (uni.length > 1 ? .6 : 1);
    { // teto de polifonia por som: a voz mais antiga cede
      const L = this.vozes[s], max = 4; let vivas = 0;
      for (let i = L.length - 1; i >= 0; i--) if (L[i].viva && L[i].fim > t && ++vivas >= max) L[i].corta(t);
    }
    if (p.vol !== som.params.vol && som.params.vol > 0) g *= p.vol / som.params.vol;
    const est = som.vozEstilo;
    if (est === 'mono' || est === 'legato' || (bat && est !== 'retrig')) for (const v of this.vozes[s]) v.corta(t);
    const amp = ctx.createGain(), filt = ctx.createBiquadFilter();
    filt.type = p.ftipo; filt.Q.value = p.res;
    const fm = Math.min(18000, this.fmax), corte = clamp(p.corte, 30, fm);
    if (o.varre && o.varre.alvo === 'filtro') { filt.frequency.setValueAtTime(150, t); filt.frequency.exponentialRampToValueAtTime(clamp(corte * 2, 300, fm), t + o.varre.dur); }
    else if (p.fEnv) { filt.frequency.setValueAtTime(clamp(corte * Math.pow(2, p.fEnv), 30, fm), t); filt.frequency.setTargetAtTime(corte, t, Math.max(.004, p.fDec / 3)); }
    else filt.frequency.setValueAtTime(corte, t);
    filt.connect(amp);
    let saida = amp;
    if (p.pan !== som.params.pan || (o.varre && o.varre.alvo === 'pan')) {
      const pn = ctx.createStereoPanner(); amp.connect(pn); saida = pn;
      if (o.varre && o.varre.alvo === 'pan') { pn.pan.setValueAtTime(-1, t); pn.pan.linearRampToValueAtTime(1, t + o.varre.dur); } else pn.pan.value = clamp(p.pan - som.params.pan, -1, 1);
    }
    saida.connect(ch.ent);
    const fontes = [], afinaveis = []; // afinaveis: AudioParams em cents (osc.detune) ou razão (playbackRate)
    let tFimNat = Infinity, umTiro = false, mixG = 1;
    const a = Math.max(.001, p.a), d = Math.max(.005, p.d), sus = p.s, r = Math.max(.005, o.curto ? Math.min(p.r, Math.max(.02, dur)) : p.r);
    if (som.fonte === 'synth') for (const nota of notas) {
      const f = freq(bat ? p.nota + (nota - 60) : nota);
      const osc = (tipo, fq, det, ganho) => {
        const x = ctx.createOscillator(); x.type = ONDA[tipo] || 'sine'; x.detune.value = det + (o.det || 0);
        if (o.glideDe != null) { const f0 = fq * Math.pow(2, (o.glideDe - notas[0]) / 12); x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(fq, t + Math.max(.005, o.glideT)); }
        else if (p.pEnv) { x.frequency.setValueAtTime(fq * Math.pow(2, p.pEnv / 12), t); x.frequency.exponentialRampToValueAtTime(fq, t + Math.max(.005, p.pDec)); }
        else x.frequency.setValueAtTime(fq, t);
        if (ganho === 1) x.connect(filt); else { const gg = ctx.createGain(); gg.gain.value = ganho; x.connect(gg); gg.connect(filt); }
        fontes.push(x); afinaveis.push([x.detune, 'cents']); return x;
      };
      const tem2 = !!p.o2 && p.mix > 0, so2 = tem2 && !p.o1;
      let o1 = null; // a mistura sai num ganho só (osc 2) e o resto vai no envelope
      for (const du of uni) {
        if (p.o1) { const x = osc(p.o1, f, du, 1); if (!du) o1 = x; }
        if (tem2) osc(p.o2, f * Math.pow(2, p.semi / 12), p.det + du, so2 || p.mix >= 1 ? 1 : p.mix / (1 - p.mix));
      }
      if (tem2 && !so2 && p.mix < 1) mixG = 1 - p.mix;
      if (p.fm && o1) {
        const m = ctx.createOscillator(), mg = ctx.createGain(); m.frequency.value = f * p.fmR;
        mg.gain.setValueAtTime(p.fm * f, t); mg.gain.setTargetAtTime(p.fm * f * p.fmS, t, Math.max(.01, p.fmD / 3));
        m.connect(mg); mg.connect(o1.frequency); fontes.push(m);
      }
      if (p.ruido) {
        const n = ctx.createBufferSource(), ng = ctx.createGain(); n.buffer = this.ruido; n.loop = true; ng.gain.value = p.ruido;
        if (p.rHP) { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = p.rHP; n.connect(h); h.connect(ng); } else n.connect(ng);
        ng.connect(filt); n._off = this.rand() * .9; fontes.push(n);
      }
    }
    if (som.fonte === 'synth') umTiro = bat && est !== 'gate' && est !== 'loop';
    else for (const nota of notas) {
      const am = som.amostra && this.amostras.get(som.amostra.id); if (!am) return null;
      let buf = am.buf, ini = 0, fim = buf.duration, taxa = 1;
      if (som.fonte === 'chop' && bat) { const ft = som.fatias[nota - 60]; if (!ft) return null; ini = ft.ini; fim = ft.fim; }
      else { ini = som.amostra.ini || 0; fim = som.amostra.fim || buf.duration; taxa = Math.pow(2, (nota - (bat ? 60 : (som.amostra.raiz || 60))) / 12); }
      if (fx === 'rev') { buf = this.reverso(buf); const D = buf.duration; [ini, fim] = [D - fim, D - ini]; }
      if (uni.length > 1) taxa *= 1.006;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.setValueAtTime(taxa, t);
      if (o.glideDe != null) { src.playbackRate.setValueAtTime(taxa * Math.pow(2, (o.glideDe - notas[0]) / 12), t); src.playbackRate.exponentialRampToValueAtTime(taxa, t + Math.max(.005, o.glideT)); }
      src.connect(filt); src._off = ini; src._taxa = taxa; fontes.push(src); afinaveis.push([src.playbackRate, 'razao', taxa]);
      const durReg = (fim - ini) / taxa;
      if (bat && est === 'loop') { src.loop = true; src.loopStart = ini; src.loopEnd = fim; }
      else { src._dur = fim - ini; tFimNat = Math.min(tFimNat, t + durReg); }
      umTiro = !bat ? false : (est !== 'gate' && est !== 'loop');
      if (umTiro) dur = durReg;
    }
    if (o.varre && o.varre.alvo === 'tom') for (const [prm, tipo, base] of afinaveis) {
      if (tipo === 'cents') { prm.setValueAtTime(-1200 + (o.det || 0), t); prm.linearRampToValueAtTime(o.det || 0, t + o.varre.dur); }
      else { prm.setValueAtTime(base * .5, t); prm.exponentialRampToValueAtTime(base, t + o.varre.dur); }
    }
    if (fx === 'scr') {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 7; l.connect(lg); fontes.push(l);
      for (const [prm, tipo, base] of afinaveis) { const k = ctx.createGain(); k.gain.value = tipo === 'cents' ? 600 : base * .35; lg.gain.value = 1; lg.connect(k); k.connect(prm); }
    }
    // Envelope
    g *= mixG; const G = amp.gain; G.setValueAtTime(0, t);
    const sint = som.fonte === 'synth';
    let tOff = umTiro && sint ? t + a + d * 1.3 : t + dur;
    if (tFimNat < tOff + r) tOff = Math.max(t + .002, tFimNat - Math.min(r, .01));
    const rr = (tFimNat < Infinity && tOff >= tFimNat - .011) ? .008 : (umTiro && sint && sus < .05) ? Math.min(r, .03) : r;
    let aE = Math.min(a, isFinite(tOff) ? Math.max(.001, tOff - t) : a);
    if (fx === 'rev' && sint && isFinite(tOff)) { aE = Math.max(.001, tOff - t); }
    if (p.palma) { for (let i = 0; i < 3; i++) { G.setValueAtTime(g, t + i * .012); G.exponentialRampToValueAtTime(g * .15, t + i * .012 + .01); } G.setValueAtTime(g, t + .036); G.setTargetAtTime(0, t + .036, d / 3); aE = .037; }
    else { G.linearRampToValueAtTime(sint ? g : g * 1.6, t + aE); if (sint) G.setTargetAtTime(g * sus, t + aE, d / 3); }
    const voz = { s, fim: Infinity, viva: true };
    const para = tf => { voz.fim = tf; for (const x of fontes) try { x.stop(tf); } catch (e) { } };
    const liberar = (tt, tc) => {
      if (!voz.viva || tt >= voz.fim) return;
      if (G.cancelAndHoldAtTime) G.cancelAndHoldAtTime(tt); else G.cancelScheduledValues(tt);
      G.setTargetAtTime(0, tt, tc); para(tt + tc * 6 + .01); voz.viva = false;
    };
    voz.solta = tt => liberar(Math.max(tt, t + .001), r / 3);
    voz.corta = tt => { if (tt > t) liberar(tt, .003); };
    for (const x of fontes) { if (x._off !== undefined) { if (x._dur !== undefined) x.start(t, x._off, x._dur); else x.start(t, x._off); } else x.start(t); }
    if (isFinite(tOff)) { G.setTargetAtTime(0, Math.max(tOff, t + aE), rr / 3); para(Math.max(tOff, t + aE) + rr * 2 + .02); }
    if (fontes.length) fontes[fontes.length - 1].onended = () => { voz.viva = false; try { saida.disconnect(); } catch (e) { } }; // solta o grafo da voz assim que acaba
    const lista = this.vozes[s]; lista.push(voz);
    if (lista.length > 24) lista.splice(0, lista.length - 24);
    return voz;
  }
  calar(s, t = this.ctx.currentTime) { for (const v of this.vozes[s]) v.corta(t + .002); this.vozes[s].length = 0; if (this.tex[s]) this.texLiga(s, false); }
  calarTudo() { for (let s = 0; s < 16; s++) this.calar(s); }
  // ---------- FX de performance no barramento ----------
  fxBus(idx, t, sd) {
    const id = idx >= 0 && FX[idx] ? FX[idx].id : '', fade = Math.max(.001, this.E.cfg.fade), ant = this.fxAtivo >= 0 && FX[this.fxAtivo] ? FX[this.fxAtivo].id : '';
    this.fxAtivo = idx;
    if (ant === 'filt' && id !== 'filt') this.fxFilt.frequency.setTargetAtTime(this.fmax, t, fade / 3 + .004);
    if (ant === 'gate' && id !== 'gate') { this.fxGate.gain.cancelScheduledValues(t); this.fxGate.gain.setTargetAtTime(1, t, fade / 3); }
    if (id === 'eco') { this.eco.delayTime.setValueAtTime(Math.min(1.9, 3 * sd), t); this.ecoEnv.gain.setTargetAtTime(.7, t, fade / 3); }
    else if (ant === 'eco') this.ecoEnv.gain.setTargetAtTime(0, t, fade / 3);
  }
  fxPasso(idx, t, sd, pos) {
    const id = idx >= 0 && FX[idx] ? FX[idx].id : '', fade = Math.max(.001, this.E.cfg.fade);
    if (id === 'filt') this.fxFilt.frequency.setTargetAtTime(250 * Math.pow(2, 5 * (.5 - .5 * Math.cos(Math.PI * 2 * (pos % 16) / 16))), t, Math.max(fade / 3, sd / 3));
    if (id === 'gate') { const G = this.fxGate.gain, tc = Math.max(.0015, Math.min(fade, sd * .2) / 3); G.setTargetAtTime(1, t, tc); G.setTargetAtTime(0, t + sd * .5, tc); }
  }
  // ---------- Fita ----------
  fita(on, o, t = this.ctx.currentTime) {
    if (!this.fitaNo) return false;
    const P = this.fitaNo.parameters;
    if (on) { P.get('atras').setValueAtTime(o.atras, t); P.get('loop').setValueAtTime(o.loop, t); P.get('vel').setValueAtTime(o.vel, t); P.get('fade').setValueAtTime(this.E.cfg.fade, t); }
    P.get('ativo').setValueAtTime(on ? 1 : 0, t);
    this.fitaFilt.frequency.setTargetAtTime(on ? this.fmax * Math.pow(.01, 1 - (o.filt ?? 1)) : this.fmax, t, .01);
    return true;
  }
  // ---------- Textura: loop fora da grade, com crossfade ----------
  texBuf(s) {
    const som = this.E.kit.sons[s], am = som.amostra && this.amostras.get(som.amostra.id); if (am) return am.buf;
    if (!this.amb) { // ambiente padrão sintetizado
      const sr = this.ctx.sampleRate, n = sr * 4, b = this.ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = rng(4242); let y = 0;
      for (let i = 0; i < n; i++) { y += ((r() * 2 - 1) - y) * .02; d[i] = y * 2.2 + .12 * Math.sin(i / sr * 2 * Math.PI * 110) * (.5 + .5 * Math.sin(i / sr * 2 * Math.PI * .25)) + .08 * Math.sin(i / sr * 2 * Math.PI * 164.8); }
      this.amb = b;
    }
    return this.amb;
  }
  texLiga(s, on) {
    const c = this.ctx, t = c.currentTime; let x = this.tex[s];
    if (!on) { if (x) { x.sai.gain.setTargetAtTime(0, t, .08); const y = x; setTimeout(() => { try { y.sai.disconnect(); } catch (e) { } }, 800); delete this.tex[s]; } this.E.kit.sons[s].tex.on = false; return; }
    if (x) return;
    const sai = c.createGain(), filt = c.createBiquadFilter(); sai.gain.setValueAtTime(0, t); sai.gain.setTargetAtTime(1, t, .1);
    filt.type = 'lowpass'; filt.connect(sai); sai.connect(this.canal(s).ent);
    this.tex[s] = { sai, filt, prox: t + .02, pos: 0 }; this.E.kit.sons[s].tex.on = true; this.texTick(t);
  }
  texTick(agora) {
    for (const k of Object.keys(this.tex)) {
      const x = this.tex[k], som = this.E.kit.sons[k], buf = this.texBuf(+k), frz = som.tex.frz;
      x.filt.frequency.setTargetAtTime(clamp(som.params.corte, 60, Math.min(18000, this.fmax)), agora, .03);
      while (x.prox < agora + .25) {
        const D = frz ? .22 : buf.duration, xf = frz ? .07 : Math.min(.6, D / 4), t = Math.max(x.prox, agora + .005);
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = buf;
        const off = frz ? x.pos : 0; if (!frz) x.t0 = t;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + xf); g.gain.setValueAtTime(1, t + D - xf); g.gain.linearRampToValueAtTime(0, t + D);
        src.connect(g); g.connect(x.filt); src.start(t, Math.min(off, Math.max(0, buf.duration - D)), D); x.prox = t + D - xf;
      }
      if (!frz && x.t0 !== undefined) x.pos = Math.max(0, (agora - x.t0) % buf.duration);
    }
  }
  nivel() {
    if (!this.an) return 0; this.an.getFloatTimeDomainData(this.anBuf);
    let s = 0; for (let i = 0; i < 512; i += 4) s += this.anBuf[i] * this.anBuf[i]; return Math.sqrt(s / 128);
  }
  // Redução do limitador em dB (≤ 0), estimada pelo pico antes dele: threshold −1 dB, ratio 20.
  reducao() {
    if (!this.anPre) return 0; this.anPre.getFloatTimeDomainData(this.anBuf);
    let pk = 0; for (let i = 0; i < 512; i++) { const a = Math.abs(this.anBuf[i]); if (a > pk) pk = a; }
    return pk > 0 ? -Math.max(0, 20 * Math.log10(pk) + 1) * .95 : 0;
  }
}
