// 1.7 (part 3): the Training Room. The Forgotten Dojo has no clock and no KO; the partner idles, blocks, attacks (all moves or
// one pattern) or fights back; infinite health; hitboxes; any owned weapon without touching the loadout; drills pay a little
// mon once; the perfect parry works here (and in White Mode) but not in the campaign; nothing else in the save changes.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const strip = s => { const o = JSON.parse(JSON.stringify(s)); delete o.rev; delete o.savedAt; return o; };
// press slash again once the chain window of the cut in progress is open (mashing earlier is swallowed, as in play)
const rhythm = G => { const P = G.P; if (P.st === 'move' && P.mv.chain && !P.next && P.mvT >= P.mv.cw && !G.buf) G.buf = { a: 'slash', t: G.t }; };
async function dojo(o = {}) { const b = await boot(), { game } = b; game.enterGame(); game.startTraining(o); const G = game.G; G.state = 'fight'; G.st = 0; G.hint = 0; G.P.x = -120; G.B.x = 60; return Object.assign(b, { G }); }

module.exports = {
  async 'the main menu opens the dojo: no clock, no KO, the save untouched'() {
    const { game, el } = await boot(); game.enterGame(); const before = strip(game.SV);
    el('hMenu').children.find(b => b.innerHTML.startsWith('Training Room')).click(); const G = game.G;
    assert.strictEqual(game.mode, 'game'); assert.strictEqual(G.arena, game.DOJO_A); assert.strictEqual(G.def.id, 'dummy');
    G.state = 'fight'; G.train.behav = 'fight'; G.train.inf = false; run(game, 200, (G, i) => { if (i % 20 === 0) G.buf = { a: 'slash', t: G.t }; });
    assert.strictEqual(G.state, 'fight', 'never ends'); assert.strictEqual(G.timer, 99);
    G.paused = false; game.togglePause(); assert.strictEqual(open(el, game), 'train'); el('tLeave').click(); assert.strictEqual(open(el, game), 'home');
    assert.deepStrictEqual(strip(game.SV), before, 'free practice changes nothing in the journey');
  },

  async 'behaviours: still, always block, attack one pattern, fight back'() {
    let { game, G } = await dojo({ behav: 'idle' }); run(game, 4); assert.strictEqual(G.P.hp, G.P.maxHp, 'still: never attacks');
    ({ game, G } = await dojo({ behav: 'block' })); G.P.x = -60; G.B.x = 60; for (let i = 0; i < 3; i++) { G.buf = { a: 'slash', t: G.t }; run(game, .5); }
    assert.ok(G.tally.hits === undefined && G.B.hp === G.B.maxHp, 'always block: every slash is blocked');
    G.P.x = -60; G.B.x = 60; G.keys.down = true; G.buf = { a: 'slash', t: G.t }; run(game, .5); assert.strictEqual(G.B.hp, G.B.maxHp, 'it crouch-blocks the low cut too');
    ({ game, G } = await dojo({ behav: 'attack', move: 'r_low', gap: .9, inf: false })); const seen = new Set(); run(game, 6, G => { if (G.B.mvn) seen.add(G.B.mvn); });
    assert.deepStrictEqual([...seen], ['r_low'], 'one pattern only'); assert.ok(G.tally.hurt > 0, 'and it lands when not answered');
    ({ game, G } = await dojo({ behav: 'fight', partner: 'dummy' })); run(game, 8); assert.ok(G.tally.hurt > 0, 'fight back: the normal AI attacks');
  },

  async 'infinite health keeps the hero standing; otherwise a fall restores health'() {
    let { game, G } = await dojo({ behav: 'attack', gap: .9 }); run(game, 12); assert.ok(G.P.hp > 0 && G.tally.hurt > 30, 'hurt, but refilled');
    ({ game, G } = await dojo({ behav: 'attack', gap: .9, inf: false })); G.P.hp = 3; run(game, 6); assert.ok(G.P.hp > 3 && G.state === 'fight', 'a fall restores health');
  },

  async 'any owned weapon, without touching the loadout; hitboxes draw; the combo counter counts'() {
    const { game, G } = await dojo(); game.SV.gear.owned.push('kanabo'); game.SV.gear.tiers.kanabo = 1; G.train.weapon = 'kanabo'; game.trainSetup(); game.newRound(); G.state = 'fight';
    assert.strictEqual(G.P.def.weapon, 'kanabo'); assert.strictEqual(game.SV.gear.equipped.weapon, 'katana', 'the saved loadout is unchanged');
    G.train.weapon = null; game.trainSetup(); game.newRound(); G.state = 'fight'; G.P.x = 760; G.B.x = 880; G.train.boxes = true; // in the corner, the pushes cannot carry it out of reach
    G.buf = { a: 'slash', t: G.t }; run(game, 1.4, rhythm); assert.ok(G.tally.maxCombo >= 3, `combo ${G.tally.maxCombo}`); G.rdt = 1 / 60; game.renderGame();
  },

  async 'drills: each completes from its goal and pays its mon only the first time'() {
    const { game, G } = await dojo(); const m0 = game.SV.profile.mon; game.startDrill('guard'); G.state = 'fight'; G.keys.block = true; run(game, 14);
    assert.ok(game.SV.rewardsClaimed['drill:guard']); assert.strictEqual(game.SV.profile.mon, m0 + game.TRAIN.reward_mon); assert.strictEqual(G.train.drill, null);
    game.startDrill('guard'); G.state = 'fight'; G.keys.block = true; run(game, 14); assert.strictEqual(game.SV.profile.mon, m0 + game.TRAIN.reward_mon, 'once');
    game.startDrill('chain'); G.state = 'fight'; G.keys.block = false; G.P.x = 760; G.B.x = 880;
    for (let k = 0; k < 2; k++) { G.buf = { a: 'slash', t: G.t }; run(game, 1.4, rhythm); run(game, 1); G.P.x = 760; G.B.x = 880; }
    assert.ok(game.SV.rewardsClaimed['drill:chain'], `chains ${G.tally.chains}`);
  },

  async 'the perfect parry: a fresh guard in time staggers the attacker and pays ink; a held guard is a plain block; none in the campaign'() {
    let { game, G } = await dojo({ behav: 'idle' }); G.P.x = -100; G.B.x = 60; game.startMove(G.B, 'r_slash'); run(game, .2); G.keys.block = true; run(game, .4);
    assert.strictEqual(G.tally.parries, 1); assert.strictEqual(G.P.hp, G.P.maxHp); assert.ok(G.P.ink >= 12, 'ink'); assert.strictEqual(G.B.st, 'hit', 'the attacker reels');
    ({ game, G } = await dojo({ behav: 'idle' })); G.P.x = -100; G.B.x = 60; G.keys.block = true; run(game, .5); game.startMove(G.B, 'r_slash'); run(game, .6);
    assert.ok(!G.tally.parries && G.tally.blocks === 1, 'a guard held from before is a block');
    const b = await boot(), g2 = b.game; g2.enterGame(); g2.startFight(0, 1); const H = g2.G; H.state = 'fight'; H.P.x = -100; H.B.x = 100; H.B.ai.t = 1e9;
    g2.startMove(H.B, 'g_thrust'); run(g2, .2, G => { G.B.ai.t = 1e9; }); H.keys.block = true; run(g2, .5, G => { G.B.ai.t = 1e9; }); assert.ok(!H.tally.parries, 'no parry in the campaign');
  },
};
