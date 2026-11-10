// Teoria: escalas, acordes dos 7 graus, variações do joystick, transposição tonal. Tudo puro.
export const ESCALAS = {
  Mai: [0, 2, 4, 5, 7, 9, 11], Men: [0, 2, 3, 5, 7, 8, 10], 'Dór': [0, 2, 3, 5, 7, 9, 10],
  Mix: [0, 2, 4, 5, 7, 9, 10], Pent: [0, 2, 4, 7, 9], mPent: [0, 3, 5, 7, 10], Blues: [0, 3, 5, 6, 7, 10],
};
export const ESC_NOMES = Object.keys(ESCALAS);
const MAE = { Pent: 'Mai', mPent: 'Men', Blues: 'Men' };
// Acordes sempre saem de uma escala de 7 notas; as de 5/6 notas usam a escala-mãe.
export const escalaMae = e => ESCALAS[MAE[e] || e] || ESCALAS.Mai;
const NS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NB = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const mod = (a, n) => ((a % n) + n) % n;
export const freq = m => 440 * Math.pow(2, (m - 69) / 12);
const bemol = (tom, esc) => [5, 10, 3, 8, 1, 6].includes(escalaMae(esc)[2] === 3 ? (tom + 3) % 12 : tom);
export const nomePc = (pc, tom = 0, esc = 'Mai') => (bemol(tom, esc) ? NB : NS)[mod(pc, 12)];
export const nomeNota = (m, tom = 0, esc = 'Mai') => nomePc(m, tom, esc) + (Math.floor(m / 12) - 1);
export const NOMES_TOM = NS.map((n, i) => [5, 10, 3, 8, 1].includes(i) ? NB[i] : n);
export const baseTom = tom => (tom <= 6 ? 60 : 48) + tom;

