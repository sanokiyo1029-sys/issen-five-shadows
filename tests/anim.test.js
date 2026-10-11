// Locomotion and hit-reaction pass (M2, spec §5.7 / §6.6 #13): no pops at state changes, jump phases, landing absorb,
// crouch and turn blends, hit reactions by zone and strength, knockdown bounce and get-up. All cosmetic: the simulation
// state changes exactly when it did before.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');
const { measure } = require('../tools/pops');

const LIMIT = 60; // px a joint may move in the first frame after a state change (it was 246 px before M2)
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
async function duel(lv = 0, d = 600) {
  const { game } = await boot(), G = game.G;
  game.startFight(lv, 1); G.state = 'fight'; G.st = 0; G.P.x = -d / 2; G.B.x = d / 2;
  return { game, G };
}
const hipY = (game, F) => { const p = game.poseOf(F); return (game.joints(p, F.def.kind.L).oy) * p.s; }; // larger = hips lower

module.exports = {
  async 'no pops: across five scripted fights, no joint moves more than 60 px in the first frame of a state change'() {
    const rows = await measure(), sw = rows.filter(r => r.from !== r.to), worst = sw.sort((a, b) => b.body - a.body)[0];
    assert.ok(sw.length > 500, 'enough state changes were exercised');
    assert.ok(worst.body <= LIMIT, `${worst.body.toFixed(1)} px: ${worst.who} ${worst.from} -> ${worst.to} vs ${worst.boss} @${worst.t}`);
  },

  async 'jump: push-off, rise, apex tuck and fall are distinct poses; landing is instant for play, absorbed for the eye'() {
    const { game, G } = await duel();
    G.jb = G.t; const th = [];
    run(game, 1, G => { passive(G); if (G.P.st === 'jump') th.push([G.P.vy, game.poseOf(G.P).th1]); });
    const at = vy => th.reduce((b, x) => Math.abs(x[0] - vy) < Math.abs(b[0] - vy) ? x : b)[1];
    assert.ok(at(0) > at(-600) + .4 && at(0) > at(900) + .3, `the knees tuck at the apex: rise ${at(-600).toFixed(2)}, apex ${at(0).toFixed(2)}, fall ${at(900).toFixed(2)}`);
    const g3 = await duel(); g3.G.jb = g3.G.t;
    for (let i = 0; i < 300; i++) { passive(g3.G); g3.game.updGame(1 / 60); g3.game.poseOf(g3.G.P); if (g3.G.t > .3 && !g3.G.P.air) break; }
    assert.strictEqual(g3.G.P.st, 'idle', 'the fighter is free the moment it lands');
    g3.game.updGame(1 / 60); g3.game.updGame(1 / 60); g3.game.updGame(1 / 60); g3.game.updGame(1 / 60);
    const low = hipY(g3.game, g3.G.P);
    for (let i = 0; i < 20; i++) { passive(g3.G); g3.game.updGame(1 / 60); g3.game.poseOf(g3.G.P); }
    assert.ok(low > hipY(g3.game, g3.G.P) + 5, 'the hips dip just after landing and rise again');
  },

  async 'crouch eases in over a few frames instead of snapping'() {
    const { game, G } = await duel();
    run(game, .2, passive); game.poseOf(G.P);
    const stand = hipY(game, G.P);
    G.keys.down = true; run(game, 1 / 60, passive); const f1 = hipY(game, G.P);
    run(game, .2, passive); const full = hipY(game, G.P);
    assert.ok(f1 > stand && f1 < full - 5, `first crouch frame is in between: ${stand.toFixed(1)} < ${f1.toFixed(1)} < ${full.toFixed(1)}`);
  },

  async 'a facing flip turns through a squash over ~0.07 s; the simulation flips at once'() {
    const { game, G } = await duel(0, 300);
    run(game, .2, passive); game.poseOf(G.P);
    G.B.x = G.P.x - 200; run(game, 1 / 60, passive);
    assert.strictEqual(G.P.f, -1, 'sim facing flips immediately');
    const f = [];
    for (let i = 0; i < 8; i++) { f.push(game.poseOf(G.P).f); run(game, 1 / 60, passive); }
    assert.ok(Math.abs(f[1]) < 1 && f[f.length - 1] === -1, `drawn facing ${f.map(v => v.toFixed(2)).join(' ')}`);
  },

  async 'hit reactions differ by zone (head snap / torso fold / knee buckle) and heavy hits go further'() {
    const { game, G } = await duel(0, 200), P = G.P, react = (zone, dmg) => {
      Object.assign(P, { st: 'hit', stT: 0, stun: .3, hz: zone, hk: dmg >= 10, hn: (P.hn || 0) + 1, lp: null, vk: null });
      game.poseOf(P); P.stT = .02; G.t += .2; return game.poseOf(P);
    };
    const hi = react('high', 7), mid = react('mid', 7), lo = react('low', 7), heavy = react('mid', 14);
    assert.ok(hi.hd < mid.hd - .5 && hi.hd < lo.hd - .5, 'high: the head snaps back');
    assert.ok(mid.tl > hi.tl + .5 && mid.tl > lo.tl + .2, 'mid: the torso folds');
    assert.ok(lo.th1 > hi.th1 + .4 && lo.th1 > mid.th1 + .4, 'low: the front knee buckles');
    assert.ok(heavy.tl > mid.tl + .1, 'a heavy hit folds further');
  },

  async 'knockdown: the body bounces as it lands, then rises through a kneel'() {
    const { game, G } = await duel(0, 200), P = G.P;
    Object.assign(P, { st: 'down', stT: 0, air: true, vy: -520, y: -1, vx: 0 });
    let maxLift = 0, kneel = null;
    run(game, 2, G => { passive(G); const p = game.poseOf(P);
      if (P.st === 'down' && !P.air && G.t - P.landT < .3) maxLift = Math.max(maxLift, p.lift + P.y);
      if (P.st === 'getup' && P.stT > .16 && P.stT < .2) kneel = p; });
    assert.ok(maxLift > 8, `bounce height ${maxLift.toFixed(1)} px`);
    assert.ok(kneel && Math.abs(kneel.rot) < .4 && kneel.th1 > 1, 'the get-up passes through an upright kneel');
  },
};
