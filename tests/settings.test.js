// M8 (spec §5.4, §5.5, §5.8, §13): settings that persist and apply live (shake, flashes, vibration, quality, Guard Assist,
// touch size and hand, key bindings), whiff punish, impact feedback, font coverage, and no per-frame allocations.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { boot, run, memoryStorage, ROOT } = require('../tools/harness');

const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const SUBSET = '一五光勝参城墨壱始守寺将山師弐怒敗斬時月林止湖焼白竹終討跳蹴軍郎野鉄閃霞鬼鷺'; // fonts/yuji-boku.woff2 (docs/audit.md, item i)
async function duel(lv = 0, xs = [-100, 100], settings = {}) {
  const b = await boot(), { game } = b, G = game.G;
  Object.assign(game.SV.settings, settings); game.applySettings(); game.startFight(lv, 1); G.state = 'fight'; G.P.x = xs[0]; G.B.x = xs[1]; passive(G);
  return Object.assign(b, { G, P: G.P, B: G.B });
}

module.exports = {
  async 'settings have defaults, are validated, persist and apply live'() {
    const st = memoryStorage(), { game, win } = await boot({ storage: st });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(game.SV.settings)), { volume: 1, music: .8, sfx: 1, shake: 'full', flash: 'full', haptics: true, quality: 'high', assist: false, scale: 1, sens: 1, lefty: false, lang: 'en', opacity: 1, captions: false, fps: 60, keys: {} });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(game.cleanSettings({ volume: 7, shake: 'wild', haptics: 0, scale: 'big', lefty: 'yes', keys: { KeyY: 'slash', '<b>': 'kick', KeyQ: 'fly' } }))),
      { volume: 1, music: .8, sfx: 1, shake: 'full', flash: 'full', haptics: true, quality: 'high', assist: false, scale: 1, sens: 1, lefty: false, lang: 'en', opacity: 1, captions: false, fps: 60, keys: { KeyY: 'slash' } });
    Object.assign(game.SV.settings, { volume: .4, lefty: true, scale: 1.2, shake: 'off' }); game.writeSave(game.SV); game.applySettings();
    assert.ok(win.document.body.classList.contains('lefty')); assert.strictEqual(win.document.documentElement.style['--k'], 1.2);
    const again = (await boot({ storage: st })).game.SV.settings; assert.strictEqual(again.volume, .4); assert.strictEqual(again.shake, 'off');
  },

  async 'Reduce Shake: off means a still camera; haptics off means no vibration; Low quality draws no trails'() {
    let { game, G, P, B, win } = await duel(0, [-100, 100], { shake: 'off' });
    G.shake = 30; G.rdt = 1 / 60; game.renderGame(); near(game.lab.CAM.x, G.cam.x, 'no shake offset'); near(game.lab.CAM.y, G.cam.y, 'no shake offset (y)');
    let buzz = 0; ({ game, G, P, B, win } = await duel(0, [-100, 100], { haptics: false })); win.navigator.vibrate = () => { buzz++; };
    game.startMove(B, 'g_thrust'); run(game, .6, passive); assert.ok(P.hp < P.maxHp); assert.strictEqual(buzz, 0, 'no vibration');
    ({ game, G, P } = await duel(0, [-100, 100], { quality: 'low' })); G.buf = { a: 'slash', t: G.t };
    for (let i = 0; i < 20; i++) { game.updGame(1 / 60); game.renderGame(); } assert.ok(!P.trail, 'no swing trail on Low');
  },

  async 'Guard Assist: an idle hero raises the guard against mid and high, never low, never while attacking; off by default'() {
    let { game, G, P, B } = await duel(0, [-100, 100]); game.startMove(B, 'g_thrust'); run(game, .6, passive); assert.ok(P.hp < P.maxHp, 'off by default');
    ({ game, G, P, B } = await duel(0, [-100, 100], { assist: true })); game.startMove(B, 'g_thrust'); run(game, .6, passive); assert.strictEqual(P.hp, P.maxHp, 'mid: guarded');
    ({ game, G, P, B } = await duel(0, [-100, 100], { assist: true })); game.startMove(B, 'g_low'); run(game, .6, passive); assert.ok(P.hp < P.maxHp, 'low: not guarded');
    ({ game, G, P, B } = await duel(0, [-100, 100], { assist: true })); game.startMove(B, 'g_thrust'); run(game, .1, passive);
    run(game, .6, (G, i) => { passive(G); if (i === 0) G.buf = { a: 'kick', t: G.t }; }); assert.ok(P.hp < P.maxHp, 'attacking (a kick that falls short): not guarded');
  },

  async 'whiff punish: a hit into the foe\'s recovery deals 20% more and pays 4 ink; a hit into its windup does not'() {
    let { game, G, P, B } = await duel(0, [-70, 70]); game.startMove(B, 'g_spin'); G.keys.down = true; run(game, .52, passive); // duck the high spin
    G.keys.down = false; G.buf = { a: 'slash', t: G.t }; run(game, .25, passive); near(B.maxHp - B.hp, 7 * 1.2, 'a hit into the spin recovery is punished'); near(P.ink, 9 + 4, 'and pays ink');
    ({ game, G, P, B } = await duel(0, [-70, 70])); game.startMove(B, 'g_dragon'); G.buf = { a: 'slash', t: G.t }; run(game, .25, passive);
    near(B.maxHp - B.hp, 7, 'a hit into a windup is not');
  },

  async 'key bindings: the Keyboard tab rebinds an action, saves it, and the new key plays'() {
    const st = memoryStorage(), { game, el } = await boot({ storage: st }); game.enterGame(); game.openSettings('menu', 'keys');
    const rows = el('sBody').children; // label, control, spacer per action
    const slashRow = [...rows].findIndex(x => x.textContent === 'slash'); rows[slashRow + 1].children[0].click();
    assert.ok(game.KEYCAP, 'waiting for a key'); game.gameKey({ code: 'KeyY', repeat: false, preventDefault() {} }, true);
    assert.strictEqual(game.KMAP.KeyY, 'slash'); assert.strictEqual(game.SV.settings.keys.KeyY, 'slash');
    assert.strictEqual((await boot({ storage: st })).game.KMAP.KeyY, 'slash', 'kept after a restart');
    game.startFight(0, 1); game.G.state = 'fight'; game.gameKey({ code: 'KeyY', repeat: false, preventDefault() {} }, true); assert.strictEqual(game.G.buf.a, 'slash');
  },

  async 'every kanji the game shows is in the Yuji Boku subset (no silent serif fallback)'() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), used = new Set(html.match(/[㐀-鿿]/g));
    const missing = [...used].filter(c => !SUBSET.includes(c));
    assert.deepStrictEqual(missing, [], 'kanji missing from fonts/yuji-boku.woff2: ' + missing.join(''));
  },

  async 'heavy hits punch the camera (then it settles); the fight loop updates effects and projectiles in place'() {
    const { game, G, P, B } = await duel(0, [-100, 100]); const fx = G.fx, proj = G.proj;
    game.startMove(B, 'g_spin'); run(game, .6, passive); assert.ok(G.punch >= .02, 'a knockdown punches in');
    for (let i = 0; i < 90; i++) { G.rdt = 1 / 60; game.renderGame(); } assert.ok(G.punch < .002, 'and settles');
    run(game, 3, passive); assert.strictEqual(G.fx, fx); assert.strictEqual(G.proj, proj);
  },
};
