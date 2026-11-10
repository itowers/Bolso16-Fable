// Service worker: cache versionado, app inteiro offline depois da primeira visita.
const VERSAO = 'bolso16-v1';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icone-180.png', 'icons/icone-192.png', 'icons/icone-512.png',
  'app/main.js', 'app/nucleo.js', 'app/ui.js', 'app/telas.js', 'app/dom.js', 'app/dados.js', 'app/teoria.js', 'app/motor.js', 'app/relogio.js', 'app/perf.js', 'app/amostras.js', 'app/banco.js', 'app/shader.js', 'app/fita-worklet.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'pular') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(resp => {
    if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); } return resp;
  }).catch(() => caches.match('index.html'))));
});
