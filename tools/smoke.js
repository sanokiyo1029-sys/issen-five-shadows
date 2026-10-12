// End-to-end smoke test in a real browser (spec §17.2 #1, #14): headless Edge / Chrome boots the page, skips the film, walks the
// map, a story card, a region, a ladder duel to its result, a boss fight through the absorption ceremony, every character-screen
// tab, both settings tabs, the Pose Lab and the film, and fails on any console error or uncaught exception.
// Usage: node tools/smoke.js        (exit code 1 on errors)
'use strict';
const path = require('path');
const { serve, launch } = require('./browser');

const FLOW = `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), G = game.G, steps = [];
  const frames = (n, bot) => { for (let i = 0; i < n; i++) { if (bot) bot(i); game.stepGame(1 / 60); G.rdt = 1 / 60; game.renderGame(); } };
  const bot = i => { const d = G.B.x - G.P.x; G.keys.right = d > 165; G.keys.left = d < -165; if (i % 18 === 0 && Math.abs(d) < 200) G.buf = { a: 'slash', t: G.t }; };
  document.getElementById('toGame').click(); await wait(300); steps.push('map: ' + game.mode);
  game.openRegion(0); await wait(100); steps.push('story card: ' + !document.getElementById('notice').classList.contains('off'));
  document.getElementById('nBtns').firstChild.click(); await wait(100); steps.push('region: ' + !document.getElementById('region').classList.contains('off'));
  document.getElementById('gNodes').firstChild.click(); await wait(100); frames(200, bot); G.B.hp = 0; frames(240);
  steps.push('duel result: ' + !document.getElementById('result').classList.contains('off') + ' (' + document.getElementById('rRewards').textContent.slice(0, 40) + ')');
  for (const tab of ['attrs', 'powers', 'loadout', 'gear', 'save']) { game.CH.tab = tab; game.openChar(tab === 'save' ? 'export' : null, 'menu'); frames(1); } steps.push('character tabs');
  game.openSettings('menu', 'game'); game.openSettings('menu', 'keys'); document.getElementById('sClose').click(); steps.push('settings');
  game.startFight(0, 3); frames(150, bot); G.B.hp = 0; frames(260); G.B.hp = 0; frames(300); frames(400);
  steps.push('boss: ' + G.state + (G.state === 'absorb' ? ' (ceremony)' : ''));
  if (G.state === 'absorb') { game.absorbDone(); } steps.push('after ceremony: ' + !document.getElementById('result').classList.contains('off'));
  window.issenApp.back(); steps.push('Back from the result: ' + game.mode);
  if (window.poseLab) { poseLab.openLab('g_dragon'); for (let i = 0; i < 30; i++) G.lab(1 / 60); poseLab.closeLab(); steps.push('pose lab'); }
  game.toHome(); document.getElementById('hFilm').click(); film.seek(30); film.render(30); steps.push('film');
  return steps; })()`;

(async () => {
  const srv = await serve(path.join(__dirname, '..')), br = await launch();
  await br.send('Runtime.enable'); await br.send('Log.enable');
  await br.page(`http://127.0.0.1:${srv.port}/index.html?debug`, "window.game && window.poseLab && document.getElementById('playLbl').textContent === 'Play'");
  const steps = await br.eval(FLOW);
  await new Promise(r => setTimeout(r, 500));
  const errs = br.events.filter(e => e.method === 'Runtime.exceptionThrown' || e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' || e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map(e => e.method === 'Runtime.exceptionThrown' ? e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text
      : e.method === 'Log.entryAdded' ? e.params.entry.text : e.params.args.map(a => a.value ?? a.description).join(' '))
    .filter(t => !/navigator\.vibrate/.test(t)); // Chrome's "vibrate before a user tap" intervention: expected in an automated run
  await br.close(); srv.close();
  console.log((steps || []).map(s => '  ' + s).join('\n'));
  console.log(errs.length ? `\n${errs.length} console error(s):\n` + errs.map(e => '  ' + String(e).split('\n')[0]).join('\n') : '\nno console errors');
  process.exit(errs.length || !steps ? 1 : 0);
})();
