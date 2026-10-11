// M5 (spec §8, §10): Miststep, Iron Resolve, Phantom Edge and Demon Sovereignty work as specified and against every boss;
// each boss's second phase starts once below half health and brings its new move; swing trails follow the blade.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
function profile(game, powers, tiers = {}) {
  const s = game.migrate(JSON.stringify({ beaten: 5 })).save; s.story.pending = [];
  for (const [id, t] of Object.entries(tiers)) s.powers[id].tier = t;
  s.loadout = { powers, echoes: [null, null] }; game.points(s); return s;
}
async function duel(powers, lv = 0, xs = [-100, 300], tiers) {
  const { game } = await boot(), G = game.G;
  game.SV = profile(game, powers, tiers); game.startFight(lv, 1); G.state = 'fight'; G.st = 0; G.P.x = xs[0]; G.B.x = xs[1]; passive(G);
  return { game, G, P: G.P, B: G.B };
}
const press = (G, a, dir = 0) => { G.keys.right = dir > 0; G.keys.left = dir < 0; G.buf = { a, t: G.t }; };
const release = G => { G.keys.right = G.keys.left = false; };

module.exports = {
  async 'Miststep: retreats 380 px or passes behind the foe, safe 0.04-0.28 s; its afterimage bursts; tier III pays ink for a slipped attack'() {
    let { game, G, P } = await duel(['miststep', null]);
    P.ink = 40; press(G, 'power1'); const inv = [];
    run(game, .45, (G, i) => { passive(G); if (i > 0) release(G); if (P.st === 'move') inv.push([P.mvT, game.invul(P)]); });
    near(P.x, -100 - 380, 'neutral retreats 380 px', 1); near(P.ink, 40 - 33.34, 'one bar');
    assert.ok(inv.filter(x => x[0] > .05 && x[0] < .27).every(x => x[1]) && inv.filter(x => x[0] > .3).every(x => !x[1]), 'invulnerable only inside the window');
    ({ game, G, P } = await duel(['miststep', null], 0, [-100, 60]));
    P.ink = 40; press(G, 'power1', 1); run(game, .6, (G, i) => { passive(G); if (i > 0) release(G); });
    assert.ok(P.x > G.B.x + 40, `forward passes behind the foe (${P.x} vs ${G.B.x})`); assert.strictEqual(P.f, -1, 'and turns to face it');
    assert.ok(G.B.hp < G.B.maxHp, 'the afterimage burst hit the foe standing near where the hero was');
    let refunded = false;
    for (let tick = 10; tick <= 18 && !refunded; tick++) {
      const r = await duel(['miststep', null], 0, [-100, 100], { miststep: 3 });
      r.game.startMove(r.B, 'g_thrust'); r.P.ink = 40;
      run(r.game, .7, (G, i) => { passive(G); if (i === tick) press(G, 'power1'); else release(G); });
      if (r.P.hp === r.P.maxHp && r.P.ink > 40 - 33.34 + 9) refunded = true;
    }
    assert.ok(refunded, 'tier III: slipping a live thrust gives ink back');
  },

  async 'Iron Resolve: 55% less damage and no stagger; knockdowns still land; slow feet; Slash counters for 8 + 1.2 x absorbed; tier III heals'() {
    let { game, G, P, B } = await duel(['iron_resolve', null], 0, [-100, 100]);
    P.ink = 40; press(G, 'power1'); run(game, .3, (G, i) => { passive(G); if (i > 0) release(G); });
    assert.ok(P.iron, 'stance up');
    game.startMove(B, 'g_thrust'); let staggered = false; run(game, .45, G => { passive(G); if (P.st === 'hit') staggered = true; });
    near(P.maxHp - P.hp, 9 * .45, 'damage x0.45'); assert.strictEqual(staggered, false, 'no stagger');
    press(G, 'slash'); run(game, .5, (G, i) => { passive(G); if (i > 0) release(G); });
    near(B.maxHp - B.hp, Math.min(24, 8 + 1.2 * 9) * 1.2, 'the counter, into the thrust recovery: whiff punish x1.2 (M8)'); assert.ok(['down', 'getup'].includes(B.st), 'and it knocks down');
    assert.strictEqual(P.iron, null, 'the counter ends the stance');
    ({ game, G, P, B } = await duel(['iron_resolve', null], 0, [-100, 100]));
    P.ink = 40; press(G, 'power1'); run(game, .3, (G, i) => { passive(G); if (i > 0) release(G); });
    G.keys.right = true; run(game, 2 / 60, passive); near(P.vx, 340 * .4, 'walking x0.4'); release(G);
    game.startMove(B, 'g_spin'); run(game, .6, passive); assert.strictEqual(P.st, 'down', 'a knockdown goes through'); assert.strictEqual(P.iron, null);
    ({ game, G, P, B } = await duel(['iron_resolve', null], 0, [-100, 100], { iron_resolve: 3 }));
    P.ink = 40; press(G, 'power1'); run(game, .3, (G, i) => { passive(G); if (i > 0) release(G); });
    game.startMove(B, 'g_thrust'); run(game, .45, passive); P.hp = 50; const hp = P.hp; // room to heal
    press(G, 'slash'); run(game, .5, (G, i) => { passive(G); if (i > 0) release(G); });
    near(P.hp - hp, Math.min(24, 8 + 1.2 * 9) * .3, 'tier III heals 30% of the counter');
    ({ game, G, P } = await duel(['iron_resolve', null], 0, [-100, 300]));
    P.ink = 40; press(G, 'power1'); run(game, .3, (G, i) => { passive(G); if (i > 0) release(G); });
    press(G, 'kick'); run(game, 2 / 60, passive); assert.strictEqual(P.iron, null, 'attacking ends the stance');
  },

  async 'Phantom Edge: a slow ground wave, 12 damage, cannot be ducked, can be jumped, and breaks projectiles'() {
    let { game, G, P, B } = await duel(['phantom_edge', null], 0, [-300, 300]);
    P.ink = 40; press(G, 'power1'); run(game, .32, (G, i) => { passive(G); if (i > 0) release(G); B.crouch = true; });
    const w = G.proj.find(p => p.o === P && p.type === 'phantom'); assert.ok(w); near(Math.abs(w.vx), 650, 'speed');
    run(game, 1, G => { passive(G); B.crouch = true; }); near(B.maxHp - B.hp, 12, 'a crouching foe is hit');
    ({ game, G, P, B } = await duel(['phantom_edge', null], 0, [-300, 300]));
    P.ink = 40; press(G, 'power1'); run(game, 1.4, (G, i) => { passive(G); if (i > 0) release(G); Object.assign(B, { y: -120, vy: 0, air: true, st: 'jump' }); });
    assert.strictEqual(B.hp, B.maxHp, 'an airborne foe is not');
    ({ game, G, P, B } = await duel(['phantom_edge', null], 1, [-350, 350]));
    P.ink = 40; press(G, 'power1'); game.startMove(B, 'k_star'); let starGone = false;
    run(game, 1.4, (G, i) => { passive(G); if (i > 0) release(G); if (i > 20 && !G.proj.some(p => p.type === 'star')) starGone = true; });
    assert.ok(starGone && P.hp === P.maxHp, 'the star met the wave and broke'); near(B.maxHp - B.hp, 12, 'and the wave flew on to hit');
  },

  async 'Demon Sovereignty: two bars, once a round; harder, faster, more ink; the Issen key cuts for 40 and ends it; then burnout'() {
    let { game, G, P, B } = await duel(['demon_sovereignty', 'red_moon'], 0, [-100, 60]);
    P.ink = 70; press(G, 'power1'); run(game, .6, (G, i) => { passive(G); if (i > 0) release(G); });
    assert.ok(P.sov); near(P.ink, 70 - 66.68, 'two bars');
    press(G, 'slash'); run(game, .7, (G, i) => { passive(G); if (i > 0) release(G); }); // hit-stop pauses game time: let the slash finish
    near(B.maxHp - B.hp, 7 * 1.25, 'damage x1.25'); near(P.ink, 70 - 66.68 + 9 * 1.5, 'ink x1.5');
    G.keys.right = true; run(game, 2 / 60, passive); near(P.vx, 340 * 1.15, 'speed x1.15'); release(G);
    P.ink = 100; P.cd = {}; press(G, 'power1'); run(game, 2 / 60, passive); assert.notStrictEqual(P.mvn === 'p_sovereign' && P.st === 'move', true, 'once a round');
    B.block = true; const hp = B.hp; press(G, 'issen'); run(game, 1.5, (G, i) => { passive(G); if (i > 0) release(G); G.B.block = true; });
    near(hp - B.hp, 40, 'the Sovereign Cut ignores the block'); assert.strictEqual(P.sov, null, 'and ends the form');
    P.ink = 100; P.cd = {}; press(G, 'power2'); run(game, 2 / 60, passive); assert.notStrictEqual(P.st, 'move', 'burnout: no powers');
    run(game, 2, passive); press(G, 'power2'); run(game, 2 / 60, passive); assert.strictEqual(P.mvn, 'p_red_moon', 'powers return after 2 s');
    game.G.round = 2; game.newRound(); assert.deepStrictEqual(JSON.parse(JSON.stringify(P.once)), {}, 'a new round allows it again');
  },

  async 'every power against every boss: fights finish with a winner (no soft-lock)'() {
    for (const id of ['miststep', 'iron_resolve', 'phantom_edge', 'demon_sovereignty']) for (let lv = 0; lv < 5; lv++) {
      const { game } = await boot({ seed: 20 + lv }), G = game.G;
      game.SV = profile(game, [id, null]); game.startFight(lv, 7 + lv);
      run(game, 400, (G, i) => {
        const d = G.B.x - G.P.x, k = G.keys; k.right = d > 165; k.left = d < -165;
        if (i % 18 === 0) G.buf = { a: i % 54 === 0 ? 'power1' : Math.abs(d) < 200 ? (G.P.ink >= 99.5 ? 'issen' : 'slash') : 'power1', t: G.t };
      });
      assert.strictEqual(G.state, 'over', `${id} vs ${game.BOSSES[lv].id} finished`); assert.ok(Math.max(G.P.wins, G.B.wins) === 2);
    }
  },

  async 'boss phases: below half health, once a round, with a banner, a notch and the new move'() {
    for (let lv = 0; lv < 5; lv++) {
      const { game } = await boot({ seed: 3 }), G = game.G, ph = game.BOSSES[lv].phase;
      game.SV = profile(game, [null, null]); game.startFight(lv, 5); G.state = 'fight'; G.P.x = -70; G.B.x = 70;
      G.B.hp = G.B.maxHp * .52; G.buf = { a: 'slash', t: G.t }; run(game, .4, () => {});
      assert.strictEqual(G.B.phase, true, `${G.B.def.id} enters its second phase`);
      if (ph.k) assert.strictEqual(G.ban && G.ban.k, ph.k, 'with its banner');
      game.renderGame(); // the HUD draws the notch
      const used = new Set(); G.P.x = -350; G.B.x = 350;
      run(game, 40, G => { G.P.hp = G.P.maxHp; G.keys.left = G.keys.right = false; if (G.B.st === 'move') used.add(G.B.mvn); });
      assert.ok(used.has(ph.move), `${G.B.def.id} uses ${ph.move} (used: ${[...used]})`);
      G.round = 2; game.newRound(); assert.strictEqual(G.B.phase, false, 'and the phase resets each round');
    }
  },

  async 'swing trails follow the blade during the active window and fade within 0.2 s'() {
    const { game, G, P } = await duel([null, null], 0, [-100, 300]);
    press(G, 'slash'); let most = 0;
    for (let i = 0; i < 20; i++) { game.updGame(1 / 60); game.renderGame(); most = Math.max(most, (P.trail || []).length); }
    assert.ok(most > 2 && most <= 16, `trail points ${most}`);
    for (let i = 0; i < 30; i++) { game.updGame(1 / 60); game.renderGame(); }
    assert.ok(!P.trail || P.trail.length <= 1, 'gone after it fades');
  },
};
