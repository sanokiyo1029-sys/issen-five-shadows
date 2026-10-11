// M7 (spec §6, §12): weapon classes are sidegrades with their own handling, gear comes from fixed rewards, upgrades cost mon
// and materials, the gear screen equips and compares, and bosses stay identical whatever the hero carries.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
function prof(game, weapon = 'katana', extra = {}) {
  const s = game.migrate(JSON.stringify({ beaten: 5 })).save; s.story.pending = [];
  s.gear = { owned: ['katana', ...Object.keys(game.GEAR.weapons).filter(w => w !== 'katana'), ...Object.keys(game.GEAR.charms)], equipped: { weapon, charm: null }, tiers: Object.fromEntries(Object.keys(game.GEAR.weapons).map(w => [w, 1])) };
  Object.assign(s.gear.equipped, extra.equipped || {}); Object.assign(s.gear.tiers, extra.tiers || {}); s.loadout = { powers: [null, null], echoes: [null, null] }; game.points(s); return s;
}
async function duel(weapon, lv = 0, xs = [-100, 100]) { const { game } = await boot(), G = game.G; game.SV = prof(game, weapon); game.startFight(lv, 1); G.state = 'fight'; G.P.x = xs[0]; G.B.x = xs[1]; passive(G); return { game, G, P: G.P, B: G.B }; }
const press = (G, a, dir = 0) => { G.keys.right = dir > 0; G.keys.left = dir < 0; G.buf = { a, t: G.t }; };

