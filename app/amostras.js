// Amostras: gravação (microfone / master), importação, normalização, CHOP e codificação para backup.
export const MAX_SEG = 40;

export function normaliza(d) { let p = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } if (p > 1e-4) { const k = .95 / p; for (let i = 0; i < d.length; i++) d[i] *= k; } return d; }
export function cortaSilencio(d, sr, lim = .02) {
  let i = 0; while (i < d.length && Math.abs(d[i]) < lim) i++;
  i = Math.max(0, i - Math.round(sr * .003)); return i > 0 ? d.slice(i) : d;
}
export function paraBuffer(dados, sr) { const b = new AudioBuffer({ length: Math.max(1, dados.length), sampleRate: sr, numberOfChannels: 1 }); b.getChannelData(0).set(dados); return b; }
export function mono(buf, maxSeg = MAX_SEG) {
  const n = Math.min(buf.length, Math.floor(maxSeg * buf.sampleRate)), out = new Float32Array(n), C = buf.numberOfChannels;
  for (let c = 0; c < C; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / C; }
  return out;
}
// Ataques por fluxo de energia (janela 10 ms). sens 0–1: mais = mais fatias. Devolve inícios em segundos.
export function detectaAtaques(d, sr, sens = .5) {
  const w = Math.round(sr * .01), h = Math.round(sr * .005), n = Math.floor((d.length - w) / h);
  if (n < 3) return [0];
  const e = new Float32Array(n); let emax = 0;
  for (let i = 0; i < n; i++) { let s = 0; const o = i * h; for (let j = 0; j < w; j++) s += d[o + j] * d[o + j]; e[i] = Math.sqrt(s / w); if (e[i] > emax) emax = e[i]; }
  if (emax < 1e-5) return [0];
  const piso = emax * Math.pow(10, -(.6 + sens * 2.4)), razao = 3.2 - sens * 2, gap = Math.round(.05 / .005), out = []; let ult = -gap;
  for (let i = 1; i < n; i++) {
    const ant = Math.max(e[i - 1], i > 1 ? e[i - 2] : 0);
    if (e[i] > piso && e[i] > ant * razao + piso * .5 && i - ult >= gap) {
      // refina: primeira amostra acima de 10% do pico dos próximos 20 ms
      const a = Math.max(0, (i - 2) * h), b = Math.min(d.length, i * h + Math.round(sr * .02)); let pk = 0;
      for (let j = a; j < b; j++) pk = Math.max(pk, Math.abs(d[j]));
      let j = a; while (j < b && Math.abs(d[j]) < pk * .1) j++;
      out.push(j / sr); ult = i;
    }
  }
  return out.length ? out : [0];
}
export function fatiasDe(marcas, dur) { const m = [...marcas].sort((a, b) => a - b); return m.map((x, i) => ({ ini: x, fim: i + 1 < m.length ? m[i + 1] : dur })); }
export const marcasGrade = (dur, n) => Array.from({ length: n }, (_, i) => i * dur / n);
// A amostra tem 1, 2 ou 4 compassos neste BPM? (tolerância 3%)
export function compassosDe(dur, bpm) { const c = dur / (240 / bpm); for (const k of [1, 2, 4]) if (Math.abs(c - k) / k < .03) return k; return 0; }

// Captura por AudioWorklet ('grava'). fonte: AudioNode. Limite de MAX_SEG.
export class Gravador {
  constructor(ctx) { this.ctx = ctx; this.partes = []; this.n = 0; this.no = null; }
  inicia(fonte, aoEncher) {
    this.partes = []; this.n = 0; const max = MAX_SEG * this.ctx.sampleRate;
    this.no = new AudioWorkletNode(this.ctx, 'grava', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    this.mudo = this.ctx.createGain(); this.mudo.gain.value = 0;
    this.no.port.onmessage = e => { if (this.n >= max) return; this.partes.push(e.data); this.n += e.data.length; if (this.n >= max && aoEncher) aoEncher(); };
    fonte.connect(this.no); this.no.connect(this.mudo); this.mudo.connect(this.ctx.destination); this.fonte = fonte;
    this.no.port.postMessage({ on: true });
  }
  para() {
    if (!this.no) return new Float32Array(0);
    this.no.port.postMessage({ on: false }); try { this.fonte.disconnect(this.no); this.no.disconnect(); this.mudo.disconnect(); } catch (e) { }
    const out = new Float32Array(Math.min(this.n, MAX_SEG * this.ctx.sampleRate)); let o = 0;
    for (const p of this.partes) { if (o + p.length > out.length) { out.set(p.subarray(0, out.length - o), o); break; } out.set(p, o); o += p.length; }
    this.no = null; this.partes = []; return out;
  }
  get segundos() { return this.n / this.ctx.sampleRate; }
}
// PCM 16 bits em base64 (backup .json)
export function paraBase64(f32) {
  const i16 = new Int16Array(f32.length); for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
  const u8 = new Uint8Array(i16.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
}
export function deBase64(b64) {
  const s = atob(b64), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  const i16 = new Int16Array(u8.buffer, 0, u8.length >> 1), f = new Float32Array(i16.length); for (let i = 0; i < f.length; i++) f[i] = i16[i] / 32767; return f;
}
export const novoId = () => 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
