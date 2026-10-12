// XP / levels, one-time boss rewards, the Gekkō victory ceremony, Spear of the Red Moon in combat, restart persistence.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
// values from the game's vm realm have foreign prototypes: compare plain JSON copies
const eq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const { boot, run, memoryStorage } = require('../tools/harness');
const SKEY = 'issen-five-shadows';
const copy = st => memoryStorage(st.dump());
const step = (game, n = 1) => { const G = game.G; for (let i = 0; i < n; i++) { G.rdt = 1 / 60; G.rt += 1 / 60; game.updGame(1 / 60); } return G; };

// win (or lose) every round quickly by zeroing a fighter's HP once the round is live
function finishFight(game, win) {
  const G = game.G;
  for (let i = 0; i < 60 * 40 && G.state !== 'absorb' && G.state !== 'over'; i++) { if (G.state === 'fight') (win ? G.B : G.P).hp = 0; step(game); }
  return G;
}

module.exports = {
  async 'XP curve follows the data formula'() {
    const { game } = await boot(), x = game.PROG.xp, need = L => Math.round(x.base * L ** x.exponent);
    assert.strictEqual(game.levelOf(0).level, 1); assert.strictEqual(game.levelOf(need(1) - 1).level, 1); assert.strictEqual(game.levelOf(need(1)).level, 2);
    assert.strictEqual(game.levelOf(need(1) + need(2)).level, 3); assert.strictEqual(game.levelOf(1e9).level, x.level_cap); assert.strictEqual(game.levelOf(1e9).need, 0);
  },

  async 'boss rewards: full once, a reported victory never counts twice, repeats pay 25% XP'() {
    const { game } = await boot(), S = game.SV, R = game.PROG.rewards.gekko;
    const a = game.grantClear(S, 0, 'match-1'), snap = JSON.stringify(S);
    assert.strictEqual(a.first, true); assert.strictEqual(a.xp, R.xp); assert.strictEqual(a.sp, R.skill_points); assert.strictEqual(a.power, 'red_moon'); assert.strictEqual(a.slot, 0);
    eq(game.grantClear(S, 0, 'match-1'), a); assert.strictEqual(JSON.stringify(S), snap, 'double dispatch changed the save');
    const b = game.grantClear(S, 0, 'match-2');
    assert.strictEqual(b.first, false); assert.strictEqual(b.xp, Math.round(R.xp * game.PROG.xp.repeat_share)); assert.strictEqual(b.sp, 0); assert.strictEqual(b.power, null);
    assert.strictEqual(S.profile.skillPts, R.skill_points); assert.strictEqual(S.profile.xp, R.xp + b.xp); eq(S.loadout.powers, ['red_moon', null]);
  },

  async 'beating Gekkō: saved before the ceremony, ceremony, result; restart keeps level, XP, power and loadout'() {
    const { game, storage, el } = await boot({ seed: 5 });
    game.enterGame(); game.startFight(0);
    const G = finishFight(game, true);
    assert.strictEqual(G.state, 'absorb', 'ceremony starts after the win');
    const saved = (await boot({ storage: copy(storage) })).game; // "app killed now": the rewards must already be on disk
    assert.ok(saved.SV.powers.red_moon, 'power saved before the ceremony'); assert.strictEqual(saved.SV.profile.xp, 600);
    eq(saved.SV.story.pending, [{ kind: 'power', id: 'red_moon' }], 'interrupted reveal is queued');
    saved.toMenu(); // ...and shown on the next visit to the map, then cleared
    assert.strictEqual((await boot({ storage: copy(storage) })).game.SV.story.pending.length, 1);

    step(game, 60 * 6); // ceremony plays out (5.4 s) and hands over to the result panel
    assert.strictEqual(G.state, 'over'); assert.match(el('rRewards').textContent, /\+600 XP · level 3 .*\+1 skill point · \+100 mon · \+20 shadow crystals · absorbed 月 Spear of the Red Moon — ready in power slot 1/);
    eq(game.SV.story.pending, []);

    const { game: g2 } = await boot({ storage }); // quit and relaunch
    assert.strictEqual(g2.SV.profile.level, 3); assert.strictEqual(g2.SV.profile.xp, 600); eq(g2.SV.loadout.powers, ['red_moon', null]);
    assert.strictEqual(g2.SV.progress.beaten, 1); assert.strictEqual(JSON.parse(storage.getItem(SKEY)).beaten, 1);
    eq(g2.heroDef().powers, ['red_moon', null]);
  },

  async 'Spear of the Red Moon: costs one bar, 4 s cooldown, 14 damage at long reach; bosses untouched'() {
    const { game } = await boot({ storage: memoryStorage({ [SKEY]: '{"beaten":1}' }) });
    game.enterGame(); game.startFight(1);
    const G = game.G; step(game, 60 * 3); assert.strictEqual(G.state, 'fight');
    const P = G.P, B = G.B, use = () => { G.buf = { a: 'power1', t: G.t }; step(game); };
    P.x = -150; B.x = 200; P.f = 1; B.st = 'hit'; B.stT = 0; B.stun = 9; // a stunned boss 350 px away cannot block
    P.ink = 20; use(); assert.notStrictEqual(P.st, 'move', 'needs one ink bar');
    P.ink = 50; const hp = B.hp; use();
    assert.strictEqual(P.mv && P.mvn, 'p_red_moon'); assert.ok(Math.abs(P.ink - (50 - 33.34)) < 1e-6, 'one bar spent');
    step(game, 30); assert.strictEqual(hp - B.hp, 14, 'lands 14 at a 350 px start distance');
    B.st = 'hit'; B.stT = 0; B.stun = 20; // keep the boss out of the way while the cooldown runs
    step(game, 30); P.ink = 100; use(); assert.notStrictEqual(P.mv && P.mvn, 'p_red_moon', 'cooldown blocks a second use');
    step(game, 60 * 2); assert.ok(G.t < P.cd.p_red_moon); use(); assert.notStrictEqual(P.mv && P.mvn, 'p_red_moon', 'still cooling down');
    while (G.t < P.cd.p_red_moon) step(game); // game time (hit-stop pauses it), not frames
    use(); assert.strictEqual(P.mv && P.mvn, 'p_red_moon', 'usable again after 4 s'); // the hero's copy of the move (per-fighter, M4)
    // per-fighter moves: the boss never sees the hero's power, and the shared tables match the golden baseline
    assert.strictEqual(B.moves.p_red_moon, undefined); assert.strictEqual(game.MV.p_red_moon, undefined);
    const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'baseline.json'), 'utf8')), ser = v => JSON.stringify(v, (k, x) => typeof x === 'function' ? 'fn ' + x.toString() : x);
    assert.strictEqual(ser(game.MV), JSON.stringify(gold.MV)); assert.strictEqual(ser(game.BOSSES), JSON.stringify(gold.BOSSES));
  },

  async 'every boss fight still finishes when the hero keeps using the Red Moon'() {
    for (let lv = 0; lv < 5; lv++) {
      const { game } = await boot({ seed: 11 + lv, storage: memoryStorage({ [SKEY]: '{"beaten":1}' }) });
      game.enterGame(); game.startFight(lv);
      let used = 0;
      const G = run(game, 400, (G, i) => {
        const d = G.B.x - G.P.x; G.keys.right = d > 260; G.keys.left = d < -260;
        if (i % 18 === 0) { const pw = G.P.ink >= 34 && (G.P.cd.p_red_moon || 0) <= G.t; if (pw) used++; G.buf = { a: pw ? 'power1' : 'slash', t: G.t }; }
      });
      assert.ok(G.state === 'over' || G.state === 'absorb', `boss ${lv} fight did not finish (${G.state})`); assert.ok(used > 0, 'power was used');
    }
  },

  async 'a lost fight grants nothing'() {
    const { game, storage } = await boot();
    game.enterGame(); game.startFight(0); const before = game.SV.profile.xp;
    assert.strictEqual(finishFight(game, false).state, 'over');
    assert.strictEqual(game.SV.profile.xp, before); assert.strictEqual(game.SV.progress.beaten, 0); assert.strictEqual(JSON.parse(storage.getItem(SKEY)).beaten, 0);
  },
};
