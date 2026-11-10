// Interface: casca (abas, pílula, visor), aba Tocar, superfícies de tocar e laço de quadro.
import { A } from './nucleo.js';
import { el, ic, bt, seg, linha, passos, barra, confirma, confirmando } from './dom.js';
import { CORES, FX, DURS } from './dados.js';
import { acorde, notaDaTecla, nomeNota, nomeGrau, VARS, VAR_NOME, ARP_VEL, arpNota, mod } from './teoria.js';
import { locDe } from './relogio.js';
import { ESTADO_NOME } from './perf.js';
import { pintaSequencia, pintaSom, pintaBiblioteca, pintaFolha, reamostraPerf } from './telas.js';
import { Ferro } from './shader.js';

const $ = id => document.getElementById(id);
const ABAS = [['tocar', 'Tocar', 'tocar'], ['seq', 'Sequência', 'seq'], ['som', 'Som', 'som'], ['bib', 'Biblioteca', 'bib']];
const OFFS = [-12, -7, -5, -2, 2, 5, 7, 12];
const JOY = [8, 1, 2, 7, 0, 3, 6, 5, 4]; // ordem visual 3×3
const JOY_DESL = [0, 12, 13, 1, -11, -12, -13, -1, 11]; // estilo Nota: ↑↓ oitava, ←→ semitom
const seguros = new Map(); let assSup = '', heroEl, tAviso = 0;

export function montaCasca() {
  const app = $('app');
  app.append(
    el('nav', { id: 'abas', role: 'tablist', 'aria-label': 'Abas' }, ABAS.map(([id, nome, icone]) => el('button', { type: 'button', role: 'tab', 'data-aba': id, id: 'aba-' + id, onclick: () => { A.u.aba = id; A.u.folha = null; A.pinta(); } }, ic(icone), el('span', { text: nome })))),
    el('header', { id: 'topo' },
      el('div', { id: 'pilula' },
        el('button', { type: 'button', id: 'rec', 'aria-label': 'Gravar', onpointerdown: e => { e.preventDefault(); A.rel.alternaRec(); if (!A.rel.rec) { A.u.borracha = false; A.rel.tr.borr.clear(); } A.pinta(); } }, ic('rec')),
        el('button', { type: 'button', id: 'play', 'aria-label': 'Tocar ou parar', onpointerdown: e => { e.preventDefault(); if (A.rel.tocando) { A.rel.stop(); A.perf.parou(); A.u.borracha = false; A.rel.tr.borr.clear(); A.salvaJa(); } else A.rel.play(); A.pinta(); } }, ic('play')),
        el('span', { id: 'pos', text: '1/16' }),
        el('button', { type: 'button', id: 'bpm', 'aria-label': 'Tempo', onclick: () => abreFolha('tempo') }, el('b', { id: 'bpmN', text: '120' }), el('span', { text: 'BPM' }))),
      el('div', { id: 'visor', role: 'status', text: '' }),
      el('div', { id: 'linhaRec', hidden: true },
        bt('Desfazer volta', () => { A.aviso(A.rel.desfazVolta() ? 'Volta desfeita' : 'Nada a desfazer'); A.sujo(); A.pinta(); }, { id: 'desfazVolta' }),
        bt('Borracha', () => { A.u.borracha = !A.u.borracha; if (!A.u.borracha) A.rel.tr.borr.clear(); else A.aviso('Segure um pad para apagar'); A.pinta(); }, { id: 'borracha', on: false }),
        btFill('fillRec'))),
    el('main', { id: 'corpo' }), el('section', { id: 'sup', 'aria-label': 'Superfície de tocar' }),
    el('div', { id: 'folha', hidden: true }), el('div', { id: 'banner', hidden: true }), el('div', { id: 'aviso', role: 'status', hidden: true }));
  heroEl = el('div', { class: 'hero' }, el('canvas', { id: 'ferro', 'aria-hidden': 'true' }), el('div', { class: 'heroTxt' }, el('div', { id: 'heroNome', class: 'heroNome', text: '' }), el('div', { id: 'heroSub', class: 'heroSub', text: '' })),
    el('div', { id: 'faixa25', class: 'faixa25', 'aria-hidden': 'true' }, Array.from({ length: 25 }, (_, i) => el('i', { class: [1, 3, 6, 8, 10].includes(i % 12) ? 'p' : '' }))));
  const sup = $('sup');
  sup.addEventListener('pointerdown', e => { const b = e.target.closest('[data-pad],[data-tecla],[data-joy],[data-fx]'); if (!b) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { } baixa(b, e.pointerId); });
  const sobe = e => { const s = seguros.get(e.pointerId); if (s) { seguros.delete(e.pointerId); s(); } };
  sup.addEventListener('pointerup', sobe); sup.addEventListener('pointercancel', sobe);
  sup.addEventListener('contextmenu', e => e.preventDefault());
  A.pinta = pinta; A.aviso = aviso; A.abreFolha = abreFolha; A.fechaFolha = () => { A.u.folha = null; pinta(); };
  const mq = matchMedia('(min-width:760px) and (orientation:landscape)'), lay = () => { app.dataset.layout = mq.matches ? 'largo' : innerWidth >= 500 ? 'interno' : 'externo'; if (A.ferro) A.ferro.quadro(); };
  mq.addEventListener('change', lay); addEventListener('resize', lay); lay();
  pinta(); A.ferro = new Ferro($('ferro')); A.ferro.quadro();
  if (A.avisoPendente) aviso(A.avisoPendente);
  requestAnimationFrame(quadro);
}
function btFill(id) {
  const b = bt('Fill', null, { id, on: false, class: 'fill' });
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { } A.rel.tr.fill = true; marcaFill(); });
  const s = () => { A.rel.tr.fill = false; marcaFill(); }; b.addEventListener('pointerup', s); b.addEventListener('pointercancel', s); return b;
}
const marcaFill = () => document.querySelectorAll('.fill').forEach(b => b.setAttribute('aria-pressed', String(!!A.rel.tr.fill)));
export function aviso(t) { const a = $('aviso'); a.textContent = t; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => { a.hidden = true; }, 2600); }
export function abreFolha(nome, arg) { A.u.folha = A.u.folha === nome && arg === undefined ? null : nome; A.u.folhaArg = arg; pinta(); }

