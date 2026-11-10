// Núcleo: estado, áudio, persistência e ações. Não desenha nada (a UI se registra em A.pinta / A.aviso).
import { novoEstado, migra, DURS, CORES, clona, V, kitFabrica } from './dados.js';
import { Motor } from './motor.js';
import { Relogio } from './relogio.js';
import { Perf } from './perf.js';
import { Banco } from './banco.js';
import { paraBuffer, paraBase64, deBase64, novoId, Gravador, normaliza, cortaSilencio, mono, MAX_SEG } from './amostras.js';

export const A = {
  E: null, ctx: null, M: null, rel: null, perf: null, banco: null, amostras: new Map(), ferro: null, luz: new Array(16).fill(0), drones: {},
  u: { aba: 'tocar', modo: 'tocar', fxSub: 'efeitos', fxTravar: false, somSub: 'som', bibSub: 'kits', folha: null, folhaArg: null, joy: 0, seqVer: 'pagina', seqPag: 0,
    seguir: true, todosSons: false, borracha: false, armar: null, fitaVel: 1, fitaLoop: 4, fitaFilt: 1, fitaTecla: -1, pagFatia: 0, micCont: false, gravando: null, calib: null, chopTap: null, sens: .5, grade: 8 },
  hero: { nome: '', sub: '', notas: [] },
  pinta() { }, aviso() { },
};
const salvaAgora = () => { if (A.banco && A.banco.db) A.banco.set('kv', 'estado', clona(A.E)).then(() => { if (!A.banco.ok && !A.avisouBanco) { A.avisouBanco = true; A.aviso('Sem armazenamento: as mudanças não serão salvas'); } }); };
let tSalva = 0;
A.sujo = () => { clearTimeout(tSalva); tSalva = setTimeout(salvaAgora, 700); };
A.salvaJa = () => { clearTimeout(tSalva); salvaAgora(); };

export async function boot() {
  const qs = new URLSearchParams(location.search);
  A.banco = new Banco(qs.get('db') || 'bolso16');
  const ok = await A.banco.abrir(); let e = null;
  if (ok) { e = await A.banco.get('kv', 'estado'); for (const r of await A.banco.todos('amostras')) A.amostras.set(r.id, { ...r, buf: paraBuffer(r.dados, r.sr) }); }
  else A.avisoPendente = 'Sem armazenamento: as mudanças não serão salvas';
  A.E = e ? migra(e) : novoEstado();
  const AC = window.AudioContext || window.webkitAudioContext;
  A.ctx = new AC({ latencyHint: 'interactive' });
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (x) { }
  let wk = false; try { await A.ctx.audioWorklet.addModule('app/fita-worklet.js'); wk = true; } catch (x) { }
  A.worklet = wk;
  A.M = new Motor(A.ctx, A.E, A.amostras, { worklet: wk });
  A.rel = new Relogio(A.ctx, A.M, A.E, { sujo: A.sujo, perf: (...a) => A.perf.passo(...a) });
  A.perf = new Perf(A.E, A.M, A.rel, { sujo: A.sujo });
  A.rel.liga();
  const retoma = () => { if (A.ctx.state !== 'running') A.ctx.resume().catch(() => { }); };
  document.addEventListener('pointerdown', retoma, true); document.addEventListener('keydown', retoma, true);
  A.ctx.onstatechange = () => A.pinta();
  document.addEventListener('visibilitychange', () => { if (document.hidden) A.salvaJa(); });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (x) { }
}
// Troca o estado inteiro sem trocar a referência (motor, relógio e perf apontam para o mesmo objeto).
A.carregaEstado = novo => { A.rel.stop(); for (const k of Object.keys(A.E)) delete A.E[k]; Object.assign(A.E, migra(novo)); A.rel.tr.pad = A.E.ui.pad; A.M.aplicaMaster(); A.sujo(); A.pinta(); };
A.pad = () => A.rel.tocando ? A.rel.tr.pad : A.E.ui.pad;
A.P = () => A.E.padroes[A.pad()];
A.som = () => A.E.kit.sons[A.E.ui.som];
A.pisca = s => { A.luz[s] = performance.now(); };

// Toca notas ao vivo no som s. o: {ac, dur, t, g, grava, semLig}
A.toca = (s, notas, o = {}) => {
  const E = A.E, som = E.kit.sons[s], agora = A.ctx.currentTime, t = o.t ?? agora + .004, dn = DURS[som.duracao][1];
  const d = o.dur ?? (isFinite(dn) ? dn * A.rel.sd : Infinity);
  if (A.drones[s]) { for (const v of A.drones[s]) v.solta(t); delete A.drones[s]; }
  const vs = [A.M.tocar(s, notas, t, d, { g: o.g, fx: A.rel.fxVoz() })].filter(Boolean);
  if (s === E.master.duck.gatilho) A.M.duck(t);
  if (som.ligado >= 0 && som.ligado !== s && !o.semLig) { const L = E.kit.sons[som.ligado]; A.toca(som.ligado, (L.lastChord && L.lastChord.notas) || [60], { semLig: true, grava: false, t }); }
  if (o.grava !== false) { A.rel.grava(s, notas, o.ac || null, agora); A.perf.nota(s, notas, agora); }
  if (!o.semLig && o.lembra !== false) som.lastChord = { notas: notas.slice(), ac: o.ac || null };
  A.pisca(s); if (A.ferro) A.ferro.nota(notas[0], CORES[som.cor]);
  if (d === Infinity && !isFinite(dn)) { A.drones[s] = vs; return []; } // Drone: fica soando até a próxima nota ou Calar
  return vs;
};
A.calar = s => { A.M.calar(s); delete A.drones[s]; };
A.setParam = (s, k, v) => { if (!A.rel.trava(s, k, v)) { A.E.kit.sons[s].params[k] = v; A.M.atualiza(s); } A.sujo(); };

