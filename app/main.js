// Arranque: estado + áudio, casca da interface e service worker.
import { A, boot } from './nucleo.js';
import { montaCasca } from './ui.js';

window.B16 = A; // gancho para os testes automáticos
boot().then(() => { montaCasca(); document.documentElement.dataset.pronto = '1'; });

if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('semsw')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const avisa = w => { const b = document.getElementById('atualiza'); b.hidden = false; b.onclick = () => w.postMessage('pular'); };
    if (reg.waiting && navigator.serviceWorker.controller) avisa(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) avisa(w); }); });
  }).catch(() => { });
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (recarregou || !document.getElementById('atualiza') || document.getElementById('atualiza').hidden) return; recarregou = true; location.reload(); });
}
