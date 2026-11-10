// Worklets: 'fita' (buffer circular do master + reprodução com velocidade/loop) e 'grava' (captura para o microfone/reamostragem).
class Fita extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return ['ativo', 'vel', 'loop', 'atras', 'fade'].map((name, i) => ({ name, defaultValue: [0, 1, 0, 0, .008][i], automationRate: 'k-rate' }));
  }
  constructor(o) {
    super();
    this.N = Math.ceil(sampleRate * ((o.processorOptions && o.processorOptions.seg) || 16.5));
    this.b = [new Float32Array(this.N), new Float32Array(this.N)];
    this.w = 0; this.on = false; this.r = 0; this.v = 1; this.mix = 0; this.ini = 0;
  }
  process(inputs, outputs, P) {
    const inp = inputs[0], out = outputs[0], n = out[0].length, N = this.N, ativo = P.ativo[0] > .5;
    if (ativo && !this.on) { this.on = true; this.ini = ((this.w - Math.round(P.atras[0] * sampleRate)) % N + N) % N; this.r = 0; this.v = 1; }
    if (!ativo) this.on = false;
    const alvo = P.vel[0], L = P.loop[0] > 0 ? Math.max(64, P.loop[0] * sampleRate) : N;
    const dm = 1 / Math.max(1, P.fade[0] * sampleRate), k = alvo === 0 ? .00012 : .002;
    const i0 = inp[0], i1 = inp[1] || inp[0], b0 = this.b[0], b1 = this.b[1], o0 = out[0], o1 = out[1] || out[0];
    for (let i = 0; i < n; i++) {
      const x0 = i0 ? i0[i] : 0, x1 = i1 ? i1[i] : 0;
      if (!this.on) { b0[this.w] = x0; b1[this.w] = x1; this.w = this.w + 1 === N ? 0 : this.w + 1; }
      this.mix = this.on ? Math.min(1, this.mix + dm) : Math.max(0, this.mix - dm);
      if (this.mix > 0) {
        const pos = (this.ini + this.r) % N, a = Math.floor(pos), f = pos - a, c = a + 1 === N ? 0 : a + 1;
        const y0 = b0[a] + (b0[c] - b0[a]) * f, y1 = b1[a] + (b1[c] - b1[a]) * f;
        o0[i] = x0 * (1 - this.mix) + y0 * this.mix; o1[i] = x1 * (1 - this.mix) + y1 * this.mix;
        this.v += (alvo - this.v) * k; this.r += this.v; if (this.r >= L) this.r -= L; else if (this.r < 0) this.r += L;
      } else { o0[i] = x0; o1[i] = x1; }
    }
    return true;
  }
}
registerProcessor('fita', Fita);

class Grava extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.port.onmessage = e => { this.on = !!e.data.on; }; }
  process(inputs) {
    const inp = inputs[0];
    if (this.on && inp && inp[0]) {
      const a = inp[0], b = inp[1], m = new Float32Array(a.length);
      if (b) for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * .5; else m.set(a);
      this.port.postMessage(m, [m.buffer]);
    }
    return true;
  }
}
registerProcessor('grava', Grava);
