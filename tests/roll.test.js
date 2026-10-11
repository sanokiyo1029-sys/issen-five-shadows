// Dodge roll (M2, spec §5.3): 0.34 s, ~240 px, invulnerable 0.05-0.22 s, 0.7 s cooldown from its start, only from free
// states, cannot pass the opponent, no attacking out of it; mistimed rolls are punished and spamming it is not a shield.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { boot, run, ROOT } = require('../tools/harness');

const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
async function duel(lv, d) {
  const { game } = await boot(), G = game.G;
  game.enterGame(); game.startFight(lv, 1); G.state = 'fight'; G.st = 0;
  G.P.x = -d / 2; G.B.x = d / 2;
  run(game, 1 / 60, passive);
  return { game, G };
}
const roll = (G, dir = 0) => { G.keys.left = dir < 0; G.keys.right = dir > 0; G.buf = { a: 'roll', t: G.t }; };

module.exports = {
  async 'a roll travels ~240 px in 0.34 s (away by default, toward a held direction) and ends facing the opponent'() {
    for (const [dir, want] of [[0, -240], [-1, -240], [1, 240]]) {
      const { game, G } = await duel(0, 1200), x0 = G.P.x;
      roll(G, dir); let ticks = 0;
      run(game, 1, (G, i) => { passive(G); if (i > 0) G.keys.left = G.keys.right = false; if (G.P.st === 'roll') ticks++; });
      assert.ok(Math.abs(G.P.x - x0 - want) < 6, `dir ${dir}: moved ${G.P.x - x0}`);
      assert.ok(Math.abs(ticks / 60 - game.MOVE.roll.dur) < 2 / 60, `lasted ${ticks / 60} s`);
      assert.strictEqual(G.P.st, 'idle'); assert.strictEqual(G.P.f, Math.sign(G.B.x - G.P.x));
    }
  },

  async 'the cooldown runs 0.7 s from the start of a roll'() {
    const { game, G } = await duel(0, 1200);
    let starts = 0, prev = '';
    run(game, 2.05, (G, i) => { passive(G); G.buf = { a: 'roll', t: G.t }; if (G.P.st === 'roll' && prev !== 'roll') starts++; prev = G.P.st; });
    assert.strictEqual(starts, 3, 'rolls at 0, 0.7 and 1.4 s'); // pressed every frame for 2.05 s
  },

  async 'a roll cannot pass through the opponent'() {
    const { game, G } = await duel(0, 160);
    roll(G, 1); run(game, .5, passive);
    assert.ok(G.B.x - G.P.x >= 58 * (1 + 1.1) / 2 - .5, `hero ${G.P.x} stayed in front of boss ${G.B.x}`);
  },

  async 'well-timed: the invulnerable window carries the hero through a thrust; mistimed: hit while rising'() {
    for (const [at, hp] of [[12, 100], [0, 91]]) { // g_thrust's window overlaps ticks 16-21; i-frames run 0.05-0.22 s into the roll
      const { game, G } = await duel(0, 200);
      game.startMove(G.B, 'g_thrust');
      run(game, 1.2, (G, i) => { passive(G); if (i === at) roll(G, 1); if (i > at) G.keys.right = false; });
      assert.strictEqual(G.P.hp, hp, `roll at tick ${at} of the thrust`);
    }
  },

  async 'no roll from the air or out of an attack, and no attacking out of a roll'() {
    let { game, G } = await duel(0, 1200);
    G.jb = G.t; run(game, .1, passive); assert.strictEqual(G.P.st, 'jump');
    roll(G); run(game, .05, passive); assert.strictEqual(G.P.st, 'jump', 'airborne: no roll');
    ({ game, G } = await duel(0, 1200));
    G.buf = { a: 'slash', t: G.t }; run(game, .05, passive); assert.strictEqual(G.P.st, 'move');
    roll(G); run(game, .05, passive); assert.strictEqual(G.P.st, 'move', 'attacking: no roll');
    ({ game, G } = await duel(0, 1200));
    roll(G); run(game, .1, passive); G.buf = { a: 'slash', t: G.t };
    run(game, .3, passive); assert.notStrictEqual(G.P.st, 'move', 'a slash pressed mid-roll is dropped');
  },

  async 'spamming the roll is not a shield: under 30 % of the time invulnerable, and Kasumi still lands hits'() {
    const { game, G } = await duel(1, 300);
    G.B.ai.t = .5; // duel() left the boss passive; here Kasumi fights
    let inv = 0, n = 0;
    run(game, 20, G => { G.buf = { a: 'roll', t: G.t }; G.keys.left = G.keys.right = false; if (G.state === 'fight') { n++; if (game.rollInv(G.P)) inv++; } });
    assert.ok(inv / n < .3, `invulnerable ${(inv / n * 100).toFixed(1)} % of the time`);
    assert.ok(G.P.hp < G.P.maxHp || G.P.wins + G.B.wins > 0, 'the hero was hit while spamming');
  },

  async 'touch buttons are at least 48 dp with 8 dp gaps at 800x360'() {
    const css = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), u = Math.min(1.3, Math.max(.72, .0027 * 360)), btn = {};
    for (const m of css.matchAll(/\.tb\[data-a=(\w+)\]\{width:calc\((\d+)\*var\(--u\)\);height:calc\(\d+\*var\(--u\)\);right:calc\((\d+)\*var\(--u\)[^;]*;bottom:calc\((\d+)\*var\(--u\)/g))
      btn[m[1]] = { r: +m[2] / 2 * u, cx: 800 - (+m[3] + +m[2] / 2) * u, cy: 360 - (+m[4] + +m[2] / 2) * u };
    assert.deepStrictEqual(Object.keys(btn).sort(), ['block', 'ink', 'issen', 'jump', 'kick', 'power1', 'roll', 'slash']);
    const ks = Object.keys(btn);
    for (const k of ks) assert.ok(btn[k].r * 2 >= 48, `${k} is ${btn[k].r * 2} px`);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = btn[ks[i]], b = btn[ks[j]], gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r;
      assert.ok(gap >= 8, `${ks[i]} / ${ks[j]} gap ${gap.toFixed(1)} px`);
    }
  },
};