export function pinta() {
  const E = A.E, u = A.u, app = $('app'), rel = A.rel;
  app.dataset.aba = u.aba; app.dataset.modo = u.modo; app.dataset.rec = rel.rec ? '1' : '0';
  for (const [id] of ABAS) $('aba-' + id).setAttribute('aria-selected', String(u.aba === id));
  $('rec').setAttribute('aria-pressed', String(rel.rec)); $('play').setAttribute('aria-pressed', String(rel.tocando));
  $('play').replaceChildren(ic(rel.tocando ? 'stop' : 'play')); $('bpmN').textContent = E.bpm;
  $('linhaRec').hidden = !rel.rec; document.querySelector('[data-id=borracha]').setAttribute('aria-pressed', String(u.borracha));
  const c = $('corpo'), rol = c.scrollTop; c.replaceChildren();
  if (u.aba === 'tocar') pintaTocar(c); else if (u.aba === 'seq') pintaSequencia(c); else if (u.aba === 'som') pintaSom(c); else pintaBiblioteca(c);
  c.scrollTop = rol;
  pintaSup();
  const f = $('folha'); f.replaceChildren(); f.hidden = !u.folha;
  const tR = $('topo').getBoundingClientRect(), aR = app.getBoundingClientRect(), cR = c.getBoundingClientRect(), sup = $('sup'), topo = tR.bottom - aR.top + 4;
  const caixa = x => { x.style.top = topo + 'px'; x.style.left = (cR.left - aR.left + 10) + 'px'; x.style.width = (cR.width - 20) + 'px'; };
  if (u.folha) {
    const baixo = ['passo', 'somSeq', 'editar'].includes(u.folha); f.className = 'folha ' + (baixo ? 'baixo' : 'cima'); f.style.cssText = '';
    if (!baixo) { caixa(f); f.style.maxHeight = ((!sup.hidden && app.dataset.layout !== 'largo' ? sup.getBoundingClientRect().top : aR.bottom) - tR.bottom - 12) + 'px'; }
    pintaFolha(f);
  }
  $('aviso').style.top = (topo + 2) + 'px';
  const b = $('banner'); b.hidden = !u.armar; b.replaceChildren(); caixa(b);
  if (u.armar) b.append(el('span', { text: u.armar.tipo === 'cadeia' ? 'Toque nos padrões, na ordem' : 'Toque no destino' }), bt(u.armar.tipo === 'cadeia' ? 'Pronto' : 'Cancelar', () => { u.armar = null; pinta(); }, { class: 'txt' }));
  marcaFill();
}
// ---------- Aba Tocar ----------
function trocaSom(d) { A.E.ui.som = mod(A.E.ui.som + d, 16); A.sujo(); pinta(); }
function pintaTocar(c) {
  const E = A.E, u = A.u, s = E.ui.som, som = A.som(), mel = s < 8;
  c.append(el('div', { class: 'cab' },
    bt(ic('esq'), () => trocaSom(-1), { label: 'Som anterior', class: 'q' }),
    el('button', { type: 'button', class: 'bt nome', 'data-id': 'escolheSom', onclick: () => abreFolha('sons'), style: `--cor:${CORES[som.cor]}` }, el('i', { class: 'pt' }), el('span', { text: `Som ${s + 1}` }), ic('baixo')),
    bt(ic('dir'), () => trocaSom(1), { label: 'Próximo som', class: 'q' }),
    bt('Calar', () => A.calar(s), { id: 'calar' }),
    mel ? el('button', { type: 'button', class: 'bt', 'data-id': 'tom', onclick: () => abreFolha('tom') }, el('span', { text: 'Tom' }), ic('dir')) : null),
    seg('Modo', [['tocar', 'Tocar'], ['fx', 'FX'], ['perf', 'Perf']], u.modo, v => { u.modo = v; pinta(); }, { semRotulo: true, id: 'modo' }));
  if (u.modo === 'tocar') {
    c.append(heroEl);
    if (mel) c.append(seg('Estilo', [['acorde', 'Acorde'], ['strum', 'Strum'], ['arp', 'Arp'], ['nota', 'Nota']], som.estilo, v => { som.estilo = v; soltaTudo(); A.sujo(); pinta(); }, { semRotulo: true, id: 'estilo' }));
    else if (som.fonte === 'chop' && som.fatias.length > 8) c.append(seg('Fatias', [[0, 'Fatias 1–8'], [1, 'Fatias 9–16']], u.pagFatia, v => { u.pagFatia = v; pinta(); }, { semRotulo: true }));
    atualizaHero();
  } else if (u.modo === 'fx') pintaFx(c); else pintaPerf(c);
}
function pintaFx(c) {
  const u = A.u, rel = A.rel, E = A.E, P = A.P();
  c.append(el('div', { class: 'painel' },
    seg('FX', [['efeitos', 'Efeitos'], ['fita', 'Fita']], u.fxSub, v => { u.fxSub = v; pinta(); }, { semRotulo: true, id: 'fxSub' }),
    u.fxSub === 'efeitos' ? [
      el('div', { class: 'ln3' },
        seg('Modo do FX', [[false, 'Segurar'], [true, 'Travar']], u.fxTravar, v => { u.fxTravar = v; rel.tr.fxSeg = -1; pinta(); }, { semRotulo: true, id: 'fxModo' }),
        btFill('fillFx')),
      el('div', { class: 'ln3' },
        bt('Gravar no padrão', () => { rel.fxRec = !rel.fxRec; if (rel.fxRec) aviso('Toque e segure um efeito com o padrão tocando'); pinta(); }, { on: !!rel.fxRec, id: 'fxGravar' }),
        bt(confirmando('apFx') ? 'Confirmar?' : 'Apagar FX', () => confirma('apFx', () => { P.fx = {}; P.dj = {}; P.fita = {}; A.sujo(); aviso('FX do padrão apagados'); pinta(); }, pinta), { id: 'fxApagar' })),
      barra('Filt DJ', -1, 1, .02, E.master.dj, v => Math.abs(v) < .03 ? 'neutro' : v < 0 ? 'LP ' + Math.round(-v * 100) : 'HP ' + Math.round(v * 100), (v, fim) => {
        if (Math.abs(v) < .03) v = 0;
        if (rel.rec && rel.tocando) { const e = rel.atual(); if (e && e.passo >= 0) { E.padroes[e.padrao].dj[e.passo] = v; A.M.dj(v, A.ctx.currentTime); } }
        else { E.master.dj = v; A.M.dj(v, A.ctx.currentTime); } A.sujo(); if (fim) pinta();
      }, { id: 'filtDj' }),
    ] : [
      seg('Vel', [[1, 'Normal'], [2, 'Rápido'], [.5, 'Lento'], [0, 'Parada']], u.fitaVel, v => { u.fitaVel = v; fitaAtualiza(); pinta(); }, { id: 'fitaVel' }),
      passos('Loop', ['Sem', '1/16', '1/8', '1/4', '1/2', '1 comp'][[0, 1, 2, 4, 8, 16].indexOf(u.fitaLoop)], () => { const L = [0, 1, 2, 4, 8, 16], i = L.indexOf(u.fitaLoop); u.fitaLoop = L[Math.max(0, i - 1)]; fitaAtualiza(); pinta(); }, () => { const L = [0, 1, 2, 4, 8, 16], i = L.indexOf(u.fitaLoop); u.fitaLoop = L[Math.min(5, i + 1)]; fitaAtualiza(); pinta(); }, { id: 'fitaLoop' }),
      barra('Filt', 0, 1, .02, u.fitaFilt, v => Math.round(v * 100) + '%', v => { u.fitaFilt = v; fitaAtualiza(); }, { id: 'fitaFilt' }),
      el('div', { class: 'ln3' },
        seg('Modo da fita', [[false, 'Segurar'], [true, 'Travar']], u.fxTravar, v => { u.fxTravar = v; fitaDesliga(); pinta(); }, { semRotulo: true }),
        bt('Gravar', () => { rel.fitaRec = !rel.fitaRec; pinta(); }, { on: !!rel.fitaRec, id: 'fitaGravar', label: 'Gravar fita no padrão' })),
      A.worklet ? null : el('p', { class: 'nota', text: 'Fita indisponível neste navegador' }),
    ]));
}
const fitaCfg = i => ({ atras: (16 - i) * 4 * A.rel.sd, loop: A.u.fitaLoop * A.rel.sd, vel: A.u.fitaVel, filt: A.u.fitaFilt });
function fitaLiga(i) { const o = fitaCfg(i); A.u.fitaTecla = i; A.rel.fitaSeg = o; A.M.fita(true, o); }
function fitaDesliga() { if (A.u.fitaTecla < 0) return; A.u.fitaTecla = -1; A.rel.fitaSeg = null; A.M.fita(false, {}); }
function fitaAtualiza() { if (A.u.fitaTecla < 0) return; const o = fitaCfg(A.u.fitaTecla), P = A.M.fitaNo && A.M.fitaNo.parameters, t = A.ctx.currentTime; A.rel.fitaSeg = o; if (P) { P.get('vel').setValueAtTime(o.vel, t); P.get('loop').setValueAtTime(o.loop, t); A.M.fitaFilt.frequency.setTargetAtTime(20000 * Math.pow(.01, 1 - o.filt), t, .01); } }
function pintaPerf(c) {
  const pf = A.perf, E = A.E, i = pf.sel, f = pf.fx[i];
  c.append(el('div', { class: 'painel' },
    el('div', { class: 'faixas' }, pf.fx.map((x, k) => {
      const b = el('button', { type: 'button', class: 'fxa', 'data-faixa': k, 'data-est': x.estado, 'aria-pressed': String(k === i), 'aria-label': `Faixa ${k + 1}: ${ESTADO_NOME[x.estado]}` },
        el('span', { class: 'anel' }), el('b', { text: 'F' + (k + 1) }), el('span', { class: 'est', text: x.mute ? 'MUTE' : ESTADO_NOME[x.estado] }));
      b.addEventListener('pointerdown', e => { e.preventDefault(); pf.arma(k, 'ciclo'); pinta(); }); return b;
    })),
    el('div', { class: 'ln6' },
      bt('Desf', () => { pf.desf(i); pinta(); }, { id: 'pfDesf' }), bt('Refaz', () => { pf.refaz(i); pinta(); }, { id: 'pfRefaz' }),
      bt('×2', () => { pf.arma(i, 'x2'); pinta(); }, { id: 'pfX2' }), bt('½', () => { pf.arma(i, 'meio'); pinta(); }, { id: 'pfMeio' }),
      bt(confirmando('pfL' + i) ? 'Conf?' : 'Limpar', () => confirma('pfL' + i, () => { pf.limpa(i); pinta(); }, pinta), { id: 'pfLimpar' }),
      bt('Salvar', () => { const r = pf.salvar(); aviso(r >= 0 ? `Faixas → P${r + 1} · na cadeia` : r === -1 ? 'Nada gravado nas faixas' : 'Sem padrão livre'); pinta(); }, { id: 'pfSalvar' })),
    el('div', { class: 'ln6' },
      bt('Mute', () => { pf.arma(i, 'mute'); pinta(); }, { on: f.mute, id: 'pfMute' }),
      bt('FB −', () => { f.fb = Math.max(0, Math.round((f.fb - .1) * 10) / 10); A.sujo(); pinta(); }, { id: 'pfFbMenos' }),
      el('span', { class: 'val', id: 'pfFb', text: 'FB ' + Math.round(f.fb * 100) }),
      bt('FB +', () => { f.fb = Math.min(1, Math.round((f.fb + .1) * 10) / 10); A.sujo(); pinta(); }, { id: 'pfFbMais' }),
      bt('Reamost', () => reamostraPerf(), { id: 'pfReamost' })),
    seg('Q', [['1 comp', '1 comp'], ['1 tempo', '1 tempo'], ['Livre', 'Livre']], E.perf.q, v => { E.perf.q = v; A.sujo(); pinta(); }, { id: 'pfQ' })));
}
// ---------- Herói ----------
export function atualizaHero() {
  const h = A.hero, n = $('heroNome'); if (!n) return;
  const som = A.som(); $('faixa25').hidden = A.E.ui.som >= 8; n.textContent = h.nome || som.nome; n.dataset.longo = (h.nome || som.nome).length > 6 ? '1' : '0'; $('heroSub').textContent = h.sub || (A.E.ui.som < 8 ? 'toque uma tecla' : 'toque um pad');
}
function acendeFaixa(notas) {
  const f = $('faixa25'); if (!f) return; const ks = f.children; for (const k of ks) k.classList.remove('on'); if (!notas || !notas.length) return;
  const base = 12 * Math.floor(Math.min(...notas) / 12); for (const x of notas) { const i = x - base; if (i >= 0 && i < 25) ks[i].classList.add('on'); }
}
// ---------- Superfície ----------
function pintaSup() {
  const E = A.E, u = A.u, sup = $('sup'), s = E.ui.som, som = A.som(), P = A.P();
  sup.hidden = u.aba !== 'tocar'; if (sup.hidden) return;
  const tipo = u.modo === 'fx' ? 'fx' : s < 8 ? 'tec' : 'pads';
  const ass = [tipo, u.fxSub, s < 8 ? s : 'b', P.tom, P.escala, som.estilo, som.inversao, som.oitava, A.pad()].join('|') + (tipo === 'pads' ? '|' + E.kit.sons.slice(8).map(x => x.nome + x.fonte + x.cor).join() : '');
  if (ass !== assSup) {
    assSup = ass; soltaTudo(); sup.replaceChildren(); sup.dataset.tipo = tipo;
    if (tipo === 'tec') sup.append(
      el('div', { class: 'joyln' }, el('div', { class: 'joyinfo' }, el('b', { id: 'varNome', text: '—' }), el('span', { id: 'varDica', text: 'variação' })),
        el('div', { class: 'joy', role: 'group', 'aria-label': 'Variação do acorde' }, JOY.map(j => el('button', { type: 'button', 'data-joy': j, 'aria-pressed': 'false', 'aria-label': j ? 'Variação ' + VAR_NOME[j] : 'Sem variação' }, j ? ic('seta', (j - 1) * 45) : ic('ponto'))))),
      el('div', { class: 'teclas' }, Array.from({ length: 7 }, (_, k) => el('button', { type: 'button', class: 'tecla', 'data-tecla': k }, el('small'), el('b')))));
    else if (tipo === 'pads') sup.append(el('div', { class: 'pads' }, [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3].map(i => el('button', { type: 'button', class: 'pad' + (i >= 8 ? ' fat' : ''), 'data-pad': i }, el('small'), el('b')))));
    else sup.append(el('div', { class: 'pads' }, Array.from({ length: 16 }, (_, i) => el('button', { type: 'button', class: 'pad fxk', 'data-fx': i, 'aria-pressed': 'false' }, el('small', { text: String(i + 1) }), el('b')))));
  }
  rotulaSup();
}
function rotulaSup() {
  const E = A.E, u = A.u, sup = $('sup'), s = E.ui.som, som = A.som(), P = A.P(), tipo = sup.dataset.tipo;
  if (tipo === 'tec') {
    const nota = som.estilo === 'nota';
    sup.querySelectorAll('[data-tecla]').forEach(b => {
      const k = +b.dataset.tecla; b.style.setProperty('--cor', CORES[som.cor]);
      if (nota) { const n = notaDaTecla(P.tom, P.escala, k, som.oitava, JOY_DESL[u.joy]); b.children[0].textContent = String(k + 1); b.children[1].textContent = nomeNota(n, P.tom, P.escala).replace(/-?\d+$/, ''); b.setAttribute('aria-label', 'Nota ' + nomeNota(n, P.tom, P.escala)); }
      else { const ch = acorde(P.tom, P.escala, k, VARS[u.joy], som.inversao, som.oitava); b.children[0].textContent = nomeGrau(P.escala, k); b.children[1].textContent = ch.nome; b.dataset.longo = ch.nome.length > 4 ? '1' : '0'; b.setAttribute('aria-label', 'Acorde ' + ch.nome); }
    });
    sup.querySelectorAll('[data-joy]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.joy === u.joy && u.joy > 0)));
    $('varNome').textContent = nota ? (u.joy ? (JOY_DESL[u.joy] > 0 ? '+' : '') + JOY_DESL[u.joy] : '0') : VAR_NOME[u.joy];
    $('varDica').textContent = nota ? 'semitons' : u.joy ? 'travada · ● solta' : 'variação';
  } else if (tipo === 'pads') {
    sup.querySelectorAll('[data-pad]').forEach(b => {
      const i = +b.dataset.pad;
      if (i < 8) { const x = E.kit.sons[8 + i]; b.style.setProperty('--cor', CORES[x.cor]); b.children[0].textContent = String(9 + i); b.children[1].textContent = x.nome; b.setAttribute('aria-pressed', String(8 + i === s)); b.setAttribute('aria-label', 'Pad ' + x.nome); b.dataset.tex = x.fonte === 'textura' && x.tex.on ? '1' : '0'; }
      else {
        const j = i - 8, chop = s >= 8 && som.fonte === 'chop'; b.style.setProperty('--cor', CORES[som.cor]);
        const vazio = s < 8 || som.fonte === 'textura' || (chop && !som.fatias[u.pagFatia * 8 + j]);
        b.disabled = vazio; b.children[0].textContent = chop ? 'fatia' : 'tom';
        b.children[1].textContent = vazio ? '·' : chop ? String(u.pagFatia * 8 + j + 1) : (OFFS[j] > 0 ? '+' : '−') + Math.abs(OFFS[j]);
        b.setAttribute('aria-label', chop ? 'Fatia ' + (u.pagFatia * 8 + j + 1) : 'Afinação ' + OFFS[j]);
      }
    });
  } else {
    const fita = u.fxSub === 'fita';
    sup.querySelectorAll('[data-fx]').forEach(b => {
      const i = +b.dataset.fx; b.children[1].textContent = fita ? 'Início' : i < 15 ? FX[i].n : 'Sem';
      b.setAttribute('aria-label', fita ? 'Fita: início ' + (i + 1) : i < 15 ? 'Efeito ' + FX[i].n : 'Sem efeito');
      b.setAttribute('aria-pressed', String(fita ? u.fitaTecla === i : i < 15 && A.rel.tr.fxSeg === i));
    });
  }
}
function soltaTudo() { for (const f of seguros.values()) f(); seguros.clear(); if (A.arpRep) { A.rel.repDesliga(A.arpRep); A.arpRep = null; A.arpTeclas = 0; } }
function reptU() { return ({ '1/8': 2, '1/16': 1, '1/32': .5 })[A.E.cfg.rept] || 0; }
function baixa(b, pid) {
  const E = A.E, u = A.u, rel = A.rel, agora = A.ctx.currentTime;
  if (b.dataset.joy !== undefined) { const j = +b.dataset.joy; u.joy = j === u.joy ? 0 : j; rotulaSup(); return; }
  if (b.dataset.fx !== undefined) {
    const i = +b.dataset.fx;
    if (u.fxSub === 'fita') { if (u.fxTravar) { if (u.fitaTecla === i) fitaDesliga(); else fitaLiga(i); } else { fitaLiga(i); seguros.set(pid, () => { fitaDesliga(); rotulaSup(); }); } }
    else if (i === 15) rel.tr.fxSeg = -1;
    else if (u.fxTravar) rel.tr.fxSeg = rel.tr.fxSeg === i ? -1 : i;
    else { rel.tr.fxSeg = i; seguros.set(pid, () => { if (rel.tr.fxSeg === i) rel.tr.fxSeg = -1; rotulaSup(); }); }
    rotulaSup(); return;
  }
  b.classList.add('ap'); const tira = () => b.classList.remove('ap');
  if (b.dataset.pad !== undefined) {
    const i = +b.dataset.pad; let s = E.ui.som, nota = 60;
    if (i < 8) { s = 8 + i; if (E.ui.som !== s) { E.ui.som = s; A.sujo(); if (u.aba === 'tocar') { const nm = document.querySelector('[data-id=escolheSom] span'); if (nm) { nm.textContent = `Som ${s + 1}`; nm.parentNode.style.setProperty('--cor', CORES[E.kit.sons[s].cor]); } A.hero.nome = ''; A.hero.sub = ''; atualizaHero(); } rotulaSup(); } }
    else { const som = E.kit.sons[s]; nota = som.fonte === 'chop' ? 60 + u.pagFatia * 8 + (i - 8) : 60 + OFFS[i - 8]; }
    const som = E.kit.sons[s];
    if (u.borracha && rel.rec) { rel.tr.borr.add(s); seguros.set(pid, () => { rel.tr.borr.delete(s); tira(); }); return; }
    if (som.fonte === 'textura') { A.M.texLiga(s, !som.tex.on); rotulaSup(); seguros.set(pid, tira); return; }
    const seg = som.vozEstilo === 'gate' || som.vozEstilo === 'loop';
    const vs = A.toca(s, [nota], seg ? { dur: Infinity } : {});
    A.hero.nome = som.nome; A.hero.sub = i < 8 ? `som ${s + 1}` : som.fonte === 'chop' ? `fatia ${nota - 59}` : `${nota > 60 ? '+' : ''}${nota - 60} st`; atualizaHero();
    let rep = null; const ru = reptU();
    if (ru) rep = rel.repLiga({ s, u: ru, fn: () => [nota], toca: (ns, t) => { A.toca(s, ns, { t, grava: false, lembra: false }); A.perf.nota(s, ns, t + rel.lat + E.cfg.lat); } }, true);
    seguros.set(pid, () => { tira(); if (rep) rel.repDesliga(rep); if (seg) vs.forEach(v => v.solta(A.ctx.currentTime)); });
    return;
  }
  // teclado de melodia
  const k = +b.dataset.tecla, s = E.ui.som, som = E.kit.sons[s], P = A.P(), h = A.hero;
  let notas, ac = null;
  if (som.estilo === 'nota') { const n = notaDaTecla(P.tom, P.escala, k, som.oitava, JOY_DESL[u.joy]); notas = [n]; h.nome = nomeNota(n, P.tom, P.escala); h.sub = `grau ${k + 1} · ${VARS[0] || 'nota'}`; }
  else { const ch = acorde(P.tom, P.escala, k, VARS[u.joy], som.inversao, som.oitava); notas = ch.notas; ac = { grau: k, var: VARS[u.joy], inv: som.inversao }; h.nome = ch.nome; h.sub = `${ch.grauNome} · ${notas.map(n => nomeNota(n, P.tom, P.escala).replace(/-?\d+$/, '')).join(' ')}${u.joy ? ' · ' + VAR_NOME[u.joy] : ''}`; }
  h.notas = notas; atualizaHero(); acendeFaixa(notas);
  if (som.estilo === 'strum') {
    const gap = [.08, .045, .02][som.strum] ?? .045, vs = [];
    notas.forEach((n, i) => vs.push(...A.toca(s, [n], { dur: Infinity, t: agora + .004 + i * gap, grava: false, lembra: false })));
    rel.grava(s, notas, ac, agora); A.perf.nota(s, notas, agora); som.lastChord = { notas: notas.slice(), ac };
    seguros.set(pid, () => { tira(); vs.forEach(v => v.solta(A.ctx.currentTime)); });
  } else if (som.estilo === 'arp') {
    A.arpNotas = notas; som.lastChord = { notas: notas.slice(), ac }; A.arpTeclas = (A.arpTeclas || 0) + 1;
    if (!A.arpRep) A.arpRep = rel.repLiga({ s, u: ARP_VEL[som.arp.vel][1], fn: i => { const n = arpNota(som.arp, A.arpNotas, i, A.pad() + 1); return n == null ? null : [n]; },
      toca: (ns, t, d) => { A.toca(s, ns, { t, dur: d, grava: false, lembra: false }); A.perf.nota(s, ns, t + rel.lat + E.cfg.lat); acendeFaixa(ns); } });
    seguros.set(pid, () => { tira(); A.arpTeclas--; if (A.arpTeclas <= 0 && A.arpRep) { rel.repDesliga(A.arpRep); A.arpRep = null; A.arpTeclas = 0; } });
  } else {
    const vs = A.toca(s, notas, { ac, dur: Infinity });
    seguros.set(pid, () => { tira(); vs.forEach(v => v.solta(A.ctx.currentTime)); });
  }
}
// ---------- Laço de quadro: mostra o que soa agora (lido da fila do relógio) ----------
let ultCh = '', ultVisor = '', ultPad = -1, ultLim = 0;
function quadro() {
  requestAnimationFrame(quadro);
  const rel = A.rel, E = A.E, u = A.u, e = rel.tocando ? rel.atual() : null, agora = performance.now();
  const ch = e ? e.tb + ':' + e.passo + ':' + (e.cont || 0) : 'x';
  if (ch !== ultCh) { ultCh = ch; novoPasso(e); }
  if (A.M.reducao() < -3) ultLim = agora;
  // visor
  const P = E.padroes[e && e.passo >= 0 ? e.padrao : A.pad()], pad = e && e.passo >= 0 ? e.padrao : A.pad();
  let v;
  if (A.ctx.state !== 'running') v = 'Toque para retomar o áudio';
  else if (e && e.cont) v = 'REC ▸ ' + [4, 3, 2, 1].filter(x => x >= e.cont).join(' ');
  else {
    const pi = A.perf.info(e ? e.n : 0), t = [`P${pad + 1}` + (rel.tr.prox >= 0 ? `▸P${rel.tr.prox + 1}` : ''), `${e && e.passo >= 0 ? e.passo + 1 : 1}/${P.comprimento}`, rel.tocando ? '▸' : '■'];
    if (pi) t.push(pi.texto);
    if (rel.rec) t.push('REC'); const fx = e ? e.fx : rel.tr.fxSeg; if (fx >= 0 && FX[fx]) t.push('FX ' + FX[fx].n); if (u.fitaTecla >= 0) t.push('FITA');
    if (rel.tr.fill) t.push('FILL'); if (E.cfg.met === 'sempre' || (E.cfg.met === 'rec' && rel.rec)) t.push('MET'); if (E.cfg.rept !== 'off') t.push('REPT ' + E.cfg.rept);
    if (e && e.passo >= 0 && P.travas[E.ui.som][locDe(P, E.ui.som, e.passo, e.desloc)]) t.push('trava'); if (u.borracha) t.push('BORR');
    if (agora - ultLim < 400) t.push('LIM');
    const max = Math.floor(($('visor').clientWidth || 300) / 7); while (t.join(' · ').length > max && t.length > 3) t.splice(t.length - 2, 1);
    v = t.join(' · ');
  }
  if (v !== ultVisor) { ultVisor = v; $('visor').textContent = v; }
  // luzes
  const sup = $('sup');
  if (!sup.hidden && sup.dataset.tipo === 'pads') sup.querySelectorAll('[data-pad]').forEach(b => { const i = +b.dataset.pad; if (i < 8) b.classList.toggle('luz', agora - A.luz[8 + i] < 110); });
  document.querySelectorAll('[data-luz]').forEach(x => x.classList.toggle('luz', agora - A.luz[+x.dataset.luz] < 110));
  if (u.aba === 'tocar' && u.modo === 'perf') { const n = e ? e.n : 0; document.querySelectorAll('.fxa').forEach(b => { const k = +b.dataset.faixa; b.style.setProperty('--prog', A.perf.progresso(k, n)); const arm = A.perf.rt[k].arm; b.dataset.arm = arm ? '1' : '0'; }); }
  if (A.ferro) { A.ferro.nivel(A.M.nivel()); A.ferro.setTocando(rel.tocando && u.aba === 'tocar' && u.modo === 'tocar'); }
  if (u.gravando && u.gravando.g) { const x = $('gravT'); if (x) x.textContent = u.gravando.g.segundos.toFixed(1) + ' s'; }
}
function novoPasso(e) {
  const E = A.E, u = A.u;
  if (!e) { $('pos').textContent = `1/${A.P().comprimento}`; document.querySelectorAll('.atual').forEach(x => x.classList.remove('atual')); return; }
  if (e.cont) { $('pos').textContent = '−' + e.cont; if (A.ferro) A.ferro.batida(); return; }
  const P = E.padroes[e.padrao]; $('pos').textContent = `${e.passo + 1}/${P.comprimento}`;
  if (e.padrao !== ultPad) { ultPad = e.padrao; E.ui.pad = e.padrao; assSup = ''; pinta(); }
  for (const s in e.notasFinais) { A.pisca(+s); if (A.ferro && u.aba === 'tocar') A.ferro.nota(e.notasFinais[s][0] + (+s >= 8 ? -20 : 0), CORES[E.kit.sons[s].cor]); }
  if (e.lig) for (const s of e.lig) A.pisca(s);
  if (e.passo % 4 === 0 && A.ferro) A.ferro.batida();
  const ns = e.notasFinais[E.ui.som]; if (ns && E.ui.som < 8 && u.aba === 'tocar' && !seguros.size) acendeFaixa(ns);
  if (u.aba === 'seq') {
    document.querySelectorAll('.atual').forEach(x => x.classList.remove('atual'));
    const loc = locDe(P, E.ui.som, e.passo, e.desloc);
    if (u.seguir && u.seqVer === 'pagina' && Math.floor(loc / 16) !== u.seqPag && !u.folha) { u.seqPag = Math.floor(loc / 16); pinta(); }
    const b = document.querySelector(`[data-passo="${loc}"]`); if (b) b.classList.add('atual');
    document.querySelectorAll('[data-mini]').forEach(m => { const s = +m.dataset.mini, l = locDe(P, s, e.passo, e.desloc), k = m.children[l % 16]; if (k && Math.floor(l / 16) === +m.dataset.pag) k.classList.add('atual'); });
  }
}