module.exports = {
  async 'the katana at tier I changes nothing; every class differs in two stats and handling, and none is strictly better'() {
    const { game } = await boot(), MV = game.MV;
    assert.deepStrictEqual(Object.keys(game.derive(prof(game)).ov), [], 'katana I: no move overrides');
    for (const id of ['yari', 'kodachi', 'kanabo', 'naginata', 'nodachi']) {
      const s = game.derive(prof(game, id)).ov.slash, k = MV.slash, r = { reach: s.reach / k.reach, dmg: s.dmg / k.dmg, startup: s.hit[0][0] / k.hit[0][0] };
      const differs = Object.values(r).filter(v => Math.abs(v - 1) >= .1).length;
      assert.ok(differs >= 2, `${id} differs in ${differs} stats: ${JSON.stringify(r)}`);
      assert.ok(game.GEAR.weapons[id].tag && game.GEAR.weapons[id].tag !== 'balanced', `${id} has a handling trait`);
      assert.ok(r.reach < 1 || r.dmg < 1 || r.startup > 1, `${id} is not strictly better than the katana`);
    }
  },

  async 'handling: the yari pays for a whiff; kodachi chain four and gain ink; the naginata ignores height; the kanabō armors and floors; the nodachi lunges'() {
    let { game, G, P, B } = await duel('yari', 0, [-600, 600]); press(G, 'slash'); let t = 0;
    run(game, 1.2, G => { passive(G); G.buf = G.buf && G.buf.a === 'slash' && G.t > .05 ? null : G.buf; if (P.st === 'move') t = P.mvT; });
    near(t, P.moves.slash.dur + .15, 'a whiffed yari slash recovers 0.15 s later', 1 / 30);
    ({ game, G, P, B } = await duel('kodachi', 0, [-70, 70])); const seen = new Set();
    run(game, 1.6, (G, i) => { passive(G); if (i % 5 === 0) G.buf = { a: 'slash', t: G.t }; if (P.st === 'move') seen.add(P.mvn); B.st = B.st === 'hit' ? 'idle' : B.st; });
    assert.ok(seen.has('slash4'), `four-hit chain (${[...seen]})`);
    ({ game, G, P, B } = await duel('kodachi', 0, [-70, 70])); press(G, 'slash'); run(game, .3, passive); near(P.ink, 9 * 1.3, 'kodachi: 30% more ink');
    ({ game, G, P, B } = await duel('naginata', 0, [-100, 140])); press(G, 'slash'); run(game, .2, passive); press(G, 'slash'); // slash2: an arc, not a high cut
    run(game, .8, G => { passive(G); G.B.crouch = true; }); assert.ok(B.hp < B.maxHp - 5, 'the naginata\'s second swing hits a crouching foe');
    const k = await duel('katana', 0, [-70, 70]); press(k.G, 'slash'); run(k.game, .2, passive); press(k.G, 'slash'); const hp = k.B.hp;
    run(k.game, .8, G => { passive(G); G.B.crouch = true; }); assert.strictEqual(k.B.hp, hp, 'where the katana\'s high second cut whiffs');
    ({ game, G, P, B } = await duel('kanabo', 0, [-100, 100])); P.st = 'idle'; P.next = null;
    game.startMove(P, 'slash3'); game.startMove(B, 'g_thrust'); let staggered = false;
    run(game, P.moves.slash3.hit[0][0] - .02, G => { passive(G); if (P.st === 'hit') staggered = true; });
    assert.strictEqual(staggered, false, 'kanabō III: hyper-armor through the windup'); run(game, .6, passive); assert.ok(['down', 'getup'].includes(B.st) || B.hp < B.maxHp, 'and it lands');
    ({ game, G, P, B } = await duel('nodachi', 0, [-300, 300])); const x0 = P.x; game.startMove(P, 'slash3'); run(game, .6, passive);
    assert.ok(P.x - x0 > 80, `nodachi III lunges (${(P.x - x0).toFixed(0)} px)`);
  },

  async 'gear comes from fixed rewards: elites give weapons, second duels and trials give charms; upgrades cost mon and materials'() {
    const { game } = await boot(), s = game.migrate(JSON.stringify({ beaten: 0 })).save;
    assert.deepStrictEqual(JSON.parse(JSON.stringify(s.gear)), { owned: ['katana'], equipped: { weapon: 'katana', charm: null }, tiers: { katana: 1 } });
    game.grantStep(s, 0, 0); game.grantStep(s, 0, 1); assert.ok(s.gear.owned.includes('straw_charm'), 'the second duel gives a charm');
    game.grantStep(s, 0, 2); assert.ok(s.gear.owned.includes('yari') && s.gear.tiers.yari === 1, 'the elite gives its weapon');
    assert.strictEqual(s.profile.materials, 1);
    assert.ok(game.equip(s, 'weapon', 'yari')); assert.strictEqual(game.equip(s, 'weapon', 'nodachi'), false, 'not owned');
    assert.ok(game.equip(s, 'charm', 'straw_charm')); assert.strictEqual(game.derive(s).hp, Math.round(100 * 1.03));
    const mon = s.profile.mon, c = game.GEAR.weapon_tiers[0];
    assert.ok(game.upgradeWeapon(s, 'yari')); assert.strictEqual(s.gear.tiers.yari, 2); assert.strictEqual(s.profile.mon, mon - c.mon); assert.strictEqual(s.profile.materials, 0);
    assert.match(game.weaponBlock(s, 'yari'), /mon|material/, 'the next tier waits for mon and materials');
    const base = game.derive(Object.assign({}, s, { gear: Object.assign({}, s.gear, { tiers: { yari: 1 } }) })).ov.slash.dmg;
    near(game.derive(s).ov.slash.dmg, base * 1.05, 'tier II: +5% damage');
  },

  async 'effective power with gear stays at or below 2.0x a level-1 hero'() {
    const { game } = await boot(), B = game.PROG.power_budget, ids = Object.keys(game.POWERS);
    const s = prof(game, 'katana'); s.profile.xp = 1e9; s.profile.level = 25; game.points(s);
    let best = 0, at = null;
    for (const charm of [null, ...Object.keys(game.GEAR.charms)]) for (const [a, v, sh] of [[20, 20, 8], [20, 18, 10], [20, 14, 14], [16, 20, 12]]) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      Object.assign(s.profile.attrs, { assault: a, survival: v, shadowcraft: sh }); s.gear.equipped = { weapon: 'katana', charm }; s.gear.tiers.katana = 5; s.loadout.echoes = [ids[i], ids[j]];
      const m = game.derive(s), wdm = (m.ov.slash ? m.ov.slash.dmg / game.MV.slash.dmg : 1), e = wdm * m.mod.dmg * (1 + m.mod.crit * (m.mod.critDmg - 1)) * m.mod.combo * m.hp / 100 / (1 - m.mod.mit) / (m.mod.skin ? 1 - m.mod.skin.reduce * B.iron_skin_share : 1);
      if (e > best) { best = e; at = { charm, a, v, sh, echoes: [ids[i], ids[j]] }; }
    }
    assert.ok(best <= B.max, `best with gear ${best.toFixed(3)}x: ${JSON.stringify(at)}`);
  },

  async 'the gear screen equips, upgrades and compares'() {
    const { game, el } = await boot(); game.SV = prof(game); game.SV.profile.materials = 3; game.enterGame();
    game.CH.tab = 'gear'; game.CH.gv = 'weapons'; game.openChar(null, 'menu');
    const cards = () => el('cBody').children, find = (list, t) => [...list].find(x => x.textContent.includes(t));
    assert.strictEqual(cards().length, 6, 'six weapons');
    find(cards()[1].children, 'Equip').click(); assert.strictEqual(game.SV.gear.equipped.weapon, 'yari');
    find(cards()[1].children, 'Upgrade').click(); assert.strictEqual(game.SV.gear.tiers.yari, 2);
    assert.match(game.weaponDelta(game.SV, 'kanabo', 'yari'), /damage \+\d+% ▲/);
    assert.match(game.statDelta({ attack: .06 }, { hp: .03 }), /attack \+6% ▲ · health −3% ▼/);
    game.CH.gv = 'charms'; game.openChar(); cards()[2].click(); assert.ok(game.SV.gear.equipped.charm);
  },

  async 'every weapon against every boss: fights finish; bosses never change'() {
    for (const w of ['yari', 'kodachi', 'kanabo', 'naginata', 'nodachi']) for (let lv = 0; lv < 5; lv++) {
      const { game } = await boot({ seed: lv + 40 }), G = game.G; game.SV = prof(game, w); game.startFight(lv, 9 + lv);
      run(game, 400, (G, i) => { const d = G.B.x - G.P.x; G.keys.right = d > 200; G.keys.left = d < -200; if (i % 18 === 0 && Math.abs(d) < 260) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : i % 72 === 0 ? 'kick' : 'slash', t: G.t }; });
      assert.strictEqual(G.state, 'over', `${w} vs ${game.BOSSES[lv].id}`); assert.deepStrictEqual(Object.keys(G.B.moves), []);
    }
  },
};
