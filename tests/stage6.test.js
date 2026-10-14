// v2 brief, stage 6 (the page's part of Android delivery): touch-button opacity, sound captions, a 30 fps option and adaptive
// quality that recovers, all saved with the settings and safe for older saves. (MainActivity's navigation guard is Java: it is
// checked by the build, and on a device per docs/test-report.md.)
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

module.exports = {
  async 'the new settings: clamped, saved, defaulted for older saves, and shown on the settings screen'() {
    const st = memoryStorage(), { game, el } = await boot({ storage: st }), c = game.cleanSettings({ opacity: 0, captions: 'yes', fps: 24 });
    assert.strictEqual(c.opacity, .3); assert.strictEqual(c.captions, false); assert.strictEqual(c.fps, 60);
    const d = game.cleanSettings({}); assert.deepStrictEqual([d.opacity, d.captions, d.fps], [1, false, 60], 'a save from before: the old behaviour');
    Object.assign(game.SV.settings, { opacity: .55, captions: true, fps: 30 }); game.writeSave(game.SV); game.applySettings(); assert.strictEqual(el('touch').style.opacity, .55);
    const r = (await boot({ storage: st })).game.SV.settings; assert.deepStrictEqual([r.opacity, r.captions, r.fps], [.55, true, 30]);
    game.openSettings('home', 'game'); const rows = el('sBody').children.map(x => x.textContent); for (const t of ['Touch button opacity', 'Sound captions', 'Frame rate']) assert.ok(rows.includes(t), t);
  },

  async 'sound captions: a cue that carries meaning is written on screen while captions are on'() {
    const { game } = await boot(); game.enterGame(); game.startFight(1, 1); const G = game.G; G.state = 'fight'; G.P.x = -300; G.B.x = 300;
    game.startMove(G.B, 'k_vanish'); run(game, .3); assert.strictEqual(game.CAPQ.length, 0, 'off by default');
    game.SV.settings.captions = true; game.startFight(1, 2); const H = game.G; H.state = 'fight'; game.startMove(H.B, 'k_vanish'); run(game, .3);
    assert.ok(game.CAPQ.some(x => /heavy blow is coming/.test(x.t)), 'the tell is captioned'); H.rdt = 1 / 60; game.renderGame(); assert.ok(game.CAPQ.length <= 3);
  },

  async '30 fps draws every other frame; 60 fps every frame'() {
    for (const [fps, want] of [[60, 8], [30, 4]]) {
      const { game } = await boot(); game.SV.settings.fps = fps; game.enterGame(); const G = game.G; let n = 0, rt = G.rt;
      for (let i = 1; i <= 8; i++) { game.frame(1000 + i * 1000 / 60); if (G.rt !== rt) { n++; rt = G.rt; } }
      assert.ok(Math.abs(n - want) <= 1, `${fps} fps: ${n} of 8 frames drawn`);
    }
  },

  async 'adaptive quality lowers the render scale under load and recovers it once frames are calm again'() {
    const { game } = await boot(), top = game.QS; for (let i = 0; i < 120; i++) game.adapt(.04); const low = game.QS; assert.ok(low < top, 'lowered');
    for (let i = 0; i < 60 * 9; i++) game.adapt(1 / 60); assert.ok(game.QS > low, 'recovering (three calm windows)'); for (let i = 0; i < 60 * 40; i++) game.adapt(1 / 60); assert.strictEqual(game.QS, game.RS, 'back to the device scale');
    game.SV.settings.fps = 30; const q = game.QS; for (let i = 0; i < 120; i++) game.adapt(1 / 30); assert.strictEqual(game.QS, q, 'at 30 fps a 33 ms frame is not slow');
  },
};
