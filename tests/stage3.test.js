// v2 brief, stage 3: the campaign polished. Two required lieutenants per region teach each Shadow's ways with its own moves;
// a throw (Block + Kick) that beats a guard and loses to strikes, jumps and rolls; the training codex (every move with frame
// data, a registry of the foes met), live frame data and hitboxes drawn from the hit rule itself; campaign completion counts
// only what is required; power tiers can be respecced.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const still = G => { passive(G); G.B.ai.react = null; };
// the hero, close to a foe that stands still (or blocks), presses Block + Kick
function throwAt(game, gap = 70, prep = () => {}) { const G = game.G; G.state = 'fight'; G.P.x = -gap / 2; G.B.x = gap / 2; passive(G); prep(G); G.keys.block = true; G.buf = { a: 'kick', t: G.t }; run(game, .02, still); G.keys.block = false; return G; }

module.exports = {
  async 'every region has two required lieutenants that fight with its Shadow’s own moves, before the elite and the Shadow'() {
    const { game } = await boot(), L = game.LAD, ids = L.regions.flatMap(R => R.steps.map(s => s.id));
    assert.strictEqual(L.regions.flatMap(R => R.steps).filter(s => s.was).length, 19, 'the 19 steps of 1.7 keep their ids'); assert.strictEqual(new Set(ids).size, ids.length);
    L.regions.forEach((R, lv) => {
      const B = game.BOSSES[lv], own = B.moves.concat(B.phase.move), lts = R.steps.filter(s => s.lieutenant), at = R.steps.findIndex(s => s.elite);
      assert.ok(lts.length >= 2, `${R.id}: two lieutenants`); assert.ok(lts.every(s => R.steps.indexOf(s) < at && !s.elite), 'before the elite, and required');
      for (const s of lts) { const F = game.FOES[s.foe]; assert.ok(F.moves.every(n => own.includes(n)), `${F.name}: ${B.name}’s moves`); assert.ok(F.moves.every(n => game.MV[n].ai && game.MV[n].answers), 'moves the AI and the answer sheet know');
        assert.ok(F.tip.length > 40, 'it says what it teaches'); }
    });
    const s = game.migrate('{"beaten":0}').save; for (let i = 0; i < 2; i++) game.grantStep(s, 0, i);
    assert.ok(!game.ladderNodes(s, 0).find(n => n.kind === 'boss').open, 'the Shadow waits for its lieutenants'); game.grantStep(s, 0, 2); game.grantStep(s, 0, 3);
    assert.ok(game.ladderNodes(s, 0).find(n => n.kind === 'boss').open);
    game.enterGame(); game.startFight(0, 1, { kind: 'step', i: 2 }); assert.strictEqual(game.G.need, 2, 'two rounds'); assert.strictEqual(game.G.def.id, 'lt_glint');
    const old = game.migrate('{"beaten":2}').save; assert.ok(game.ladderNodes(old, 1).find(n => n.kind === 'boss').cleared && game.ladderNodes(old, 2)[0].open, 'a save that beat them keeps its road');
  },

  async 'the throw: Block + Kick, close; it beats a guard, but misses a jump, a roll, an attack, and is slow when it misses'() {
    const { game } = await boot(); game.enterGame(); game.startFight(0, 1);
    let G = throwAt(game, 70, G => { G.B.block = true; }); assert.strictEqual(G.P.mvn, 'throw'); run(game, .3, still);
    assert.strictEqual(G.B.st, 'down', 'a guard does not stop it'); assert.strictEqual(G.tally.throws, 1); assert.ok(G.B.hp < G.B.maxHp);
    game.startFight(0, 2); G = throwAt(game, 70, G => { G.B.air = true; G.B.y = -120; G.B.vy = -400; G.B.st = 'jump'; }); run(game, .3, still); assert.ok(!(G.tally.throws > 0), 'it misses a jump');
    game.startFight(0, 3); G = throwAt(game, 70, G => { game.startMove(G.B, 'g_spin'); }); run(game, .12, still); assert.ok(!(G.tally.throws > 0), 'it loses to an attack');
    game.startFight(0, 4); G = throwAt(game, 70, G => { G.B.st = 'roll'; G.B.stT = 0; G.B.roll = { x0: G.B.x, dir: 1 }; }); run(game, .12, still); assert.ok(!(G.tally.throws > 0), 'it misses a roll');
    game.startFight(0, 5); G = throwAt(game, 400); run(game, .4, still); assert.strictEqual(G.P.mvn, 'throw', 'a miss: still recovering after 0.4 s'); assert.ok(!(G.tally.throws > 0));
    game.startFight(0, 6); G = throwAt(game, 70); run(game, .1, still); assert.strictEqual(G.P.mvn, 'throw'); // and without Block it is still a kick:
    game.startFight(0, 7); G = game.G; G.state = 'fight'; G.P.x = -35; G.B.x = 35; passive(G); G.buf = { a: 'kick', t: G.t }; run(game, .02, still); assert.strictEqual(G.P.mvn, 'kick');
  },

  async 'a throw glances off White’s ward; a foe throws a hero who holds the guard close'() {
    const { game } = await boot(); game.enterGame(); game.startFight(0, 1); let G = game.G; G.B.def = Object.assign({}, G.B.def, { ward: true });
    G = throwAt(game); run(game, .3, still); assert.ok(Math.abs(G.B.maxHp - G.B.hp - 8 * .15) < 1e-6, 'a sliver of damage');
    game.BOSSES[0].ai.throw = 1; game.startFight(0, 2); G = game.G; G.state = 'fight'; G.P.x = -40; G.B.x = 40; G.B.ai.t = 0; G.keys.block = true; // the guard, held
    let thrown = false; run(game, 1.6, G => { G.keys.block = true; if (G.B.mvn === 'throw') thrown = true; }); assert.ok(thrown, 'it reached for the throw'); assert.ok(G.P.hp < G.P.maxHp);
  },

  async 'training: frame data and hitboxes come from the same rules as the fight'() {
    const { game, el } = await boot(); game.enterGame(); game.startTraining({ behav: 'block' }); const G = game.G; G.state = 'fight';
    assert.deepStrictEqual({ ...game.frameData(game.MV.slash) }, { start: 6, active: 5, rec: 10, total: 20 }); assert.strictEqual(game.frameData(game.MV.issen).start, null);
    G.P.x = -60; G.B.x = 60; G.buf = { a: 'slash', t: G.t }; run(game, 1.2); const f = G.fd;
    assert.strictEqual(f.n, 'slash'); assert.strictEqual(f.res, 'blocked'); assert.ok(Number.isFinite(f.dEnd - f.aEnd), 'the advantage is measured');
    G.train.frames = true; G.train.boxes = true; for (let i = 0; i < 3; i++) { G.rdt = 1 / 60; game.renderGame(); }
    // the red box ends at reachOf: a defender whose centre is just inside is hit, just outside is not
    for (const [k, hit] of [[-1, true], [2, false]]) {
      game.startFight(0, 1); const H = game.G; H.state = 'fight'; passive(H); H.P.x = 0; H.B.x = game.reachOf(H.P, H.B, game.MV.slash) + k; game.startMove(H.P, 'slash'); run(game, .3, passive);
      assert.strictEqual(H.B.hp < H.B.maxHp, hit, `edge ${k}`); }
  },

  async 'the codex: your moves (with the weapon in hand) and every foe, those not yet met by name only'() {
    const { game, el } = await boot(); game.enterGame(); game.startTraining({}); const T = game.G.train, rows = () => el('tBody').children.map(x => x.textContent);
    T.codex = 'hero'; game.openTrain(); const r = rows(); assert.ok(r.includes('Block + Kick, close')); assert.ok(r.some(t => /throw/.test(t) && /6f startup/.test(t)));
    T.codex = 'footman'; game.openTrain(); assert.ok(rows().includes('? ? ?'), 'not met yet');
    game.grantStep(game.SV, 0, 0); game.openTrain(); assert.ok(rows().includes('Footman')); assert.ok(rows().some(t => /startup/.test(t)));
    assert.ok(game.codexIds().includes('lt_fury') && game.codexIds().includes('akuma'), 'the registry lists them all');
  },

  async 'the throw drill: three throws on a guarding dummy'() {
    const { game } = await boot(); game.enterGame(); game.startTraining({}); game.startDrill('throw'); const G = game.G; G.state = 'fight';
    for (let i = 0; i < 3; i++) { G.P.x = -35; G.B.x = 35; G.keys.block = true; G.buf = { a: 'kick', t: G.t }; run(game, .05); G.keys.block = false; run(game, 2.2); }
    assert.ok(game.SV.rewardsClaimed['drill:throw']);
  },

  async 'campaign completion counts the required duels only; elites and Ink Trials are counted apart'() {
    const { game, el } = await boot(), s = game.SV, c0 = game.campaign(s), req = game.LAD.regions.reduce((a, R) => a + R.steps.filter(x => !x.elite).length + 1, 0);
    assert.strictEqual(c0.total, req); assert.strictEqual(c0.optTotal, 10);
    game.grantStep(s, 0, 4); const c1 = game.campaign(s); assert.strictEqual(c1.pct, 0, 'the elite is optional'); assert.strictEqual(c1.opt, 1);
    game.grantStep(s, 0, 0); assert.strictEqual(game.campaign(s).done, 1); s.story.pending = []; game.award(s); game.enterGame(); assert.match(el('hStat').innerHTML, /campaign 3% · optional 1 of 10/);
  },

  async 'power tiers respec: every tier back to I and its skill points returned, the mon is not; Back cancels'() {
    const { game, el, win } = await boot(), s = game.migrate('{"beaten":2}').save; s.story.pending = []; game.SV = s; s.profile.mon = 5000; game.points(s);
    assert.ok(game.upgradePower(s, 'red_moon')); const sp = s.profile.skillPts, mon = s.profile.mon; game.award(s); game.enterGame();
    game.CH.tab = 'powers'; game.openChar(null, 'home'); const reset = () => el('cCodeBtns').children.find(b => b.textContent === 'Reset power tiers');
    reset().click(); assert.strictEqual(open(el, game), 'notice'); win.issenApp.back(); assert.strictEqual(game.SV.powers.red_moon.tier, 2, 'Back: nothing reset');
    reset().click(); el('nBtns').children[0].click(); assert.strictEqual(game.SV.powers.red_moon.tier, 1); assert.ok(game.SV.profile.skillPts > sp); assert.strictEqual(game.SV.profile.mon, mon);
    assert.strictEqual(game.resetPowers(game.SV), false, 'nothing left to reset');
  },
};
