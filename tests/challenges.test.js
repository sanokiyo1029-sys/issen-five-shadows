// 1.7 (part 4): challenges. Three daily challenges per local date (the same for everyone that day), counted from that day's
// stats; achievements; each pays once, the moment it is met; fight tallies become stats only for campaign and mode fights.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };

module.exports = {
  async 'the day decides the three challenges; a new day brings new ones and spends the old claims'() {
    const { game } = await boot({ dailies: true }), s = game.SV; game.setToday(() => '2026-10-12'); game.rollDaily(s); const a = s.daily.ids.slice();
    assert.strictEqual(a.length, 3); assert.strictEqual(new Set(a).size, 3);
    const { game: g2 } = await boot({ dailies: true }); g2.setToday(() => '2026-10-12'); g2.rollDaily(g2.SV); assert.deepStrictEqual([...g2.SV.daily.ids], [...a], 'the same set for that date');
    assert.ok(a.every(id => !game.dailyOf(id).need), 'nothing needing a power or a mode the player lacks');
    s.rewardsClaimed['daily:2026-10-12:' + a[0]] = 1; game.setToday(() => '2026-10-13'); game.rollDaily(s);
    assert.strictEqual(s.daily.day, '2026-10-13'); assert.ok(!Object.keys(s.rewardsClaimed).some(k => k.includes('2026-10-12')), 'yesterday is spent');
  },

  async 'a daily counts from the day it began and pays once; achievements pay once'() {
    const { game } = await boot({ dailies: true }), s = game.SV; game.setToday(() => '2026-10-12'); s.stats.wins = 7; game.rollDaily(s);
    const id = 'wins3'; s.daily.ids[0] = id; s.daily.base.wins = 7; const m0 = s.profile.mon, c0 = s.profile.crystals;
    s.stats.wins = 9; const g9 = game.award(s); assert.strictEqual(g9.filter(x => /Win 3/.test(x.text)).length, 0, '2 of 3: not yet'); assert.ok(g9.some(x => /First Blood/.test(x.text)), 'the first-win achievement');
    s.stats.wins = 10; const got = game.award(s); assert.ok(got.some(x => /Daily challenge — Win 3 duels/.test(x.text))); assert.strictEqual(s.profile.mon, m0 + 60);
    assert.strictEqual(s.profile.crystals, c0 + 5, 'First Blood: 5 crystals'); assert.strictEqual(game.award(s).length, 0, 'nothing twice');
    assert.strictEqual(s.stats.dailies, 1);
  },

  async 'a won fight turns its tallies into stats and pays what it completes; training never does'() {
    const { game, el } = await boot(); game.setToday(() => '2026-10-12'); game.enterGame(); game.startFight(0, 1, { kind: 'step', i: 0 });
    const G = game.G; G.state = 'fight'; G.P.x = -100; G.B.x = 100; passive(G); G.buf = { a: 'slash', t: G.t }; run(game, .5, passive); G.B.hp = 0; run(game, 6, passive);
    assert.strictEqual(game.SV.stats.wins, 1); assert.strictEqual(game.SV.stats.perfect, 1, 'untouched'); assert.ok(game.SV.rewardsClaimed['ach:first_win']);
    assert.match(el('rPurse').textContent, /Achievement — First Blood \(\+5 shadow crystals\)/); assert.match(el('rPurse').textContent, /Achievement — Untouched/);
    const before = JSON.stringify(game.SV.stats); game.startTraining({ behav: 'fight' }); G.state = 'fight'; run(game, 20, (G, i) => { if (i % 15 === 0) G.buf = { a: 'slash', t: G.t }; });
    assert.strictEqual(JSON.stringify(game.SV.stats), before, 'training adds nothing');
  },

  async 'the challenges screen: today, the Ink Trials (playable), achievements; announced achievements from outside fights'() {
    const { game, el } = await boot({ dailies: true }); game.setToday(() => '2026-10-12'); game.enterGame();
    el('hMenu').children.find(b => b.innerHTML.startsWith('Challenges')).click(); assert.strictEqual(open(el, game), 'chal'); assert.strictEqual(el('chBody').children.length, 3);
    game.openChal(null, 'ach'); assert.strictEqual(el('chBody').children.length, game.CHAL.achievements.length);
    game.openChal(null, 'trials'); assert.ok(el('chBody').children[0].className.includes('locked'), 'a trial waits for its shadow');
    game.grantClear(game.SV, 0, 'w'); game.openChal(null, 'trials'); el('chBody').children[0].click(); assert.ok(game.G.trial, 'the trial starts from here');
    game.G.state = 'over'; game.toHome(); assert.strictEqual(open(el, game), 'notice'); assert.match(el('nText').textContent, /The First Shadow/);
  },
};