// Joystick: índice 0 = centro; 1..8 = ↑ ↗ → ↘ ↓ ↙ ← ↖
export const VARS = ['', 'troca', '7', 'maj7', '9', 'sus4', '6', 'dim', 'aug'];
export const VAR_ROTULO = ['●', '↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
export const VAR_NOME = ['—', 'M/m', '7', 'maj7', '9', 'sus4', '6', 'dim', 'aug'];

function forma(q, v) {
  switch (v) {
    case 'troca': return q === 'maj' || q === 'aug' ? [[0, 3, 7], 'm'] : q === 'min' ? [[0, 4, 7], ''] : [[0, 3, 7], 'm'];
    case '7': return [[0, 4, 7, 10], '7'];
    case 'maj7': return q === 'maj' ? [[0, 4, 7, 11], 'maj7'] : q === 'min' ? [[0, 3, 7, 10], 'm7'] : q === 'dim' ? [[0, 3, 6, 10], 'm7b5'] : [[0, 4, 8, 11], 'maj7#5'];
    case '9': return q === 'maj' || q === 'aug' ? [[0, 4, 7, 11, 14], 'maj9'] : q === 'min' ? [[0, 3, 7, 10, 14], 'm9'] : [[0, 3, 6, 10, 14], 'm9b5'];
    case 'sus4': return [[0, 5, 7], 'sus4'];
    case '6': return q === 'maj' || q === 'aug' ? [[0, 4, 7, 9], '6'] : [[0, 2, 7], 'sus2'];
    case 'dim': return [[0, 3, 6], 'dim'];
    case 'aug': return [[0, 4, 8], 'aug'];
    default: return q === 'maj' ? [[0, 4, 7], ''] : q === 'min' ? [[0, 3, 7], 'm'] : q === 'dim' ? [[0, 3, 6], 'dim'] : [[0, 4, 8], 'aug'];
  }
}
export function qualidade(esc, grau) {
  const E = escalaMae(esc), g = mod(grau, 7), r = E[g];
  const ter = mod(E[(g + 2) % 7] - r, 12), qui = mod(E[(g + 4) % 7] - r, 12);
  return ter === 4 ? (qui === 8 ? 'aug' : 'maj') : (qui === 6 ? 'dim' : 'min');
}
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export function nomeGrau(esc, grau) {
  const q = qualidade(esc, grau), r = ROM[mod(grau, 7)];
  return q === 'maj' ? r : q === 'aug' ? r + '+' : q === 'dim' ? r.toLowerCase() + '°' : r.toLowerCase();
}
// Acorde do grau (0–6) no tom/escala, com variação, inversão (0–2) e oitava do som.
export function acorde(tom, esc, grau, vr = '', inv = 0, oit = 0) {
  const E = escalaMae(esc), g = mod(grau, 7), q = qualidade(esc, g);
  const [iv, suf] = forma(q, vr), raiz = baseTom(tom) + E[g] + 12 * oit;
  const notas = iv.map(i => raiz + i);
  for (let i = 0; i < inv && i < notas.length - 1; i++) notas.push(notas.shift() + 12);
  return { notas, nome: nomePc(raiz, tom, esc) + suf, suf, raiz, grau: g, grauNome: nomeGrau(esc, g), qual: q };
}
// Estilo Nota: a tecla k (0–6) toca a k-ésima nota da escala real (5 ou 6 notas dão a volta na oitava).
export function notaDaTecla(tom, esc, k, oit = 0, desl = 0) {
  const E = ESCALAS[esc] || ESCALAS.Mai;
  return baseTom(tom) + E[k % E.length] + 12 * Math.floor(k / E.length) + 12 * oit + desl;
}
export const pcsEscala = (tom, esc) => (ESCALAS[esc] || ESCALAS.Mai).map(x => (x + tom) % 12);
// Anda k notas dentro da escala (k negativo desce).
export function passoEscala(n, tom, esc, k) {
  const pcs = pcsEscala(tom, esc), d = Math.sign(k);
  let m = n;
  for (let i = 0; i < Math.abs(k); i++) { do { m += d; } while (!pcs.includes(mod(m, 12))); }
  return m;
}
// Transposição pela progressão: diatônica quando a nota está na escala, cromática fora dela.
export function transpDiat(n, tom, esc, g) {
  const E = escalaMae(esc), pc = mod(n - tom, 12), i = E.indexOf(pc);
  if (i < 0) return n + (g >= 0 ? E[g % 7] : -E[(-g) % 7]);
  const j = i + g;
  return n - pc + E[mod(j, 7)] + 12 * Math.floor(j / 7);
}
export function quantAcorde(n, pcs) {
  for (let d = 0; d < 7; d++) {
    if (pcs.includes(mod(n - d, 12))) return n - d;
    if (pcs.includes(mod(n + d, 12))) return n + d;
  }
  return n;
}
export const MODOS_TONAL = ['ignora', 'transp', 'oit', '5ª', '3ª', 'crom ↑', 'crom ↓', 'quant'];
// ac = acorde vigente da progressão ({grau,var}) ou null (= I). inverso desfaz 'transp' (para gravar ao vivo).
export function tonal(n, modo, ac, tom, esc, inverso = false) {
  if (modo === 'ignora' || !modo) return n;
  const g = ac ? ac.grau : 0;
  if (inverso) return transpDiat(n, tom, esc, -g);
  const ch = acorde(tom, esc, g, ac ? ac.var : '', 0, 0), pcs = ch.notas.map(x => mod(x, 12));
  switch (modo) {
    case 'transp': return transpDiat(n, tom, esc, g);
    case 'oit': return transpDiat(n, tom, esc, g) + 12;
    case '5ª': return quantAcorde(n, [pcs[2]]);
    case '3ª': return quantAcorde(n, [pcs[1]]);
    case 'crom ↑': return transpDiat(n, tom, esc, g) + 1;
    case 'crom ↓': return transpDiat(n, tom, esc, g) - 1;
    case 'quant': return quantAcorde(n, pcs);
  }
  return n;
}
// ---------- Arp ----------
export const ARP_VEL = [['1/4', 4], ['1/8', 2], ['1/16', 1], ['1/16T', 2 / 3], ['1/32', .5], ['1/8T', 4 / 3]];
export const ARP_ORDEM = ['Manual', '↑', '↓', '↑↓', '↓↑', 'Aleat'];
export const ARP_RITMO = ['Reto', 'Galope', 'Pontuada', '3-3-2', 'Fora', 'Aleat'];
const RITMOS = [[1], [1, 0, 1, 1], [1, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0], [0, 1]];
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function arpSeq(notas, ordem, alc) {
  let base = ordem === 'Manual' ? notas.slice() : [...new Set(notas)].sort((a, b) => a - b);
  let s = [];
  for (let o = 0; o < alc; o++) s.push(...base.map(n => n + 12 * o));
  if (ordem === '↓') s.reverse();
  else if (ordem === '↑↓' && s.length > 2) s = s.concat(s.slice(1, -1).reverse());
  else if (ordem === '↓↑' && s.length > 2) { s.reverse(); s = s.concat(s.slice(1, -1).reverse()); }
  return s;
}
// Nota do arp na casa k (ou null se o ritmo cala a casa). semente: por padrão, para o ritmo/ordem aleatórios.
export function arpNota(cfg, notas, k, semente = 1) {
  const s = arpSeq(notas, cfg.ordem, cfg.alc); if (!s.length) return null;
  const r = cfg.ritmo | 0;
  if (r === 5) { if (rng(semente * 977 + (k % 16) * 131)() < .4) return null; }
  else { const R = RITMOS[r] || RITMOS[0]; if (!R[k % R.length]) return null; }
  // conta só as casas que soam, para a ordem não pular notas
  let i = k;
  if (r < 5) { const R = RITMOS[r] || RITMOS[0], porCiclo = R.reduce((a, b) => a + b, 0); i = Math.floor(k / R.length) * porCiclo + R.slice(0, k % R.length).reduce((a, b) => a + b, 0); }
  if (cfg.ordem === 'Aleat') return s[Math.floor(rng(semente * 31 + k * 7919)() * s.length)];
  return s[i % s.length];
}
// Tempo (s) da posição x (em passos, pode ser fracionária) com swing: passos ímpares atrasam.
export function tempoSwing(x, sd, swing) {
  const f = x - 2 * Math.floor(x / 2), tri = f <= 1 ? f : 2 - f;
  return x * sd + swing / 100 * sd * .5 * tri;
}
