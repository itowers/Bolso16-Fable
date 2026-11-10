// Servidor estático mínimo para os testes (sem dependências).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
export function servir(porta = 0) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(raiz, p);
      if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('404'); return; }
      rsp.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(porta, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) servir(8016).then(x => console.log(x.url));
