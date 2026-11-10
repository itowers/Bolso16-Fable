// Ajudantes de DOM e componentes. Só estrutura e classes: todo valor visual vem dos tokens em styles.css.
export function el(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(9)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(f));
  return e;
}
const P = {
  rec: '<circle cx="12" cy="12" r="6.5"/>', play: '<path d="M8 5.5v13l11-6.5z"/>', stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  esq: '<path d="M14.5 5.5 8 12l6.5 6.5"/>', dir: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>', baixo: '<path d="M6 9.5l6 6 6-6"/>',
  seta: '<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>', ponto: '<circle cx="12" cy="12" r="4"/>', fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  tocar: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  seq: '<path d="M4 7h3M10 7h3M16 7h4M4 12h6M13 12h3M4 17h2M9 17h6M18 17h2"/>', som: '<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>', bib: '<path d="M5 4v16M10 4v16M14.5 5l4.5 14.5"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
};
export function ic(nome, rot = 0) {
  const s = el('span', { class: 'ic', 'aria-hidden': 'true' });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${rot ? ` style="transform:rotate(${rot}deg)"` : ''}>${P[nome] || ''}</svg>`;
  return s;
}
export const bt = (txt, fn, o = {}) => el('button', { type: 'button', class: 'bt ' + (o.class || ''), onclick: fn, 'aria-pressed': o.on == null ? null : String(!!o.on), 'aria-label': o.label, disabled: o.off, 'data-id': o.id }, txt);
// Controle segmentado. ops: [[valor, rótulo]]. Mais de 7 opções viram grade de 4 colunas.
export function seg(rotulo, ops, atual, fn, o = {}) {
  const g = el('div', { class: 'seg' + (ops.length > 7 ? ' g4' : ''), role: 'group', 'aria-label': rotulo, 'data-id': o.id },
    ops.map(([v, t]) => el('button', { type: 'button', 'aria-pressed': String(v === atual), onclick: () => fn(v), 'data-v': String(v) }, t)));
  if (ops.length >= 6) g.classList.add('g7');
  return o.semRotulo ? g : ops.length >= 6 ? el('div', { class: 'lnc' }, el('span', { class: 'rt', text: rotulo }), g) : linha(rotulo, g);
}
export const linha = (rotulo, ...c) => el('div', { class: 'ln' }, rotulo ? el('span', { class: 'rt', text: rotulo }) : null, ...c);
export function passos(rotulo, txt, menos, mais, o = {}) {
  return linha(rotulo, el('div', { class: 'stp', 'data-id': o.id },
    el('button', { type: 'button', 'aria-label': rotulo + ' menos', onclick: menos }, o.setas ? ic('esq') : '−'),
    o.meio ? o.meio : el('span', { class: 'val', text: txt }),
    el('button', { type: 'button', 'aria-label': rotulo + ' mais', onclick: mais }, o.setas ? ic('dir') : '+')));
}
// Barra deslizante. fn(v, final) – enquanto arrasta não repinta a tela.
export function barra(rotulo, min, max, passo, v, fmt, fn, o = {}) {
  const val = el('span', { class: 'val', text: fmt(v) });
  const inp = el('input', { type: 'range', min, max, step: passo, value: v, 'aria-label': rotulo, 'data-id': o.id,
    oninput: e => { const x = +e.target.value; val.textContent = fmt(x); fn(x, false); }, onchange: e => fn(+e.target.value, true) });
  return el('div', { class: 'ln br' }, el('span', { class: 'rt', text: rotulo }), inp, val);
}
export const chave = (rotulo, on, fn, o = {}) => linha(rotulo, el('button', { type: 'button', class: 'chv', role: 'switch', 'aria-checked': String(!!on), 'aria-label': rotulo, onclick: () => fn(!on), 'data-id': o.id }, el('i')));
export const titulo = t => el('h2', { class: 'tit', text: t });
export const cartao = (...c) => el('section', { class: 'card' }, ...c);
// Confirmação em dois toques (2,5 s)
const pend = new Map();
export function confirma(chave, fn, repinta) {
  if (pend.has(chave)) { clearTimeout(pend.get(chave)); pend.delete(chave); fn(); return; }
  pend.set(chave, setTimeout(() => { pend.delete(chave); repinta(); }, 2500)); repinta();
}
export const confirmando = chave => pend.has(chave);
