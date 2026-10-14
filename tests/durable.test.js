// v2 brief, stage 2: durable progression. A failed write keeps the last saved state (and a retry pays once); a fight is an
// attempt settled exactly once for its own profile; daily periods never go back; supplies are charged at first use;
// repeat victories pay renewable mon (and hard ones a material); old saves move to stable mission ids; typed events.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const failing = st => { const set = st.setItem; st.fail = () => { st.setItem = () => { throw new Error('quota'); }; }; st.heal = () => { st.setItem = set; }; return st; };
function win(game, lv = 0, node = { kind: 'step', i: 0 }) { game.startFight(lv, 1, node); const G = game.G; G.state = 'fight'; G.P.wins = G.need - 1; G.B.hp = 0; run(game, 4, passive); return G; }

module.exports = {
  async 'a victory that cannot be saved pays nothing, says so, and pays exactly once on retry'() {
    const st = failing(memoryStorage()), { game, el } = await boot({ storage: st }); game.enterGame(); game.startFight(0, 1, { kind: 'step', i: 0 });
    const G = game.G, xp0 = game.SV.profile.xp; G.state = 'fight'; G.B.hp = 0; st.fail(); run(game, 4, passive);
    assert.strictEqual(game.SV.profile.xp, xp0, 'nothing kept'); assert.ok(!game.SV.rewardsClaimed['m:bf_footman']); assert.strictEqual(open(el, game), 'notice'); assert.match(el('nTitle').textContent, /could not be saved/);
    st.heal(); el('nBtns').children[0].click(); assert.strictEqual(game.SV.profile.xp, xp0 + 250, 'the retry pays'); assert.strictEqual(open(el, game), 'result');
    assert.strictEqual(game.settleFight(), true); assert.strictEqual(game.SV.profile.xp, xp0 + 250, 'and only once');
  },

  async 'failed writes keep the last saved state everywhere: a purchase, an attribute point, a drill'() {
    const st = failing(memoryStorage()), { game, el } = await boot({ storage: st }); const s = game.SV; s.profile.mon = 500; s.profile.xp = 2000; s.profile.level = game.levelOf(2000).level; game.points(s); game.writeSave(s); game.enterGame(); st.fail();
    assert.strictEqual(game.buy(s, 'travel_haori').ok, false); assert.strictEqual(game.SV.profile.mon, 500); assert.ok(!game.SV.gear.owned.includes('travel_haori'));
    game.CH.tab = 'attrs'; game.openChar(null, 'home'); const pts = game.SV.profile.attrPts; el('cBody').children[0].children[0].click();
    assert.strictEqual(game.SV.profile.attrPts, pts, 'no point spent'); assert.match(el('nTitle').textContent, /could not be saved/);
    game.startTraining(); game.startDrill('guard'); const G = game.G; G.state = 'fight'; G.keys.block = true; run(game, 14); assert.ok(!game.SV.rewardsClaimed['drill:guard'], 'a drill is not paid unsaved');
  },

  async 'an attempt settles once: a repeat callback replays its receipt, a stale one after another fight pays nothing'() {
    const { game } = await boot(); game.enterGame(); let G = win(game); const a = game.SV.att.done[0], mon = game.SV.profile.mon;
    G.attempt = a; G.res = { win: true }; game.settleFight(); assert.strictEqual(game.SV.profile.mon, mon, 'the same attempt again: nothing more');
    game.startFight(0, 1, { kind: 'step', i: 0 }); const b = game.G.attempt; assert.ok(b > a); G = game.G; G.state = 'fight'; G.B.hp = 0; run(game, 4, passive); const m2 = game.SV.profile.mon;
    game.commit(d => { game.settle(d, a, d.profile.epoch, () => game.grantStep(d, 0, 0)); }); assert.strictEqual(game.SV.profile.mon, m2, 'A after B pays nothing');
    const old = game.SV.att.floor; game.SV.att.receipts = {}; game.commit(d => { game.settle(d, a, d.profile.epoch, () => game.grantStep(d, 0, 0)); }); assert.strictEqual(game.SV.profile.mon, m2, 'even once its receipt is pruned');
  },

  async 'New Game (or an import) while an old fight is pending: the old attempt cannot pay the new profile'() {
    const { game } = await boot(); game.enterGame(); game.startFight(0, 1, { kind: 'step', i: 0 }); const G = game.G, id = G.attempt, ep = G.epoch;
    game.newGame(); assert.notStrictEqual(game.SV.profile.epoch, ep); const r = game.commit(d => { const o = game.settle(d, id, ep, () => game.grantStep(d, 0, 0)); return o.refused ? false : undefined; });
    assert.strictEqual(r.ok, false); assert.strictEqual(game.SV.profile.xp, 0);
  },

  async 'daily periods only move forward: a clock set back, or cycled, cannot pay a claimed day again; the first fight of a new day counts'() {
    const { game } = await boot({ dailies: true }), s = game.SV; game.setToday(() => '2026-10-12'); game.rollDaily(s); s.daily.ids[0] = 'wins3'; s.daily.base.wins = 0; s.stats.wins = 3;
    const m0 = s.profile.mon; game.award(s); assert.strictEqual(s.profile.mon, m0 + 60);
    game.setToday(() => '2026-10-11'); game.rollDaily(s); assert.strictEqual(s.daily.day, '2026-10-12', 'back in time: the period holds'); game.award(s); assert.strictEqual(s.profile.mon, m0 + 60);
    game.setToday(() => '2026-10-13'); game.rollDaily(s); game.setToday(() => '2026-10-12'); game.rollDaily(s); assert.strictEqual(s.daily.day, '2026-10-13', 'cycling the date cannot return to a paid day');
    const b = await boot({ dailies: true }), g = b.game; g.setToday(() => '2026-10-20'); g.SV.daily = { day: '2026-10-19', ids: ['wins3'], base: { wins: 0 } }; g.enterGame();
    win(g); assert.strictEqual(g.SV.daily.day, '2026-10-20'); assert.strictEqual(g.SV.stats.wins, 1);
    assert.ok(Object.values(g.SV.daily.base).every(v => v === 0), 'the new day began before that fight was counted, so it counts for the new day');
  },

  async 'supplies: incense and whetstone are charged at the bell (a restart charges the new attempt, a quit refunds nothing); tea only when it heals'() {
    const { game } = await boot(); const s = game.SV; s.gear.items = { focus_incense: 2, healing_tea: 1 }; game.equip(s, 'item', 'focus_incense'); game.enterGame();
    game.startFight(0, 1); assert.strictEqual(game.SV.gear.items.focus_incense, 1, 'charged at the start'); game.G.state = 'fight'; game.toMenu(); assert.strictEqual(game.SV.gear.items.focus_incense, 1, 'quitting refunds nothing');
    game.startFight(0, 1); assert.strictEqual(game.SV.gear.items.focus_incense, undefined, 'a restart is a new attempt');
    game.equip(game.SV, 'item', 'healing_tea'); game.startFight(0, 1); let G = game.G; assert.strictEqual(game.SV.gear.items.healing_tea, 1, 'tea is only reserved'); game.toMenu();
    assert.strictEqual(game.SV.gear.items.healing_tea, 1, 'an unused tea goes back to the pack'); game.startFight(0, 1); G = game.G; G.state = 'fight'; G.P.hp = 35; G.P.x = -100; G.B.x = 100; passive(G);
    game.startMove(G.B, 'g_thrust'); run(game, .6, passive); assert.strictEqual(game.SV.gear.items.healing_tea, undefined, 'charged as it heals');
  },

  async 'repeat victories pay renewable mon, and hard ones a material: an upgrade within four ordinary wins after spending everything'() {
    const { game } = await boot(); game.enterGame(); win(game); const s = game.SV; s.profile.mon = 0; s.profile.materials = 0;
    let wins = 0; while (s.profile.mon < 100 && wins < 10) { win(game); wins++; } assert.ok(wins <= 4, `${wins} ordinary wins for 100 mon`);
    for (let i = 0; i < 2; i++) win(game, 0, { kind: 'step', i: 1 }); s.rewardsClaimed['m:bf_thrower'] = 1;
    win(game, 0, { kind: 'step', i: 2 }); const m = s.profile.materials; win(game, 0, { kind: 'step', i: 2 }); assert.strictEqual(s.profile.materials, m + 1, 'an elite repeat pays a material');
    const lost = s.profile.mon; game.startFight(0, 1, { kind: 'step', i: 0 }); const G = game.G; G.state = 'fight'; G.P.hp = 0; run(game, 4, passive); assert.strictEqual(s.profile.mon, lost, 'a loss pays nothing');
  },

  async 'a 1.7 save moves to stable mission ids; claims that disagree with the progress are dropped, never paid'() {
    const { game } = await boot(); const old = game.cleanSave({}); old.rewardsClaimed = { 'step:burning_field:0': 5, 'cr:step:burning_field:2': 1, 'step:burning_field:2': 6, 'hell:6': 7, 'cr:hell:6': 1, 'boss:akuma': 9 };
    old.story.seen = ['white:4']; old.profile.crystals = 0; const s = game.cleanSave(JSON.parse(JSON.stringify(old)));
    assert.ok(s.rewardsClaimed['m:bf_footman'] && s.rewardsClaimed['m:bf_spear'] && s.rewardsClaimed['cr:m:bf_spear'] && s.rewardsClaimed['m:hell_ninth']);
    assert.ok(!s.rewardsClaimed['step:burning_field:0'] && !s.rewardsClaimed['hell:6']); assert.ok(s.story.seen.includes('m:white_hakuren'));
    assert.ok(!s.rewardsClaimed['boss:akuma'], 'Akuma was never defeated in that save'); assert.strictEqual(s.profile.crystals, 0, 'crystals already paid stay paid; nothing for the false claim');
  },

  async 'a save from a newer version is never overwritten; a damaged copy is disclosed and kept aside'() {
    const st = memoryStorage(); st.setItem('issen-five-shadows.v2.a', JSON.stringify({ sum: 'x', doc: { v: 3 } }));
    const doc = { v: 3, rev: 9 }, fnv = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193); return (h >>> 0).toString(36); };
    st.setItem('issen-five-shadows.v2.b', JSON.stringify({ sum: fnv(JSON.stringify(doc)), doc })); const before = st.getItem('issen-five-shadows.v2.b');
    const { game } = await boot({ storage: st }); assert.ok(game.STORE.lock); assert.strictEqual(game.writeSave(game.SV), false); assert.strictEqual(st.getItem('issen-five-shadows.v2.b'), before, 'untouched');
    const st2 = memoryStorage(), a = await boot({ storage: st2 }); a.game.grantClear(a.game.SV, 0, 'g'); a.game.writeSave(a.game.SV); a.game.writeSave(a.game.SV);
    st2.setItem('issen-five-shadows.v2.a', '{"sum":"broken'); const b = await boot({ storage: st2 }); assert.ok(b.game.SV.powers.red_moon, 'the good copy loads');
    assert.ok(b.game.SV.story.pending.some(n => /could not be read/.test(n.text))); assert.ok(JSON.parse(st2.getItem('issen-five-shadows.quarantine')).length >= 1);
  },

  async 'typed events: a champion is an elite, a shadow, a trial or a mode champion; damage is counted before healing'() {
    const { game } = await boot(); game.enterGame(); win(game); assert.ok(!(game.SV.stats.bigWins > 0), 'a retainer is no champion');
    win(game, 0, { kind: 'step', i: 2 }); assert.strictEqual(game.SV.stats.bigWins, 1);
    const s = game.SV; s.gear.items = { healing_tea: 1 }; game.equip(s, 'item', 'healing_tea'); game.startFight(0, 1); const G = game.G; G.state = 'fight'; G.P.hp = 35; G.P.x = -100; G.B.x = 100; passive(G);
    game.startMove(G.B, 'g_thrust'); run(game, .6, passive); assert.ok(G.tally.hurt >= 9 - 1e-9, `the hit counted (${G.tally.hurt}) although the tea healed more`);
  },
};
