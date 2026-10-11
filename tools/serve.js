// One-command local play on a PC (spec §15): serves this folder on http://localhost:<port>. localhost is a secure context,
// so the service worker and "Install the app" work, and the save lives in that origin's storage. No dependencies.
// Usage: node tools/serve.js [port]      (default 8779; Ctrl+C stops it)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), port = +process.argv[2] || 8779;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.apk': 'application/vnd.android.package-archive', '.md': 'text/markdown; charset=utf-8' };
http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('not found'); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(f).pipe(r);
}).listen(port, '127.0.0.1', () => console.log(`Issen is at http://localhost:${port}/  (Ctrl+C to stop)`));
