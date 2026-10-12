// 1.7 (part 5): the world map and missions. A marker per place (locked ones say why), a rewards preview, panning; a hidden
// road found once (Ashen Village); missions open in order, pay once, and gauntlets carry the hero's health from foe to foe.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const pin = (el, id) => el('wpins').children.find(p => p.dataset.place === id);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const win = (game, G) => { G.state = 'fight'; G.B.hp = 0; run(game, 4, passive); };
function opened(game) { const s = game.SV; game.setToday(() => '2000-01-01'); s.daily = { day: '2000-01-01', ids: ['parry3'], base: { parries: 0 } }; // no daily pays during these tests
  for (let i = 0; i < 3; i++) game.grantStep(s, 0, i, 's' + i); game.grantClear(s, 0, 'b0'); game.grantClear(s, 1, 'b1'); return s; }

module.exports = {
  async 'the map: a marker per place, locked ones dashed and explained, a preview with the rewards still to earn'() {
    const { game, el } = await boot(); game.enterGame(); game.toMenu();
    assert.deepStrictEqual(el('wpins').children.map(p => p.dataset.place), ['dojo', 'burning_field', 'bamboo_grove', 'mountain_shrine', 'moonlit_lake', 'oni_castle'], 'the secret and the modes stay hidden');
    assert.ok(pin(el, 'bamboo_grove').className.includes('locked')); assert.ok(pin(el, 'burning_field').className.includes('next'), 'the next road pulses');
    pin(el, 'bamboo_grove').click(); assert.match(el('wiText').textContent, /Defeat Gekkō to open this road/); assert.strictEqual(el('wiBtns').children[0].disabled, true);
    pin(el, 'burning_field').click(); assert.match(el('wiRew').textContent, /Still to earn here: 7,650 XP · 505 mon · 40 shadow crystals/); assert.match(el('wiPips').textContent, /Difficulty ●○○○○ · 0% complete/);
    el('wiBtns').children[0].click(); assert.strictEqual(open(el, game), 'notice', 'the region opens (its story card first)');
    game.toMenu(); pin(el, 'dojo').click(); el('wiBtns').children[0].click(); assert.strictEqual(game.G.arena, game.DOJO_A, 'the dojo marker trains');
  },

  async 'panning: arrows, focus and clamping'() {
    const { game, el } = await boot(); game.enterGame(); game.toMenu(); const WM = game.WM;
    el('wR').click(); assert.ok(WM.tx > WM.x - 1); WM.x = 99999; game.renderWorld(0); assert.strictEqual(WM.x, game.WORLD.width - 1920, 'clamped east');
    pin(el, 'dojo').onfocus(); for (let i = 0; i < 120; i++) { game.G.rdt = 1 / 60; game.renderWorld(i / 60); } assert.strictEqual(WM.x, 0, 'focusing the dojo pans west');
  },

  async 'the hidden road: found once, after two shadows and every Burning Field duel; it pays the Wanderer once'() {
    const { game, el } = await boot(); const s = game.SV; game.grantClear(s, 0, 'b0'); game.grantClear(s, 1, 'b1'); game.award(s); assert.ok(!s.world.secret, 'the field\'s duels are still open');
    for (let i = 0; i < 3; i++) game.grantStep(s, 0, i, 's' + i); const got = game.award(s);
    assert.ok(s.world.secret); assert.ok(got.some(x => /hidden road/.test(x.text))); assert.ok(got.some(x => /Wanderer/.test(x.text)));
    assert.strictEqual(game.award(s).length, 0, 'once'); s.story.pending = []; game.enterGame(); game.toMenu(); assert.ok(pin(el, 'ashen'), 'Ashen Village is on the map');
  },

  async 'missions open in order, pay once (a repeat pays a quarter of the XP), and a loss changes nothing'() {
    const { game, el } = await boot(), s = opened(game); s.story.seen.push('ashen'); game.enterGame();
    assert.strictEqual(JSON.stringify(game.locNodes(s, 'ashen').map(n => n.open)), '[true,false,false]');
    const xp0 = s.profile.xp, m0 = s.profile.mon; game.startMission('ashen', 0, 1); win(game, game.G);
    assert.ok(s.rewardsClaimed['ashen:0']); assert.strictEqual(s.profile.xp, xp0 + 600); assert.strictEqual(s.profile.mon, m0 + 60); assert.strictEqual(open(el, game), 'result');
    assert.strictEqual(JSON.stringify(game.locNodes(s, 'ashen').map(n => n.open)), '[true,true,false]');
    game.startMission('ashen', 0, 2); win(game, game.G); assert.strictEqual(s.profile.xp, xp0 + 600 + 150, 'a repeat pays a quarter'); assert.strictEqual(s.profile.mon, m0 + 60);
    const before = JSON.stringify(s.profile); game.startMission('ashen', 1, 3); const G = game.G; G.state = 'fight'; G.P.hp = 0; run(game, 4, passive);
    assert.strictEqual(G.state, 'over'); assert.strictEqual(JSON.stringify(s.profile), before, 'a loss pays nothing and takes nothing');
  },

  async 'a gauntlet: the next foe steps in, the hero keeps health and ink; the champion pays its crystals and item once'() {
    const { game } = await boot(), s = opened(game); s.rewardsClaimed['ashen:0'] = 1; game.enterGame(); game.startMission('ashen', 1, 1); const G = game.G;
    assert.deepStrictEqual([...G.waves.map(d => d.id)], ['ash_bandit', 'cutthroat', 'thrower']);
    G.state = 'fight'; G.P.hp = 61; G.P.ink = 40; G.B.hp = 0; run(game, 4, passive); assert.strictEqual(G.wave, 1); assert.strictEqual(G.def.id, 'cutthroat');
    assert.strictEqual(G.P.hp, 61, 'health carries over'); assert.ok(G.P.ink >= 40); assert.strictEqual(G.B.hp, G.B.maxHp, 'a fresh foe');
    G.state = 'fight'; G.B.hp = 0; run(game, 4, passive); G.state = 'fight'; G.B.hp = 0; run(game, 4, passive); assert.strictEqual(G.state, 'over'); assert.ok(s.rewardsClaimed['ashen:1']);
    const c0 = s.profile.crystals; game.startMission('ashen', 2, 1); G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; run(game, 4, passive);
    assert.ok(s.gear.owned.includes('ash_charm')); assert.ok(s.profile.crystals >= c0 + 15);
  },

  async 'Continue resumes a location after a restart; completion counts every place'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }), s = opened(game); s.story.seen.push('ashen'); s.story.pending = []; game.writeSave(s); game.enterGame(); game.openLoc('ashen');
    const b = await boot({ storage: st }); b.game.SV.story.pending = []; b.game.enterGame(); assert.match(b.el('hMenu').children[0].innerHTML, /^Continue<small>Ashen Village/);
    b.el('hMenu').children[0].click(); assert.strictEqual(b.el('gTitle').textContent, 'Ashen Village'); assert.ok(b.game.mapDone(b.game.SV) > 0);
  },
};
