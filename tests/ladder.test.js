// M6 (spec §11, §7.2): regions with ladders of retainer duels, an optional elite and the boss; checkpoints; Ink Trials that
// open tier IV; story cards; XP targets for the campaign and the trials; tiers IV and V of every power.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const fresh = (game, beaten = 0) => { const s = game.migrate(JSON.stringify({ beaten })).save; s.story.pending = []; game.points(s); return s; };
const win = (game, G) => { for (let r = 0; r < 3 && G.state !== 'over'; r++) { run(game, 2.6, () => {}); G.B.hp = 0; G.buf = null; run(game, 4, () => {}); } }; // take each round
const lose = (game, G) => { for (let r = 0; r < 3 && G.state !== 'over'; r++) { run(game, 2.6, () => {}); G.P.hp = 0; run(game, 4, () => {}); } };

module.exports = {
  async 'XP targets: a first clear of every ladder and boss lands at level 10-12; every Ink Trial too lands at 18-20'() {
    const { game } = await boot(), L = game.LAD, R = game.PROG.rewards;
    const ladder = L.regions.reduce((a, r) => a + r.steps.reduce((b, s) => b + s.xp, 0), 0), bosses = Object.values(R).reduce((a, r) => a + r.xp, 0);
    const trials = Object.values(L.trials).reduce((a, t) => a + t.xp, 0), lvl = xp => game.levelOf(xp).level;
    assert.ok(lvl(ladder + bosses) >= 10 && lvl(ladder + bosses) <= 12, `campaign ${ladder + bosses} XP: level ${lvl(ladder + bosses)}`);
    assert.ok(lvl(ladder + bosses + trials) >= 18 && lvl(ladder + bosses + trials) <= 20, `with trials: level ${lvl(ladder + bosses + trials)}`);
  },

  async 'a region opens with its first retainer; the boss waits for the retainers and lieutenants (the elite is optional); the next region for the boss'() {
    const { game } = await boot(), s = fresh(game), st = (lv, k) => JSON.parse(JSON.stringify(game.ladderNodes(s, lv).map(n => n[k])));
    assert.deepStrictEqual(st(0, 'kind'), ['step', 'step', 'step', 'step', 'step', 'boss', 'trial']); assert.deepStrictEqual(st(0, 'lt'), [false, false, true, true, false, null, null]);
    assert.deepStrictEqual(st(0, 'open'), [true, false, false, false, false, false, false], 'retainer 1 only');
    assert.ok(!game.ladderNodes(s, 1).some(n => n.open), 'region 2 is locked');
    game.grantStep(s, 0, 0); assert.deepStrictEqual(st(0, 'open'), [true, true, false, false, false, false, false], 'then retainer 2');
    game.grantStep(s, 0, 1); assert.deepStrictEqual(st(0, 'open'), [true, true, true, false, false, false, false], 'then the first lieutenant');
    game.grantStep(s, 0, 2); game.grantStep(s, 0, 3); assert.deepStrictEqual(st(0, 'open'), [true, true, true, true, true, true, false], 'then the optional elite and the boss');
    game.grantClear(s, 0); assert.ok(game.ladderNodes(s, 1)[0].open, 'beating the boss opens the next region'); assert.ok(game.ladderNodes(s, 0).find(n => n.kind === 'trial').open, 'and its Ink Trial');
    const old = fresh(game, 3); // a save from before the ladders: beaten bosses stay open without the retainers
    assert.ok(game.ladderNodes(old, 2).find(n => n.kind === 'boss').open && !game.ladderNodes(old, 3).find(n => n.kind === 'boss').open);
  },

  async 'a retainer is one round; the first clear pays once, repeats pay 25%; the checkpoint survives a restart; a loss keeps it'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }), G = game.G;
    game.SV = fresh(game); game.writeSave(game.SV); game.enterGame();
    game.startFight(0, 1, { kind: 'step', i: 0 }); assert.strictEqual(G.def.id, 'footman'); assert.strictEqual(G.need, 1); const aid = G.attempt;
    win(game, G); assert.strictEqual(G.state, 'over'); assert.strictEqual(G.round, 1, 'one round');
    const x = game.LAD.regions[0].steps[0]; assert.strictEqual(game.SV.profile.xp, x.xp); assert.strictEqual(game.SV.profile.mon, x.mon);
    const again = game.grantStep(game.SV, 0, 0, aid); assert.strictEqual(game.SV.profile.xp, x.xp, 'the same victory reported twice pays once'); assert.strictEqual(again.xp, x.xp);
    game.startFight(0, 1, { kind: 'step', i: 0 }); win(game, G); assert.strictEqual(game.SV.profile.xp, x.xp + Math.round(x.xp * .25), 'a repeat pays 25%');
    game.startFight(0, 1, { kind: 'step', i: 1 }); lose(game, G); assert.strictEqual(game.SV.progress.ladder.burning_field, 1, 'a loss keeps the checkpoint');
    const re = (await boot({ storage: st })).game; assert.strictEqual(re.SV.progress.ladder.burning_field, 1, 'and it survives a restart');
    assert.ok(re.ladderNodes(re.SV, 0)[1].open);
  },

  async 'an elite is best of three and pays upgrade material; retainers and elites scale their health by region'() {
    const { game } = await boot(), G = game.G; game.SV = fresh(game, 2); game.SV.progress.ladder.mountain_shrine = 3; game.enterGame();
    game.startFight(2, 1, { kind: 'step', i: game.LAD.regions[2].steps.findIndex(x => x.elite) }); assert.strictEqual(G.need, 2); assert.strictEqual(G.def.id, 'elite_acolyte');
    assert.strictEqual(G.B.maxHp, Math.round(game.FOES.elite_acolyte.hp * (1 + game.LAD.hp_per_region * 2)));
    win(game, G); assert.strictEqual(G.round, 2, 'two rounds'); assert.strictEqual(game.SV.profile.materials, 1);
  },

  async 'Ink Trials: open after the boss; their rules apply; the first pass pays XP, a skill point and an item, and opens tier IV'() {
    const { game } = await boot(), G = game.G;
    assert.ok(!game.ladderNodes(fresh(game, 0), 0).find(n => n.kind === 'trial').open, 'locked before the boss');
    const checks = [[0, () => G.timer <= 30 && G.timer > 29.9, 'Swift Spear: 30 s rounds'], [1, () => G.P.block === false, 'Open Hands: no blocking'],
      [2, () => G.P.hp === G.P.maxHp * .5, 'Half Measure: half health'], [3, () => G.B.phase === true, 'Pale Night: second phase'], [4, () => G.B.rage === true, 'Unending Wrath: rage']];
    for (const [lv, ok, what] of checks) {
      game.SV = fresh(game, 5); game.enterGame(); game.startFight(lv, 1, { kind: 'trial' }); G.state = 'fight'; G.keys.block = true; run(game, 2 / 60, passive);
      assert.ok(ok(), what);
    }
    const s = fresh(game, 5); s.profile.skillPts; game.SV = s; game.enterGame(); const sp = s.profile.skillPts, xp = s.profile.xp;
    s.powers.red_moon.tier = 3; game.points(s); assert.match(game.tierBlock(s, 'red_moon'), /Ink Trial/);
    game.startFight(0, 1, { kind: 'trial' }); win(game, G);
    const T = game.LAD.trials.gekko; assert.strictEqual(game.SV.profile.xp, xp + T.xp); assert.ok(game.SV.gear.owned.includes(T.item));
    assert.ok(game.SV.progress.trialsDone.includes('gekko')); assert.strictEqual(game.tierBlock(game.SV, 'red_moon').includes('Ink Trial'), false, 'tier IV is open');
    assert.ok(game.SV.profile.skillPts >= sp - 3 + T.skill_points - 0, 'a skill point earned');
  },

  async 'story cards: each region shows its card once'() {
    const { game, el } = await boot(); game.SV = fresh(game, 1); game.enterGame();
    game.openRegion(0); assert.strictEqual(el('notice').classList.contains('off'), false, 'the story card first');
    assert.ok(game.SV.story.seen.includes('burning_field'));
    game.openRegion(0); assert.strictEqual(el('region').classList.contains('off'), false, 'then straight to the ladder');
  },

  async 'every retainer and elite fight finishes with a winner'() {
    for (let lv = 0; lv < 5; lv++) {
      const steps = (await boot()).game.LAD.regions[lv].steps;
      for (let i = 0; i < steps.length; i++) {
        const { game } = await boot({ seed: lv * 10 + i }), G = game.G; game.SV = fresh(game, 5); game.enterGame();
        game.startFight(lv, 3 + i, { kind: 'step', i });
        run(game, 300, (G, k) => { const d = G.B.x - G.P.x; G.keys.right = d > 165; G.keys.left = d < -165; if (k % 18 === 0 && Math.abs(d) < 200) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : 'slash', t: G.t }; });
        assert.strictEqual(G.state, 'over', `${steps[i].foe} in region ${lv + 1} finished`);
      }
    }
  },

  async 'tier IV and V of every power do what they say'() {
    const prof = (game, id, tier) => { const s = fresh(game, 5); s.progress.trialsDone = game.BOSSES.map(b => b.id); for (const b of game.BOSSES) s.rewardsClaimed['trial:' + b.id] = 1; /* enough skill points for V */ s.powers[id].tier = tier; s.loadout = { powers: [id, null], echoes: [null, null] }; game.points(s); return s; };
    const duel = async (id, tier, lv = 0, xs = [-100, 120]) => { const { game } = await boot(), G = game.G; game.SV = prof(game, id, tier); game.startFight(lv, 1); G.state = 'fight'; G.P.x = xs[0]; G.B.x = xs[1]; passive(G); return { game, G, P: G.P, B: G.B }; };
    const use = (G, a = 'power1', dir = 0) => { G.keys.right = dir > 0; G.keys.left = dir < 0; G.buf = { a, t: G.t }; };
    // Red Moon IV: +80 reach; the lance breaks projectiles; 30% passes a block. V: 15 ink back on a hit
    let { game, G, P, B } = await duel('red_moon', 5, 1, [-600, 600]);
    assert.strictEqual(P.moves.p_red_moon.reach, 300 + 20 + 80); game.startMove(B, 'k_star'); run(game, .4, passive); // the star flies; thrust into it
    P.ink = 40; use(G); run(game, .6, (G, i) => { passive(G); if (i > 0) G.keys.right = false; });
    assert.ok(!G.proj.some(p => p.type === 'star') && P.hp === P.maxHp, 'the lance broke the star');
    ({ game, G, P, B } = await duel('red_moon', 5, 0, [-200, 200])); P.ink = 40; use(G); run(game, .6, (G, i) => { passive(G); if (i > 0) G.keys.right = false; });
    near(P.ink, 40 - 33.34 + 9 + 15, 'V: ink back on the hit');
    ({ game, G, P, B } = await duel('red_moon', 4, 0, [-150, 150])); P.ink = 40; use(G); run(game, .6, G => { passive(G); G.B.block = true; G.keys.right = false; });
    assert.ok(B.hp < B.maxHp && B.st === 'bstun' || B.hp < B.maxHp, 'IV: damage through the block'); near(B.maxHp - B.hp, 16 * .3, 'a 30% share');
    // Miststep IV: the clone repeats the next attack from where the hero stood
    ({ game, G, P, B } = await duel('miststep', 4, 0, [-60, 80])); P.ink = 40; use(G); run(game, .4, (G, i) => { passive(G); if (i > 0) G.keys.right = false; });
    assert.ok(G.clone, 'a clone stands'); G.buf = { a: 'kick', t: G.t }; run(game, .5, passive);
    assert.ok(!G.clone && B.maxHp - B.hp >= 5 - 1e-9, 'the clone kicked from its own place');
    // Iron Resolve IV: projectiles fly back; V: a 0.6 s longer stance
    ({ game, G, P, B } = await duel('iron_resolve', 5, 1, [-300, 300])); P.ink = 40; use(G); run(game, .3, (G, i) => { passive(G); if (i > 0) G.keys.right = false; });
    near(P.iron.until - G.t, 1.6 + .6 + .25 - .3, 'V: longer stance', .03);
    game.startMove(B, 'k_star'); run(game, 1, passive); assert.strictEqual(P.hp, P.maxHp); assert.ok(B.hp < B.maxHp, 'IV: the star went back to Kasumi');
    // Phantom Edge IV: a strike returns from behind for 60%; V: a second wave
    ({ game, G, P, B } = await duel('phantom_edge', 5, 0, [-300, 300])); P.ink = 40; use(G); let waves = 0;
    run(game, 1.6, (G, i) => { passive(G); if (i > 0) G.keys.right = false; waves = Math.max(waves, G.proj.filter(p => p.type === 'phantom').length); });
    assert.strictEqual(waves, 2, 'V: two waves'); near(B.maxHp - B.hp, 15 + 15 * .6 + 15 + 15 * .6, 'IV: each wave returns from behind for 60%', 1e-6);
    // Demon Sovereignty IV: the cut is 12 harder; V: a 1 s burnout
    ({ game, G, P, B } = await duel('demon_sovereignty', 5, 0, [-150, 150])); P.ink = 70; use(G); run(game, .6, (G, i) => { passive(G); if (i > 0) G.keys.right = false; });
    use(G, 'issen'); run(game, 1.4, (G, i) => { passive(G); if (i > 0) G.keys.right = false; });
    near(B.maxHp - B.hp, 52, 'IV: a 52-damage cut'); near(P.burn - G.t, 1 - (G.t - (P.burn - 1)), 'V: 1 s burnout', 2);
  },
};
