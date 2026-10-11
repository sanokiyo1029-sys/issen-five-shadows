// Frame-time baseline (spec §16): in headless Edge / Chrome, plays 10 s of each boss fight with a scripted player and
// times the simulation (one 1/60 s step) and the render (renderGame) per frame. CPU-side cost only: GPU work is async.
// Usage: node tools/perf.js [folder]   (default: this game; pass a checkout of an older commit to compare builds)
'use strict';
const path = require('path');
const { serve, launch } = require('./browser');

const PROBE = `(async () => {
  game.enterGame(); const out = [], bot = (G, i) => { const d = G.B.x - G.P.x, k = G.keys; k.right = d > 165; k.left = d < -165;
    if (i % 18 === 0 && Math.abs(d) < 200) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : i % 72 === 0 ? 'kick' : 'slash', t: G.t }; };
  for (let lv = 0; lv < 5; lv++) {
    game.startFight(lv, 7); const G = game.G; G.state = 'fight'; G.hint = 0; G.rdt = 1 / 60;
    for (let i = 0; i < 60; i++) game.renderGame(); // warm-up
    const ren = [], step = game.stepGame || game.updGame; let sim = 0; // the browser's clock is coarse (0.1 ms): the simulation is timed in batches
    for (let i = 0; i < 600; i++) { bot(G, i); const a = performance.now(); for (let k = 0; k < 10; k++) step(1 / 600); const b = performance.now(); game.renderGame(); ren.push(performance.now() - b); sim += (b - a) / 10; }
    const mean = v => v.reduce((x, y) => x + y, 0) / v.length, p95 = v => v.sort((x, y) => x - y)[Math.floor(v.length * .95)];
    out.push({ boss: game.BOSSES[lv].id, sim: sim / 600, render: mean(ren), render95: p95(ren) });
  }
  return out; })()`;

(async () => {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..')), server = await serve(root), br = await launch();
  await br.page(`http://127.0.0.1:${server.port}/index.html?debug`, "window.game && document.getElementById('playLbl').textContent === 'Play'");
  const rows = await br.eval(PROBE);
  await br.close(); server.close();
  console.log(`${root}\nboss        sim ms/step   render ms (mean / p95)`);
  for (const r of rows) console.log(`${r.boss.padEnd(11)} ${r.sim.toFixed(4).padStart(9)}   ${r.render.toFixed(2).padStart(6)} / ${r.render95.toFixed(2)}`);
})();
