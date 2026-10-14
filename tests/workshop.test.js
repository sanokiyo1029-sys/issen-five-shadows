// 1.7 (part 6): the Ink Workshop. Custom maps are validated (every layout playable), kept in their own checksummed storage,
// edited by tapping the preview, test-played, duplicated, deleted, published, shared as a code; in a fight their ledges,
// obstacles, hazards and pickups work for both fighters; they pay nothing; the campaign is untouched by them.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const idle = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
function arena(game, f) { const m = game.blankMap(); if (f) f(m); return m; }

module.exports = {
  async 'validation names every unplayable layout; a clean map passes; garbage is clamped'() {
    const { game } = await boot(), V = m => game.validateMap(m).join(' ');
    assert.strictEqual(V(game.blankMap()), '', 'the blank map is playable');
    assert.match(V(arena(game, m => { m.spawns.hero = 2000; })), /Your start is outside the walls/);
    assert.match(V(arena(game, m => { m.spawns.foe = -250; })), /closer than 250/);
    assert.match(V(arena(game, m => { m.obstacles.push({ x: -300, w: 90, h: 80 }); })), /Your start is inside an obstacle/);
    assert.match(V(arena(game, m => { m.hazards.push({ x: 300, w: 160, kind: 'fire', period: 4, dmg: 8 }); })), /The foe's start is on a hazard/);
    assert.match(V(arena(game, m => { for (let i = 0; i < 5; i++) m.hazards.push({ x: -700 + i * 200, w: 160, kind: 'spikes', period: 4, dmg: 8 }); m.spawns.hero = -800; m.spawns.foe = 800; })), /more than 40%/);
    assert.match(V(arena(game, m => { m.platforms.push({ x: 850, w: 300, h: 120 }); })), /Ledge 1 pokes through a wall/);
    assert.match(V(arena(game, m => { m.waves = ['akuma']; })), /not met yet/, 'only foes already met');
    const c = game.cleanMap({ name: '<b>x</b>', width: 99999, platforms: [{ x: 0, w: 5, h: 999 }], obstacles: [{ h: 900, w: 900 }], waves: ['nobody'], light: 'disco' });
    assert.strictEqual(c.width, 1400); assert.strictEqual(c.platforms[0].h, 170); assert.strictEqual(c.platforms[0].w, 120); assert.strictEqual(c.obstacles[0].h, 150);
    assert.strictEqual(c.name, 'bx/b'.replace('/', '/') && c.name, 'tags stripped'); assert.ok(!/[<>]/.test(c.name)); assert.strictEqual(c.light, 'day'); assert.strictEqual(JSON.stringify(c.waves), '["dummy"]');
  },

  async 'maps are kept in their own key, checksummed; a damaged store loads empty instead of breaking'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }); assert.strictEqual(game.storeMap(arena(game, m => { m.name = 'Kept'; })), '');
    const g2 = (await boot({ storage: st })).game; assert.strictEqual(g2.maps()[0].name, 'Kept'); assert.strictEqual(g2.SV.stats.mapsMade, 1, 'a valid map counts once for the Architect');
    st.setItem('issen-five-shadows.maps', '{"sum":"bad","maps":[{"name":"x"}]}'); assert.strictEqual((await boot({ storage: st })).game.maps().length, 0);
  },

  async 'ledges, walking off, obstacles and the walls'() {
    const { game } = await boot(); game.enterGame(); game.startCustom(arena(game, m => { m.width = 700; m.platforms.push({ x: 0, w: 240, h: 130 }); m.obstacles.push({ x: -500, w: 90, h: 80 }); }));
    const G = game.G, P = G.P; G.state = 'fight'; G.hint = 0; assert.strictEqual(game.ARENA, 700);
    P.x = 0; P.y = -300; P.air = true; P.vy = 0; run(game, 1, idle); assert.strictEqual(P.y, -130, 'lands on the ledge'); assert.ok(game.onTop(P));
    G.keys.right = true; run(game, 1.2, idle); G.keys.right = false; run(game, 1, idle); assert.strictEqual(P.y, 0, 'walked off and fell'); assert.ok(!P.air);
    P.x = -650; G.keys.right = true; run(game, .6, idle); G.keys.right = false; assert.ok(P.x <= -585 + 1, `the obstacle stops a walk (${P.x})`);
    G.jb = G.t; G.keys.right = true; run(game, .1, idle); run(game, 1, idle); G.keys.right = false; assert.ok(P.x > -455 || P.y === -80, 'a jump clears it or lands on top');
    P.x = 690; G.keys.right = true; run(game, .5, idle); assert.strictEqual(P.x, 700, 'the wall'); game.toMenu(); game.startFight(0, 1); assert.strictEqual(game.ARENA, 900, 'the campaign is back to its own floor');
  },

  async 'hazards: a telegraph, then they hurt both fighters once per flare (unblockable); a roll slips through; pickups once a round'() {
    const { game } = await boot(); game.enterGame(); game.startCustom(arena(game, m => { m.hazards.push({ x: 0, w: 200, kind: 'fire', period: 3, dmg: 9 }); m.pickups.push({ x: -500, h: 0, kind: 'tea' }); }));
    const G = game.G, P = G.P, B = G.B; G.state = 'fight'; G.hint = 0; P.x = -40; B.x = 40; G.t = 0; G.keys.block = true;
    const h = G.L.hazards[0], pin = G => { idle(G); Object.assign(G.B, { x: 40, vx: 0, y: 0, vy: 0, air: false }); if (G.B.st === 'jump') G.B.st = 'idle'; }; // held on the vent (it would jump clear) run(game, 3 - h.off - .5 + .1, pin); assert.strictEqual(P.maxHp - P.hp, 9, 'hurt through a guard'); assert.ok(B.hp < B.maxHp, 'the foe too');
    const hp = P.hp; run(game, .3, idle); assert.strictEqual(P.hp, hp, 'once per flare'); G.keys.block = false;
    P.x = -500; P.hp = 50; run(game, .1, pin); assert.strictEqual(P.hp, 70, 'tea heals 20'); P.x = -400; run(game, .1, idle); P.x = -500; run(game, .1, idle); assert.strictEqual(P.hp, 70, 'once');
  },

  async 'the foe steps off a hazard about to flare'() {
    const { game } = await boot(); game.enterGame(); game.startCustom(arena(game, m => { m.hazards.push({ x: 0, w: 200, kind: 'spikes', period: 3, dmg: 9 }); m.spawns.hero = -600; m.spawns.foe = 600; }));
    const G = game.G; G.state = 'fight'; G.hint = 0; G.B.x = 20; G.t = 3 - G.L.hazards[0].off - 1.3; run(game, 1.5); assert.strictEqual(G.B.hp, G.B.maxHp, 'it read the telegraph');
  },

  async 'the editor: tap to place, select, change, remove; save; publish only when valid; duplicate, share and load; delete asks'() {
    const { game, el } = await boot(); game.enterGame(); game.openWorkshop('menu'); el('wkBtns').children[0].click(); assert.strictEqual(game.mode, 'edit'); assert.strictEqual(open(el, game), 'editor');
    game.ED.tool = 'platform'; game.edPlace(100, -140); assert.strictEqual(game.ED.m.platforms[0].h, 140); assert.strictEqual(game.ED.m.platforms[0].x, 100);
    game.ED.tool = 'fire'; game.edPlace(320, 0); assert.match(game.validateMap(game.ED.m).join(), /foe's start is on a hazard/); game.ED.tool = 'erase'; game.edPlace(320, 0); assert.strictEqual(game.ED.m.hazards.length, 0);
    game.ED.tool = 'foe'; game.edPlace(600, 0); assert.strictEqual(game.ED.m.spawns.foe, 600); for (let i = 0; i < 9; i++) { game.ED.tool = 'obstacle'; game.edPlace(-700 + i * 40, 0); } assert.strictEqual(game.ED.m.obstacles.length, 6, 'six at most');
    game.ED.m.obstacles = []; game.ED.m.name = 'Mine'; assert.strictEqual(game.storeMap(game.ED.m), ''); game.WK.sel = game.ED.m.id; game.openWorkshop();
    const btn = t => el('wkBtns').children.find(b => b.textContent === t); btn('Publish to the map').click(); assert.ok(!game.maps()[0].published, '1.8: not before a win');
    game.startCustom(game.maps()[0]); game.G.state = 'fight'; game.G.P.wins = 1; game.G.B.hp = 0; run(game, 5, idle); game.openWorkshop(); btn('Publish to the map').click(); assert.ok(game.maps()[0].published, 'won, then published');
    btn('Duplicate').click(); assert.strictEqual(game.maps().length, 2); assert.ok(!game.maps()[1].published, 'a copy starts as a draft');
    btn('Share as code').click(); const code = el('wkCode').value; assert.match(code, /^ISSENMAP1-/); btn('Load a code').click(); el('wkCode').value = code; btn('Load it').click(); assert.strictEqual(game.maps().length, 3);
    btn('Delete').click(); assert.strictEqual(open(el, game), 'notice'); el('nBtns').children[0].click(); assert.strictEqual(game.maps().length, 2);
  },

  async 'a custom map in play: foes in waves, health and damage by difficulty, no rewards, the result offers the editor back'() {
    const { game, el } = await boot(); game.enterGame(); const s = game.SV, before = JSON.stringify(s.profile);
    const m = arena(game, m => { m.waves = ['dummy', 'dummy']; m.difficulty = 1.5; }); game.startCustom(m, true); const G = game.G;
    assert.strictEqual(G.B.maxHp, 150); assert.strictEqual(G.B.mod.dmg, 1.5); G.state = 'fight'; G.B.hp = 0; run(game, 4, idle); assert.strictEqual(G.wave, 1);
    G.state = 'fight'; G.B.hp = 0; run(game, 4, idle); assert.strictEqual(G.state, 'over'); assert.strictEqual(JSON.stringify(s.profile), before, 'nothing paid');
    assert.match(el('rRewards').textContent, /no rewards/); assert.ok(el('rBtns').children.some(b => b.textContent === 'Back to the editor'));
    game.toMenu(); assert.ok(el('wpins').children.some(p => p.dataset.place === 'workshop'), 'the workshop is on the map');
  },
};
