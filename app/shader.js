// Visual de ferrofluido: fosco, geométrico. WebGL a no máx. 30 fps; fallback em canvas 2D. Só anima enquanto há som.
const FRAG = `precision mediump float;
uniform vec2 uR; uniform float uT, uE, uB, uV, uP; uniform vec3 uC;
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uR)/min(uR.x,uR.y);
  float a=atan(p.y,p.x), d=length(p);
  float n=10.+floor(uP*10.);
  float sp=pow(abs(cos(a*n*.5+uT*.35)),5.+6.*(1.-uE));
  float sp2=pow(abs(cos(a*n*.25-uT*.2+1.3)),9.);
  float r=.25+.035*uB+.05*uV+(.16*uE+.02)*sp+.07*uE*sp2+.012*sin(a*3.+uT*.6);
  float m=smoothstep(r+.006,r-.006,d);
  float h=clamp(d/r,0.,1.);
  vec3 corpo=mix(vec3(.24,.24,.25),vec3(.035,.035,.04),h*h);        // lambert simples, sem brilho
  corpo=mix(corpo,uC*.85,smoothstep(.72,1.,h)*uE*.9*sp);            // pontas tingidas só quando soa
  float anel=smoothstep(.012,0.,abs(d-(r+.05+.05*uB)))*.10*uB;
  vec3 cor=corpo*m+uC*anel*(1.-m);
  gl_FragColor=vec4(cor,max(m,anel*(1.-m)));
}`;
const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);

export class Ferro {
  constructor(canvas) {
    this.cv = canvas; this.e = 0; this.b = 0; this.v = 0; this.p = .5; this.cor = [1, .62, .04]; this.t = 0; this.rodando = false; this.ult = 0; this.oculto = false; this.quadros = 0;
    this.reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { this.gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' }); } catch (e) { this.gl = null; }
    if (this.gl) { try { this.iniGL(); } catch (e) { this.gl = null; } }
    if (!this.gl) this.c2 = canvas.getContext('2d');
    this.modo = this.gl ? 'webgl' : '2d';
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.perdido = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.perdido = false; try { this.iniGL(); } catch (e) { } this.quadro(); });
    document.addEventListener('visibilitychange', () => { this.oculto = document.hidden; if (!this.oculto) this.acorda(); });
  }
  iniGL() {
    const gl = this.gl, sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link'); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const k of ['uR', 'uT', 'uE', 'uB', 'uV', 'uP', 'uC']) this.u[k] = gl.getUniformLocation(pr, k);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  tamanho() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }
  // Eventos
  nota(midi, cor) { this.e = Math.min(1, this.e + .55); if (midi != null) this.p = Math.min(1, Math.max(0, (midi - 30) / 60)); if (cor) this.cor = hex(cor); this.acorda(); }
  batida() { this.b = 1; this.acorda(); }
  nivel(v) { this.v = Math.min(1, v * 3); }
  setTocando(x) { this.tocando = x; if (x) this.acorda(); }
  acorda() { if (this.rodando || this.oculto) return; this.rodando = true; requestAnimationFrame(t => this.laco(t)); }
  laco(t) {
    if (this.oculto) { this.rodando = false; return; }
    if (t - this.ult >= 33) { // 30 fps
      const dt = Math.min(.1, (t - this.ult) / 1000 || .033); this.ult = t;
      this.e *= Math.pow(.02, dt); this.b *= Math.pow(.004, dt); if (!this.reduz) this.t += dt;
      this.quadro(); this.quadros++;
      if (!this.tocando && this.e < .004 && this.b < .004) { this.e = 0; this.b = 0; this.v = 0; this.quadro(); this.rodando = false; return; } // repouso estático
    }
    requestAnimationFrame(x => this.laco(x));
  }
  quadro() {
    this.tamanho(); const w = this.cv.width, h = this.cv.height;
    if (this.gl && !this.perdido) {
      const gl = this.gl, u = this.u; gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uR, w, h); gl.uniform1f(u.uT, this.t); gl.uniform1f(u.uE, this.e); gl.uniform1f(u.uB, this.b); gl.uniform1f(u.uV, this.v); gl.uniform1f(u.uP, this.p); gl.uniform3fv(u.uC, this.cor);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (this.c2) {
      const c = this.c2, m = Math.min(w, h), n = 10 + Math.floor(this.p * 10); c.clearRect(0, 0, w, h); c.beginPath();
      for (let i = 0; i <= 180; i++) {
        const a = i / 180 * Math.PI * 2, sp = Math.pow(Math.abs(Math.cos(a * n * .5 + this.t * .35)), 5 + 6 * (1 - this.e));
        const r = (.25 + .035 * this.b + .05 * this.v + (.16 * this.e + .02) * sp) * m;
        c[i ? 'lineTo' : 'moveTo'](w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, m * .4); g.addColorStop(0, '#3d3d40'); g.addColorStop(1, '#09090a'); c.fillStyle = g; c.fill();
    }
  }
}
