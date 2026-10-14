// v2 brief, stage 5: repeatable content and safe rewards. The Ink Tournament (a seven-duel tournament, a five-foe gauntlet, an
// endless survival) pays every run by a stated policy, won or lost, and forfeits a run that is left; a payout must match the
// attempt it was opened for, and custom maps, training and test-play never open one; the map editor names every invalid field
// of an imported map, catches overlaps and stray pickups, publishes only a layout that has been beaten, and random valid maps
// can be crossed and won.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const pas = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.react = null; };
const down = (game, G) => { G.state = 'fight'; G.B.hp = 0; run(game, 4, pas); }; // the current foe falls
function ready(game) { const s = game.SV; game.grantClear(s, 0, 'g'); for (let i = 0; i < 4; i++) game.grantStep(s, 0, i); s.story.pending = []; s.story.seen.push('tour'); game.enterGame(); return s; }

module.exports = {
  async 'the Ink Tournament opens with Gekkō; every event is open and repeatable; a run pays per stage, won or lost'() {
    const { game, el } = await boot(); assert.ok(!game.locOpen(game.SV, 'tour'), 'closed before Gekkō'); const s = ready(game), M = game.MODES.tour.missions[0];
    assert.ok(game.locOpen(s, 'tour')); assert.deepStrictEqual(JSON.parse(JSON.stringify(game.locNodes(s, 'tour').map(n => n.open))), [true, true, true]);
    for (let run2 = 0; run2 < 2; run2++) { const m0 = s.profile.mon, x0 = s.profile.xp, t0 = s.profile.materials; game.startMission('tour', 0, 1 + run2); const G = game.G;
      for (let k = 0; k < M.bouts; k++) down(game, G); assert.strictEqual(G.state, 'over'); const want = game.tourPay(M, 7);
      assert.strictEqual(s.profile.mon - m0, want.mon, 'the full run, again and again'); assert.strictEqual(s.profile.xp - x0, want.xp); assert.strictEqual(s.profile.materials - t0, 2); assert.strictEqual(game.G.res.r.crystals, 0, 'never crystals (achievements aside)'); }
    assert.strictEqual(s.tour.best.tour_gates, 7); assert.match(el('rText').textContent, /7 of 7/);
    const m0 = s.profile.mon; game.startMission('tour', 1, 9); const G = game.G; down(game, G); down(game, G); G.state = 'fight'; G.P.hp = 0; run(game, 4, pas);
    assert.strictEqual(G.tourWon, 2); assert.strictEqual(s.profile.mon - m0, 30 + 40, 'a lost run pays the two stages it cleared'); assert.match(el('rTitle').textContent, /The run ends/);
    const m1 = s.profile.mon; game.startMission('tour', 1, 10); game.G.state = 'fight'; game.G.P.hp = 0; run(game, 4, pas); assert.strictEqual(s.profile.mon, m1, 'nothing cleared, nothing paid');
  },

  async 'the rules: the Gates heal between duels, the Road carries health, the Lantern regains 15 and grows; leaving or closing forfeits a run'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }), s = ready(game);
    game.startMission('tour', 0, 1); let G = game.G; G.state = 'fight'; G.P.hp = 30; G.B.hp = 0; run(game, 4, pas); assert.strictEqual(G.P.hp, G.P.maxHp, 'the Gates: health restored');
    game.startMission('tour', 1, 1); G = game.G; G.state = 'fight'; G.P.hp = 30; G.B.hp = 0; run(game, 4, pas); assert.strictEqual(G.P.hp, 30, 'the Road: no rest');
    assert.ok(G.waves.every((d, k) => k === 0 || d.hp >= G.waves[k - 1].hp), 'each stronger than the last');
    game.startMission('tour', 2, 1); G = game.G; assert.strictEqual(G.waves.length, 1); G.state = 'fight'; G.P.hp = 30; G.B.hp = 0; run(game, 4, pas);
    assert.strictEqual(G.P.hp, 45, 'the Lantern: +15'); assert.strictEqual(G.waves.length, 2, 'it grows'); down(game, G); down(game, G);
    const m0 = s.profile.mon, rev = s.rev; G.state = 'over'; game.toMenu(); assert.strictEqual(s.profile.mon, m0, 'left: forfeited');
    const r = (await boot({ storage: st })).game.SV; assert.strictEqual(r.profile.mon, m0); assert.strictEqual(r.att.open, null, 'the cut-off run is retired on load, unpaid'); assert.ok(r.rev >= rev);
  },

  async 'reward origin: a payout must match its attempt; custom maps, training and test-play never open one'() {
    const { game } = await boot(), s = game.SV; game.enterGame(); game.startFight(0, 1, { kind: 'step', i: 0 }); let G = game.G;
    assert.deepStrictEqual({ kind: s.att.open.kind, ref: s.att.open.ref }, { kind: 'step', ref: 'bf_footman' });
    G.node = { kind: 'boss' }; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; run(game, 6, pas); // a step attempt dressed up as the boss
    assert.ok(!s.rewardsClaimed['boss:gekko'] && !s.rewardsClaimed['m:bf_footman'], 'refused: neither pays'); assert.strictEqual(s.profile.xp, 0);
    game.grantStep(s, 0, 0); const m = game.cleanMap({ name: 'Trap', waves: ['footman'] }); game.storeMap(m); const rev = game.SV.rev, xp = game.SV.profile.xp;
    for (const test of [false, true]) { game.startCustom(m, test); G = game.G; assert.strictEqual(G.attempt, null); G.node = Object.assign(G.node, { kind: 'boss' }); G.state = 'fight'; G.B.hp = 0; G.P.wins = 9; run(game, 5, pas); }
    game.startTraining({ behav: 'idle' }); G = game.G; G.state = 'fight'; G.B.hp = 0; run(game, 3, pas);
    assert.strictEqual(game.SV.profile.xp, xp); assert.ok(!game.SV.rewardsClaimed['boss:gekko']); assert.ok(game.SV.rev - rev <= 1, 'at most the map’s own record (made:)');
  },

  async 'map validation: stray pickups and overlaps; an imported map names every invalid field and loads as a draft'() {
    const { game, el } = await boot(), s = game.SV; game.grantStep(s, 0, 0);
    const v = o => game.validateMap(game.cleanMap(Object.assign({ name: 'T', waves: ['footman'] }, o)));
    const none = a => assert.strictEqual(JSON.stringify(a), '[]'); none(v({}));
    assert.ok(v({ pickups: [{ x: 0, h: 90, kind: 'tea' }] }).some(e => /Pickup 1 floats/.test(e))); none(v({ platforms: [{ x: 0, w: 240, h: 90 }], pickups: [{ x: 0, h: 90, kind: 'tea' }] })); // on a ledge it is fine
    assert.ok(v({ pickups: [{ x: 880, h: 0, kind: 'ink' }] }).some(e => /outside the walls/.test(e))); assert.ok(v({ pickups: [{ x: 0, h: 0, kind: 'ink' }, { x: 30, h: 0, kind: 'tea' }] }).some(e => /on another pickup/.test(e)));
    assert.ok(v({ obstacles: [{ x: 0, w: 90, h: 80 }, { x: 60, w: 90, h: 80 }] }).some(e => /Obstacles 1 and 2 overlap/.test(e)));
    assert.ok(v({ obstacles: [{ x: 0, w: 90, h: 80 }], hazards: [{ x: 30, w: 100, kind: 'fire' }] }).some(e => /Hazard 1 runs under obstacle 1/.test(e)));
    assert.ok(v({ obstacles: [{ x: 0, w: 90, h: 120 }], platforms: [{ x: 0, w: 240, h: 100 }] }).some(e => /Ledge 1 passes through obstacle 1/.test(e)));
    assert.ok(v({ obstacles: [{ x: 0, w: 90, h: 80 }], pickups: [{ x: 0, h: 0, kind: 'tea' }] }).some(e => /Pickup 1 is inside an obstacle/.test(e)));
    const raw = { name: 'Odd', width: 9000, extra: true, hazards: [{ x: 0, w: 100, kind: 'lava', period: 99 }], waves: ['footman', 'nobody'], published: true, verified: 'forged' };
    const code = 'ISSENMAP1-' + Buffer.from(JSON.stringify(raw)).toString('base64'); game.enterGame(); game.openWorkshop('home');
    el('wkBtns').children.find(b => b.textContent === 'Load a code').click(); el('wkCode').value = code; el('wkBtns').children.find(b => b.textContent === 'Load it').click();
    const msg = el('wkMsg').textContent; for (const f of ['extra: not a map field', 'width: 9000 → 1400', 'hazards[0].kind: "lava" → "fire"', 'hazards[0].period: 99 → 8', 'waves: "nobody" is not a foe']) assert.ok(msg.includes(f), `${f} in: ${msg}`);
    const got = game.maps().find(x => x.name === 'Odd'); assert.strictEqual(got.published, false, 'a draft'); assert.strictEqual(got.verified, '', 'its claim to have been beaten is not trusted');
  },

  async 'a map is published only after a win on exactly that layout'() {
    const { game, el } = await boot(), s = game.SV; game.grantStep(s, 0, 0); game.enterGame(); const m = game.cleanMap({ name: 'Proven', waves: ['footman'] }); game.storeMap(m);
    const publish = () => { game.WK.sel = m.id; game.openWorkshop('home'); el('wkBtns').children.find(b => /^Publish/.test(b.textContent)).click(); return game.maps().find(x => x.id === m.id); };
    assert.strictEqual(publish().published, false); assert.match(el('wkMsg').textContent + game.WK.msg, /Win a play of this version first/);
    game.startCustom(game.maps().find(x => x.id === m.id), true); let G = game.G; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; run(game, 5, pas); assert.strictEqual(G.state, 'over');
    assert.strictEqual(game.maps().find(x => x.id === m.id).verified, game.mapSig(m), 'beaten'); assert.strictEqual(publish().published, true);
    const moved = Object.assign({}, game.maps().find(x => x.id === m.id), { obstacles: [{ x: 0, w: 60, h: 60 }], published: false }); game.storeMap(moved);
    assert.notStrictEqual(game.maps().find(x => x.id === m.id).verified, game.mapSig(game.maps().find(x => x.id === m.id)), 'a changed layout must be beaten again');
  },

  async 'winnability smoke test: random valid maps can be crossed, and every wave can be won'() {
    const { game } = await boot(), s = game.SV; for (let i = 0; i < 2; i++) game.grantStep(s, 0, i); game.enterGame();
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = (a, b) => a + rnd() * (b - a);
    let tried = 0, valid = 0;
    while (valid < 10 && tried < 400) { tried++; const W = pick(600, 1400), n = k => [...Array(Math.floor(rnd() * (k + 1)))];
      const m = game.cleanMap({ name: 'R' + tried, width: W, spawns: { hero: -W * .6, foe: W * .6 }, waves: ['footman', 'thrower'].slice(0, 1 + Math.floor(rnd() * 2)),
        obstacles: n(3).map(() => ({ x: pick(-W * .4, W * .4), w: pick(40, 120), h: pick(40, 120) })), platforms: n(2).map(() => ({ x: pick(-W * .5, W * .5), w: pick(160, 300), h: pick(80, 160) })),
        hazards: n(2).map(() => ({ x: pick(-W * .35, W * .35), w: pick(80, 150), kind: 'spikes', period: 4, dmg: 6 })), pickups: n(2).map(() => ({ x: pick(-W * .5, W * .5), h: 0, kind: 'tea' })) });
      if (game.validateMap(m).length) continue; valid++;
      game.startCustom(m); const G = game.G; G.state = 'fight'; let best = 1e9, last = 1e9;
      run(game, 12, (G, i) => { pas(G); G.P.hp = G.P.maxHp; const dx = G.B.x - G.P.x; G.keys.right = dx > 0; G.keys.left = dx < 0; best = Math.min(best, Math.abs(dx));
        if (i % 20 === 0) { if (Math.abs(dx) > last - 8) G.jb = G.t; last = Math.abs(dx); } }); // walk at the foe; jump when stuck
      G.keys = {}; assert.ok(best < 200, `${m.name}: the hero reached the foe (closest ${Math.round(best)})`);
      for (let w = 0; w < m.waves.length + 1 && G.state !== 'over'; w++) { G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; run(game, 4, pas); }
      assert.strictEqual(G.state, 'over'); assert.strictEqual(G.res.win, true, `${m.name} can be won`);
    }
    assert.strictEqual(valid, 10, `ten valid maps out of ${tried}`);
  },
};
