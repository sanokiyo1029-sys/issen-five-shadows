// 1.7 (part 2): the shop and the inventory. Purchases take exactly the price, only when they go through (and are saved);
// insufficient funds, owned items, full stacks and closed stock are refused with a reason; equipment changes the next fight;
// armour and weapon variants are sidegrades (the 2.0x budget holds); cosmetics change no number; supplies are used once.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
function rich(game, o = {}) { const s = game.SV; s.profile.mon = o.mon ?? 5000; s.profile.crystals = o.crystals ?? 500; s.progress.beaten = o.beaten ?? 5; s.progress.regionsUnlocked = 5; return s; }

module.exports = {
  async 'a purchase takes exactly the price, once; refusals say why and take nothing'() {
    const { game } = await boot(), s = rich(game, { mon: 700, crystals: 20 });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(game.buy(s, 'yari'))), { ok: true }); assert.strictEqual(s.profile.mon, 100); assert.ok(s.gear.owned.includes('yari')); assert.strictEqual(s.gear.tiers.yari, 1);
    assert.strictEqual(game.buy(s, 'yari').why, 'owned', 'no second copy'); assert.strictEqual(s.profile.mon, 100);
    assert.match(game.buy(s, 'kodachi').why, /^needs 500 more mon$/); assert.strictEqual(s.profile.mon, 100, 'nothing taken');
    assert.match(game.buy(s, 'finish_silver').why, /^needs 10 more shadow crystals$/, 'crystal items cost crystals');
    assert.strictEqual(game.buy(s, 'no_such_thing').why, 'not for sale'); assert.strictEqual(game.buy(s, 'healing_tea', 0).why, 'a quantity of 1 to 9');
    s.profile.crystals = 30; assert.ok(game.buy(s, 'finish_silver').ok); assert.strictEqual(s.profile.crystals, 0); assert.strictEqual(s.profile.mon, 100, 'mon untouched');
    s.profile.mon = 1000; assert.ok(game.buy(s, 'healing_tea', 9).ok); assert.strictEqual(s.profile.mon, 640); assert.strictEqual(game.buy(s, 'healing_tea').why, 'you can carry 9');
    assert.ok(game.buy(s, 'material').ok); assert.strictEqual(s.profile.materials, 1); assert.ok(s.profile.mon >= 0);
  },

  async 'stock opens with the journey'() {
    const { game } = await boot(), s = rich(game, { beaten: 0 }); s.progress.regionsUnlocked = 1;
    assert.match(game.buyBlock(s, 'yari'), /^sold after Gekkō falls$/); assert.match(game.buyBlock(s, 'crane_charm'), /^sold once you reach Bamboo Grove$/);
    assert.strictEqual(game.buyBlock(s, 'travel_haori'), '', 'some stock is there from the start'); assert.strictEqual(game.buyBlock(s, 'ember_katana'), 'not for sale', 'mode rewards are never sold');
  },

  async 'a purchase that cannot be saved is undone (the price is never taken for nothing)'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }), s = rich(game, { mon: 700 }); game.writeSave(s);
    st.setItem = () => { throw new Error('quota'); }; const r = game.buy(game.SV, 'yari');
    assert.strictEqual(r.ok, false); assert.match(r.why, /could not be written/); assert.strictEqual(game.SV.profile.mon, 700); assert.ok(!game.SV.gear.owned.includes('yari'));
  },

  async 'the shop screen: prices, comparison, confirmation, then equip; purchases survive a restart'() {
    const st = memoryStorage(), { game, el } = await boot({ storage: st }); rich(game, { mon: 800 }); game.enterGame();
    el('hMenu').children.find(b => b.innerHTML.startsWith('Shop')).click(); assert.strictEqual(open(el, game), 'shop'); assert.match(el('shPurse').textContent, /800 mon/);
    game.SH.sel = 'lamellar_do'; game.openShop(null, 'armour'); game.SH.sel = 'lamellar_do'; game.openShop();
    assert.match(el('shMore').textContent, /Against no armour: damage taken −6% ▲ · attack −6% ▼ · walk −4% ▼/);
    el('shActs').children[0].click(); assert.strictEqual(open(el, game), 'notice'); assert.match(el('nText').textContent, /from 800 to 350 mon/);
    el('nBtns').children[1].click(); assert.strictEqual(game.SV.profile.mon, 800, 'Cancel buys nothing');
    el('shActs').children[0].click(); el('nBtns').children[0].click(); assert.strictEqual(game.SV.profile.mon, 350); assert.match(el('shMsg').textContent, /Bought: Lamellar Dō/);
    el('shActs').children.find(b => b.textContent === 'Equip it').click(); assert.strictEqual(game.SV.gear.equipped.armour, 'lamellar_do');
    const again = (await boot({ storage: st })).game.SV; assert.strictEqual(again.profile.mon, 350); assert.strictEqual(again.gear.equipped.armour, 'lamellar_do');
    game.SV.story.pending = []; el('shClose').click(); assert.strictEqual(open(el, game), 'home'); // (the rich profile's achievements were announced on entering)
  },

  async 'equipment changes the next fight: armour, a variant weapon, and its traits'() {
    const { game } = await boot(), s = rich(game); s.gear.owned.push('lamellar_do', 'storm_yari'); s.gear.tiers.storm_yari = 1;
    game.equip(s, 'armour', 'lamellar_do'); let d = game.derive(s); near(d.mod.mit, .06, 'armour defence'); near(d.mod.dmg, .94, 'and its cost');
    game.equip(s, 'weapon', 'storm_yari'); d = game.derive(s); assert.strictEqual(d.cls, 'yari'); near(d.ov.slash.reach, game.MV.slash.reach * 1.42, 'a yari\'s reach'); assert.deepStrictEqual(JSON.parse(JSON.stringify(d.mod.tr)), { first: .25 });
    game.equip(s, 'armour', null); game.startFight(0, 1); const G = game.G; G.state = 'fight'; G.P.x = -100; G.B.x = 100; passive(G);
    G.buf = { a: 'slash', t: G.t }; run(game, .7, passive); const first = G.B.maxHp - G.B.hp; near(first, game.derive(s).ov.slash.dmg * 1.25 * .97, 'first hit +25%, stats -3%');
  },

  async 'armour and variants are sidegrades: the 2.0x budget holds with every armour, charm and weapon'() {
    const { game } = await boot(), B = game.PROG.power_budget, ids = Object.keys(game.POWERS), s = rich(game); s.profile.xp = 1e9; s.profile.level = 25;
    s.gear.owned = [...Object.keys(game.GEAR.weapons), ...Object.keys(game.GEAR.charms), ...Object.keys(game.GEAR.armour)]; for (const id in game.GEAR.weapons) s.gear.tiers[id] = 5; game.points(s);
    // a trait's share of a fight's damage, for the estimate: the first hit of ~10, the average momentum bonus, a burn against ~12 damage a second
    const trait = t => (1 + (t.first || 0) * .1) * (1 + (t.momentum ? t.momentum[1] * .6 : 0)) * (1 + (t.burn ? t.burn[0] / 12 : 0));
    const eff = () => { const m = game.derive(s), wdm = (m.ov.slash ? m.ov.slash.dmg / game.MV.slash.dmg : 1) * trait(m.mod.tr || {});
      return wdm * m.mod.dmg * (1 + m.mod.crit * (m.mod.critDmg - 1)) * m.mod.combo * m.hp / 100 / (1 - m.mod.mit) / (m.mod.skin ? 1 - m.mod.skin.reduce * B.iron_skin_share : 1); };
    const best = {}; let top = 0, at = null;
    for (const w of Object.keys(game.GEAR.weapons)) for (const armour of [null, ...Object.keys(game.GEAR.armour)]) for (const charm of [null, ...Object.keys(game.GEAR.charms)])
      for (const [a, v, sh] of [[20, 20, 8], [20, 18, 10], [20, 14, 14]]) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        Object.assign(s.profile.attrs, { assault: a, survival: v, shadowcraft: sh }); s.gear.equipped = { weapon: w, charm, armour, item: null }; s.loadout.echoes = [ids[i], ids[j]];
        const e = eff(); best[w] = Math.max(best[w] || 0, e); if (w === 'katana' || game.GEAR.weapons[w].class === 'katana') if (e > top) { top = e; at = { w, armour, charm }; }
      }
    assert.ok(top <= B.max + 1e-9, `katana-class best ${top.toFixed(3)}x with ${JSON.stringify(at)}`);
    for (const [w, x] of Object.entries(game.GEAR.weapons)) if (x.class) assert.ok(best[w] <= best[x.class] + 1e-9, `${w} (${best[w].toFixed(3)}) must not beat its class ${x.class} (${best[x.class].toFixed(3)})`);
  },

  async 'cosmetics change the look, never a number'() {
    const { game } = await boot(), s = rich(game); const before = JSON.stringify(game.derive(s).mod);
    for (const id of ['finish_gold', 'trail_crimson', 'aura_ember', 'robe_indigo']) { assert.ok(game.buy(s, id).ok, id); assert.ok(game.equipAny(s, id), id); }
    assert.strictEqual(JSON.stringify(game.derive(s).mod), before); const d = game.heroDef();
    assert.strictEqual(d.kind.bc, '#9c7a2a'); assert.strictEqual(d.trail, '#b5301c'); assert.strictEqual(d.aura, '181,48,28'); assert.strictEqual(d.kind.ink, '#161b2a');
    assert.strictEqual(game.wear(s, 'trail', 'finish_gold'), false, 'a finish is not a trail'); assert.strictEqual(game.wear(s, 'aura', 'aura_moon'), false, 'not owned');
    game.startFight(0, 1); for (let i = 0; i < 30; i++) { game.G.rdt = 1 / 60; game.renderGame(); }
  },

  async 'supplies: chosen in the inventory, working through one fight, charged when they first work (the bell; the tea when it heals)'() {
    const { game } = await boot(), s = rich(game); game.buy(s, 'whetstone', 2); game.buy(s, 'healing_tea', 1); game.buy(s, 'focus_incense', 1);
    game.equip(s, 'item', 'whetstone'); game.startFight(0, 1); let G = game.G; near(G.P.mod.dmg, game.derive(s).mod.dmg * 1.06, 'whetstone');
    G.P.wins = 1; G.B.hp = 0; G.state = 'fight'; run(game, 4, passive); assert.strictEqual(s.gear.items.whetstone, 1, 'one used, at the bell');
    game.equip(s, 'item', 'focus_incense'); game.startFight(0, 1); G = game.G; assert.ok(G.P.ink >= 33.3, 'incense: an ink bar at the bell');
    game.G.state = 'over'; game.toMenu(); game.equip(s, 'item', 'healing_tea'); game.startFight(0, 1); G = game.G; G.state = 'fight'; passive(G);
    G.P.hp = 35; G.P.x = -100; G.B.x = 100; game.startMove(G.B, 'g_thrust'); run(game, .6, passive); near(G.P.hp, 35 - 9 + 20, 'below 30%: the tea restores 20');
    const hp = G.P.hp; G.P.hp = 25; game.startMove(G.B, 'g_thrust'); run(game, .7, passive); assert.ok(G.P.hp < 25, 'only once');
    assert.strictEqual(s.gear.items.focus_incense, undefined, 'incense worked at the bell: leaving the fight does not give it back'); assert.strictEqual(s.gear.items.healing_tea, undefined, 'the tea, once it healed');
  },

  async 'the inventory shows weapons, armour, charms, supplies and cosmetics'() {
    const { game, el } = await boot(), s = rich(game); game.buy(s, 'shinobi_garb'); game.buy(s, 'trail_gold'); game.buy(s, 'whetstone', 3); game.enterGame();
    el('hMenu').children.find(b => b.innerHTML.startsWith('Inventory')).click(); assert.strictEqual(open(el, game), 'char'); assert.strictEqual(game.CH.tab, 'gear');
    for (const [v, t] of [['weapons', 'Storm Yari'], ['armour', 'Shinobi Garb'], ['supplies', 'Whetstone'], ['cosmetics', 'Gold Wake']]) {
      game.CH.gv = v; game.openChar(); assert.ok(el('cBody').children.some(c => c.innerHTML.includes(t)), `${v} shows ${t}`); }
    game.CH.gv = 'armour'; game.openChar(); el('cBody').children.find(c => c.innerHTML.includes('Shinobi Garb')).click(); assert.strictEqual(game.SV.gear.equipped.armour, 'shinobi_garb');
    game.CH.gv = 'cosmetics'; game.openChar(); el('cBody').children.find(c => c.innerHTML.includes('Gold Wake')).click(); assert.strictEqual(game.SV.gear.cos.trail, 'trail_gold');
    game.CH.gv = 'supplies'; game.openChar(); el('cBody').children.find(c => c.innerHTML.includes('Whetstone')).click(); assert.strictEqual(game.SV.gear.equipped.item, 'whetstone');
  },
};
