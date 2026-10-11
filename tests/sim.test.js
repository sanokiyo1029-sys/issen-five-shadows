// Fixed 1/60 s step and the fight's seeded RNG (M2, spec §16 / D8b): fights are decided by (seed, inputs) alone,
// a recorded replay reproduces a fight exactly, and the fixed step keeps the feel of the old variable-step loop.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const bot = (G, i) => {
  const d = G.B.x - G.P.x, k = G.keys;
  k.right = d > 165; k.left = d < -165;
  if (i % 18 === 0 && Math.abs(d) < 200) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : i % 72 === 0 ? 'kick' : 'slash', t: G.t };
};
const end = G => JSON.parse(JSON.stringify({ state: G.state, t: G.t, round: G.round,
  P: [G.P.hp, G.P.x, G.P.ink, G.P.wins], B: [G.B.hp, G.B.x, G.B.ink, G.B.wins] }));

// the boss stands still and never blocks, so a scripted hero can be compared across loops
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };

module.exports = {
  async 'the fight seed alone decides the fight (Math.random is not used by the simulation)'() {
    const a = await boot({ seed: 1 }), b = await boot({ seed: 99 });
    for (const { game } of [a, b]) { game.enterGame(); game.startFight(3, 1234); run(game, 400, bot); }
    assert.deepStrictEqual(end(a.game.G), end(b.game.G));
    assert.strictEqual(a.game.G.seed, 1234);
  },

  async 'a replay {seed, boss, inputs per tick} reproduces the fight exactly'() {
    const rec = await boot({ seed: 5 }), ticks = [];
    rec.game.enterGame(); rec.game.startFight(1, 777);
    run(rec.game, 400, (G, i) => {
      bot(G, i);
      ticks.push({ keys: Object.assign({}, G.keys), a: G.buf && G.buf.t === G.t ? G.buf.a : null, j: G.jb === G.t });
    });
    const replay = JSON.parse(JSON.stringify({ seed: 777, boss: 'kasumi', inputs: ticks }));
    const { game } = await boot({ seed: 6 });
    game.enterGame(); game.startFight(game.BOSSES.findIndex(b => b.id === replay.boss), replay.seed);
    run(game, 400, (G, i) => {
      const t = replay.inputs[i]; if (!t) return;
      G.keys = Object.assign({}, t.keys); if (t.a) G.buf = { a: t.a, t: G.t }; if (t.j) G.jb = G.t;
    });
    assert.ok(ticks.length > 600, 'the recorded fight is long enough to mean something');
    assert.deepStrictEqual(end(game.G), end(rec.game.G));
  },

  async 'the fixed step keeps the feel of the old variable-step loop (30, 60 and 144 fps)'() {
    // one scripted exchange against a passive boss: walk in, 3-hit chain, kick, jump, lunge, low cut, roundhouse
    // inputs are pressed at script times and directions held around them, the way a player holds forward while pressing
    const script = [[1.7, 'slash'], [1.84, 'slash'], [2.0, 'slash'], [3.0, 'kick'], [4.0, 'jump'], [5.0, 'lunge'], [6.0, 'low'], [7.0, 'round']];
    async function play(fps, fixed) {
      const { game } = await boot({ seed: 3 }), G = game.G;
      game.enterGame(); game.startFight(0, 1); G.state = 'fight'; G.st = 0;
      let T = 0, apex = 0, air = 0, si = 0;
      const frame = 1 / fps;
      while (T < 8.2) {
        passive(G);
        const d = G.B.x - G.P.x, k = G.keys;
        k.right = (T < 1.6 && d > 150) || (T > 4.7 && T < 5.1 && d > 150) || (T > 6.95 && T < 7.1); k.down = T > 5.9 && T < 6.1;
        if (si < script.length && T >= script[si][0]) {
          const a = script[si++][1];
          if (a === 'jump') G.jb = G.t; else if (a === 'lunge' || a === 'round') G.buf = { a: a === 'lunge' ? 'slash' : 'kick', t: G.t };
          else G.buf = { a: a === 'low' ? 'slash' : a, t: G.t };
        }
        if (fixed) game.stepGame(frame); else for (let r = frame; r > 1e-6; r -= .05) game.updGame(Math.min(.05, r));
        if (G.P.y < 0) air += frame; apex = Math.min(apex, G.P.y); T += frame;
      }
      return { bossHp: G.B.hp, heroX: G.P.x, bossX: G.B.x, ink: G.P.ink, apex, air, down: G.B.st };
    }
    const ref = await play(60, true);
    assert.ok(ref.bossHp <= 100 - 7 - 8 - 11 - 7, `the chain and later hits should land in the reference run: ${JSON.stringify(ref)}`);
    for (const [fps, fixed] of [[60, false], [30, false], [144, false], [30, true], [144, true]]) {
      const r = await play(fps, fixed), tag = `${fixed ? 'fixed' : 'old'} loop at ${fps} fps: ${JSON.stringify(r)} vs ${JSON.stringify(ref)}`;
      assert.strictEqual(r.bossHp, ref.bossHp, 'same hits land, ' + tag);
      assert.strictEqual(r.ink, ref.ink, 'same ink, ' + tag);
      // input is sampled once per display frame: at 30 fps a released direction can run one extra 1/60 tick (5.7 px) — 3 releases here
      assert.ok(Math.abs(r.heroX - ref.heroX) < 20 && Math.abs(r.bossX - ref.bossX) < 20, 'positions within 20 px, ' + tag);
      // the old loop's Euler step made jumps ~5 % lower at 30 fps; the fixed step removes that drift
      const tol = fixed ? .01 : .06;
      assert.ok(Math.abs(r.apex - ref.apex) / -ref.apex < tol && Math.abs(r.air - ref.air) < 1 / 30 + 1e-9, `jump height within ${tol * 100} %, air time within 2 frames, ` + tag);
      if (process.env.VERBOSE) console.log('       ' + tag);
    }
  },
};
