// Headless Edge / Chrome driven over the DevTools protocol (Node's built-in fetch and WebSocket), plus a tiny static
// server for a folder. Used by tools/capture.js and tools/perf.js. No dependencies.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const BROWSERS = [process.env.CHROME, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const findBrowser = () => BROWSERS.find(b => fs.existsSync(b));

/** Serve `root` on 127.0.0.1; resolves to { port, close }. */
async function serve(root) {
  root = path.resolve(root); // the path guard below compares resolved paths
  const server = http.createServer((q, r) => {
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, close: () => server.close() };
}

/** Launch a headless browser at 1920x1080; resolves to { send(method, params), page(url, readyExpr), eval(expr), close() }. */
async function launch() {
  const exe = findBrowser(); if (!exe) throw new Error('no Edge or Chrome found (set CHROME=<path>)');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'issen-browser-'));
  const proc = spawn(exe, ['--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank']);
  const wsUrl = await new Promise((res, rej) => { let err = ''; proc.stderr.on('data', d => { err += d; const m = err.match(/ws:\/\/[^\s]+/); if (m) res(m[0]); }); setTimeout(() => rej(new Error('browser did not start')), 20000); });
  const target = (await (await fetch(`http://${new URL(wsUrl).host}/json/list`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl), pend = new Map(); let n = 0;
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m.result || {}); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { pend.set(++n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  return {
    send, eval: evaluate,
    async page(url, ready, timeout = 20000) { // navigate, then wait until `ready` (a JS expression) is truthy
      await send('Page.navigate', { url });
      for (const t0 = Date.now(); Date.now() - t0 < timeout;) { if (await evaluate(ready)) return true; await new Promise(r => setTimeout(r, 100)); }
      throw new Error('page not ready: ' + url);
    },
    async close() { await Promise.race([send('Browser.close'), new Promise(r => setTimeout(r, 2000))]); proc.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} },
  };
}

module.exports = { serve, launch, findBrowser };
