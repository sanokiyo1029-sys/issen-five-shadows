// Inputs (M2, spec §5.2a / §5.4): the keyboard Block key and the gamepad feed the same G.keys / G.buf / G.jb as before.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const key = (game, code, down) => game.gameKey({ code, repeat: false, preventDefault() {} }, down);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };

/** A fight against `lv` with the boss passive, the hero at x = -d/2 and the boss at +d/2. */
async function duel(lv, d) {
  const b = await boot(), { game } = b, G = game.G;
  game.enterGame(); game.startFight(lv, 1); G.state = 'fight'; G.st = 0;
  Object.assign(G.P, { x: -d / 2 }); Object.assign(G.B, { x: d / 2 });
  return Object.assign(b, { G });
}

// a fake standard-mapping pad; `set` changes what the next poll sees
function pad(win) {
  const p = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  let list = [p];
  win.navigator.getGamepads = () => list;
  return { p, press(i, on = true) { p.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, unplug() { list = []; } };
}

module.exports = {
  async 'the Block key (H, Shift) guards in place against mid, and with down against low'() {
    for (const [code, mv, down] of [['KeyH', 'g_thrust', false], ['ShiftLeft', 'g_thrust', false], ['KeyH', 'g_low', true]]) {
      const { game, G } = await duel(0, 200);
      key(game, code, true); G.keys.down = down;
      run(game, .1, passive);
      assert.ok(game.startMove(G.B, mv), mv + ' starts');
      const x0 = G.P.x;
      let blocked = false;
      run(game, 1, G => { passive(G); if (G.P.st === 'bstun') blocked = true; });
      assert.strictEqual(G.P.hp, 100, `${code}${down ? ' + down' : ''} should block ${mv}`);
      assert.ok(blocked, 'the hero went into block-stun');
      assert.ok(Math.abs(G.P.x - x0) < 140, 'the hero held their ground (only block pushback)');
      key(game, code, false);
      assert.strictEqual(G.keys.block, false);
    }
  },

  async 'without blocking the same thrust lands (control)'() {
    const { game, G } = await duel(0, 200);
    run(game, .1, passive); game.startMove(G.B, 'g_thrust'); run(game, 1, passive);
    assert.strictEqual(G.P.hp, 91);
  },

  async 'gamepad: buttons and stick feed G.buf / G.jb / G.keys, with a dead zone'() {
    const { game, G, win } = await duel(0, 600), gp = pad(win);
    gp.press(2); game.pollPad();
    assert.strictEqual(G.buf && G.buf.a, 'slash', 'X slashes');
    G.buf = null; game.pollPad();
    assert.strictEqual(G.buf, null, 'a held button fires once, not every frame');
    gp.press(2, false); gp.press(3); game.pollPad();
    assert.strictEqual(G.buf.a, 'kick', 'Y kicks');
    gp.press(0); game.pollPad();
    assert.strictEqual(G.jb, G.t, 'A jumps');
    gp.p.axes[0] = .25; game.pollPad();
    assert.ok(!G.keys.right && !G.keys.left, 'inside the dead zone nothing moves');
    gp.p.axes[0] = .9; game.pollPad();
    assert.strictEqual(G.keys.right, true, 'stick right moves right');
    gp.p.axes[0] = 0; gp.p.axes[1] = .9; game.pollPad();
    assert.strictEqual(G.keys.right, false); assert.strictEqual(G.keys.down, true, 'stick down crouches');
    gp.p.axes[1] = 0; gp.press(4); game.pollPad();
    assert.strictEqual(G.keys.block, true, 'LB blocks');
    assert.strictEqual(game.PAD.on, true, 'hints switch to the pad');
  },

  async 'gamepad: the keyboard keeps working beside it, and unplugging releases held keys'() {
    const { game, G, win } = await duel(0, 600), gp = pad(win);
    key(game, 'KeyD', true); game.pollPad(); game.pollPad();
    assert.strictEqual(G.keys.right, true, 'an idle pad does not override a held key');
    key(game, 'KeyD', false);
    gp.press(15); game.pollPad();
    assert.strictEqual(G.keys.right, true, 'd-pad right');
    gp.unplug(); game.pollPad();
    assert.strictEqual(G.keys.right, false, 'hot-unplug releases what the pad held');
  },

  async 'gamepad: Start pauses and resumes a fight'() {
    const { game, G, win } = await duel(0, 600), gp = pad(win);
    gp.press(9); game.pollPad(); assert.strictEqual(G.paused, true);
    gp.press(9, false); game.pollPad(); gp.press(9); game.pollPad(); assert.strictEqual(G.paused, false);
  },
};