// ---------- Amostras ----------
A.addAmostra = async (dados, sr, nome) => {
  const id = novoId(), r = { id, nome, sr, dados }; A.amostras.set(id, { ...r, buf: paraBuffer(dados, sr) });
  if (A.banco.db) await A.banco.set('amostras', id, r); return id;
};
A.delAmostra = async id => { A.amostras.delete(id); if (A.banco.db) await A.banco.del('amostras', id); A.E.kit.sons.forEach(s => { if (s.amostra && s.amostra.id === id) { s.amostra = null; s.fatias = []; s.fonte = 'synth'; } }); A.sujo(); };
A.usaAmostra = (s, id) => { const som = A.E.kit.sons[s], am = A.amostras.get(id); som.amostra = { id, ini: 0, fim: am.buf.duration, raiz: 60 }; som.fatias = []; delete som.marcas; if (som.fonte === 'synth') { som.fonte = 'amostra'; Object.assign(som.params, { ftipo: 'lowpass', corte: 18000, res: .7, fEnv: 0, a: .002, r: .05 }); } som.nome = (am.nome || 'Amostra').slice(0, 9); A.sujo(); };
A.gravaMic = async () => {
  if (A.u.gravando) return A.paraGravacao();
  if (!A.worklet) { A.aviso('Gravação indisponível neste navegador'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { A.aviso('Microfone negado. Libere em Ajustes › Safari › Microfone, ou use Importar'); return; }
  const comeca = () => { const src = A.ctx.createMediaStreamSource(stream), g = new Gravador(A.ctx); g.inicia(src, () => A.paraGravacao()); A.u.gravando = { g, stream, tipo: 'mic', t0: A.ctx.currentTime }; A.pinta(); };
  if (A.u.micCont) { const t = A.ctx.currentTime + .1, b = 60 / A.E.bpm; for (let i = 0; i < 4; i++) A.M.clique(t + i * b, i === 0); A.u.gravando = { espera: true, stream }; A.pinta(); setTimeout(() => { if (A.u.gravando && A.u.gravando.espera) comeca(); }, (.1 + 4 * b) * 1000); }
  else comeca();
};
A.reamostra = () => {
  if (A.u.gravando) return A.paraGravacao();
  if (!A.worklet) { A.aviso('Reamostragem indisponível neste navegador'); return; }
  const g = new Gravador(A.ctx); g.inicia(A.M.teto, () => A.paraGravacao()); A.u.gravando = { g, tipo: 'master', t0: A.ctx.currentTime }; A.pinta();
};
A.paraGravacao = async () => {
  const x = A.u.gravando; if (!x) return; A.u.gravando = null;
  if (x.stream) x.stream.getTracks().forEach(t => t.stop());
  if (!x.g) { A.pinta(); return; }
  let d = x.g.para(); d = normaliza(cortaSilencio(d, A.ctx.sampleRate));
  if (d.length < A.ctx.sampleRate * .03) { A.aviso('Gravação vazia'); A.pinta(); return; }
  const id = await A.addAmostra(d, A.ctx.sampleRate, x.tipo === 'mic' ? 'Mic' : 'Reamost'); A.usaAmostra(A.E.ui.som, id);
  A.aviso(`Gravado · ${(d.length / A.ctx.sampleRate).toFixed(1)} s`); A.pinta();
};
A.importa = async file => {
  try {
    const ab = await file.arrayBuffer();
    const buf = await new Promise((ok, err) => { const p = A.ctx.decodeAudioData(ab, ok, err); if (p && p.then) p.then(ok, err); });
    const d = normaliza(mono(buf)); const id = await A.addAmostra(d, buf.sampleRate, file.name.replace(/\.[^.]+$/, '')); A.usaAmostra(A.E.ui.som, id);
    A.aviso(buf.duration > MAX_SEG ? `Importado (cortado em ${MAX_SEG} s)` : 'Importado'); A.pinta();
  } catch (e) { A.aviso('Não consegui ler esse arquivo de áudio'); }
};
// ---------- Backup ----------
A.exporta = async () => {
  const bib = A.banco.db ? await Promise.all((await A.banco.chaves('biblio')).map(async k => ({ k, v: await A.banco.get('biblio', k) }))) : [];
  return { app: 'bolso16', v: V, quando: new Date().toISOString(), estado: clona(A.E), biblio: bib, amostras: [...A.amostras.values()].map(a => ({ id: a.id, nome: a.nome, sr: a.sr, b64: paraBase64(a.dados) })) };
};
A.importaBackup = async obj => {
  if (!obj || obj.app !== 'bolso16' || !obj.estado) throw new Error('formato');
  for (const id of [...A.amostras.keys()]) { A.amostras.delete(id); if (A.banco.db) await A.banco.del('amostras', id); }
  for (const a of obj.amostras || []) { const dados = deBase64(a.b64), r = { id: a.id, nome: a.nome, sr: a.sr, dados }; A.amostras.set(a.id, { ...r, buf: paraBuffer(dados, a.sr) }); if (A.banco.db) await A.banco.set('amostras', a.id, r); }
  if (A.banco.db) for (const b of obj.biblio || []) await A.banco.set('biblio', b.k, b.v);
  A.carregaEstado(obj.estado); A.salvaJa();
};
A.kitFabrica = () => { A.E.kit = kitFabrica(); A.M.aplicaMaster(); A.sujo(); A.pinta(); };
