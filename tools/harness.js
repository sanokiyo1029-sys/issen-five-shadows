// Loads the game script from index.html into a Node vm with a stub DOM and a no-op canvas, so game logic
// (fights, saves, progression) can be tested headlessly and deterministically. No dependencies.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

const noop = () => {};
const classList = () => { const s = new Set(); return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c),
  toggle(c, f) { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; } }; };

// a 2D context that accepts every call; only the few calls whose results the game reads return real values
function ctx2d(canvas) {
  const t = { canvas, measureText: s => ({ width: String(s).length * 10 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) };
  return new Proxy(t, { get: (o, k) => k in o ? o[k] : typeof k === 'string' && k.startsWith('create') ? () => ({ addColorStop: noop }) : noop,
    set: (o, k, v) => (o[k] = v, true) });
}

function element(tag = 'div', id = '') {
  const e = { tagName: tag.toUpperCase(), id, style: {}, dataset: {}, classList: classList(), children: [], attrs: {}, textContent: '', value: '',
    disabled: false, hidden: false, offsetWidth: 100, width: 300, height: 150, _html: '',
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    get firstChild() { return this.children[0] || null; },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener: noop, removeEventListener: noop, focus: noop, blur: noop, select: noop, setPointerCapture: noop, insertAdjacentHTML: noop,
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); }, remove: noop,
    click() { this.onclick && this.onclick({ preventDefault: noop }); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), querySelectorAll: () => [] };
  if (tag === 'canvas') { let c; e.getContext = () => c || (c = ctx2d(e)); }
  return e;
}

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, dump: () => Object.fromEntries(m) };
}

// mulberry32: seeded stand-in for Math.random so fights are reproducible
const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/** Boot the game. Returns { win, game, storage }. `storage` lets a test "restart the app" with the same saved data. */
async function boot({ storage = memoryStorage(), seed = 1, search = '' } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const els = new Map(), byId = id => els.get(id) || (els.set(id, element(id === 'film' ? 'canvas' : 'div', id)), els.get(id));
  const timeout = (f, ms) => { const t = setTimeout(f, ms); t.unref && t.unref(); return t; };
  const win = {
    console, URLSearchParams, Promise, setTimeout: timeout, clearTimeout, setInterval: noop, clearInterval: noop, performance: { now: () => 0 },
    ISSEN_DEBUG: true, isSecureContext: false, location: { search, href: 'file:///index.html' + search },
    localStorage: storage, navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0, vibrate: noop },
    matchMedia: () => ({ matches: false, addEventListener: noop }), requestAnimationFrame: noop, addEventListener: noop, confirm: () => true,
    CanvasRenderingContext2D: class { drawImage() {} },
    document: { getElementById: byId, createElement: element, querySelectorAll: () => [], addEventListener: noop, hidden: false,
      body: element('body'), documentElement: element('html'), fonts: { load: () => Promise.resolve([]) } },
  };
  win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  vm.runInContext(`Math.random=(${seeded})(${seed | 0});`, ctx);
  vm.runInContext(src, ctx, { filename: 'index.html' });
  await new Promise(r => setImmediate(r)); // the boot IIFE awaits fonts, then builds the ink layers
  if (!win.game) throw new Error('game hooks missing (boot failed?)');
  return { win, game: win.game, storage, el: byId };
}

/** Advance a fight by `sec` seconds in fixed 1/60 steps; `input(G, i)` may set G.keys / G.buf each step. */
function run(game, sec, input) {
  const G = game.G;
  for (let i = 0; i < Math.round(sec * 60); i++) { if (input) input(G, i); G.rdt = 1 / 60; G.rt += 1 / 60; game.updGame(1 / 60); if (G.state === 'over') break; }
  return G;
}

module.exports = { boot, run, memoryStorage, seeded, ROOT };
