// M4 (spec §7, §9): attributes with diminishing returns, derived stats in combat, the effective-power budget, skill points,
// power tiers, echo slots and their effects, loadout rules. Bosses never change.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { boot, run, memoryStorage } = require('../tools/harness');

const eq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const bot = (G, i) => { const d = G.B.x - G.P.x, k = G.keys; k.right = d > 165; k.left = d < -165;
  if (i % 18 === 0 && Math.abs(d) < 200) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : i % 72 === 0 ? 'kick' : 'slash', t: G.t }; };
const end = G => JSON.parse(JSON.stringify({ state: G.state, t: G.t, P: [G.P.hp, G.P.x, G.P.ink, G.P.wins], B: [G.B.hp, G.B.x, G.B.ink, G.B.wins] }));

/** A save with `beaten` bosses (through the real claims), optionally at a given XP, ranks, tiers and loadout. */
function profile(game, { beaten = 5, xp, attrs, tiers, powers, echoes } = {}) {
  const s = game.migrate(JSON.stringify({ beaten })).save;
  if (xp != null) { s.profile.xp = xp; s.profile.level = game.levelOf(xp).level; }
  if (attrs) Object.assign(s.profile.attrs, attrs);
  if (tiers) for (const [id, t] of Object.entries(tiers)) s.powers[id].tier = t;
  if (powers) s.loadout.powers = powers;
  if (echoes) s.loadout.echoes = echoes;
  game.points(s); return s;
}
/** Start a fight with save `s` against boss `lv`; the boss stands still at distance d. */
function duel(game, s, lv, d = 300) {
  game.SV = s; game.startFight(lv, 1); const G = game.G; G.state = 'fight'; G.st = 0; G.P.x = -d / 2; G.B.x = d / 2; passive(G); return G;
}
const strike = (G, game, a, frames = 40) => { G.buf = { a, t: G.t }; run(game, frames / 60, passive); };

module.exports = {
  async 'a level-1 hero fights exactly like HERO_D: no hidden modifiers'() {
    const a = await boot({ seed: 4 }); a.game.enterGame(); a.game.startFight(2, 99); run(a.game, 120, bot);
    const b = await boot({ seed: 4 }), g = b.game; g.enterGame(); g.startFight(2, 99);
    g.G.P = g.mkF(Object.assign({}, g.HERO_D, { powers: [null, null] }), true); g.G.round = 1; g.newRound(); run(g, 120, bot);
    eq(end(a.game.G), end(g.G));
  },

  async 'attributes: diminishing returns, a rank cap of 20, points earned by level, a free reset'() {
    const { game } = await boot(), A = game.PROG.attributes;
    near(game.attrBonus('assault', 'damage', 20), A.assault.damage * (1 - Math.exp(-2)), 'rank 20 gives 86.5 % of the cap');
    const steps = [0, 5, 10, 15, 20].map(r => game.attrBonus('survival', 'hp', r));
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1] && (i < 2 || steps[i] - steps[i - 1] < steps[i - 1] - steps[i - 2]), 'rising, by less each step');
    const s = profile(game, { beaten: 0, xp: 1703 }); // level 5: 8 points
    assert.strictEqual(s.profile.level, 5); assert.strictEqual(s.profile.attrPts, 8);
    for (let i = 0; i < 8; i++) assert.ok(game.spendAttr(s, 'assault'));
    assert.strictEqual(game.spendAttr(s, 'survival'), false, 'no points left'); assert.strictEqual(s.profile.attrs.assault, 8);
    game.resetAttrs(s); assert.strictEqual(s.profile.attrPts, 8); assert.strictEqual(s.profile.attrs.assault, 0);
    const top = profile(game, { xp: 1e9 }); // level 25: 48 points
    assert.strictEqual(top.profile.attrPts, 48);
    let n = 0; while (game.spendAttr(top, 'shadowcraft')) n++;
    assert.strictEqual(n, A.rank_cap, 'a path stops at its rank cap'); assert.strictEqual(top.profile.attrPts, 48 - A.rank_cap);
  },

  async 'derived stats reach combat: HP, attack, chain bonus, crits, mitigation, cooldowns, roll, ink'() {
    const { game } = await boot(), s = profile(game, { xp: 1e9, attrs: { assault: 20, survival: 20, shadowcraft: 8 }, powers: ['red_moon', null] }), d = game.derive(s);
    assert.strictEqual(d.hp, Math.round(100 * (1 + game.attrBonus('survival', 'hp', 20))));
    const G = duel(game, s, 0, 150), P = G.P, B = G.B;
    assert.strictEqual(P.maxHp, d.hp); assert.ok(Math.abs(P.def.speed - 340 * (1 + game.attrBonus('shadowcraft', 'speed', 8))) < 1e-9);
    strike(G, game, 'slash', 12); const one = B.maxHp - B.hp; // slash, then slash again inside the chain window: slash2
    assert.ok([7, 10.5].some(v => Math.abs(one - v * d.mod.dmg) < 1e-9), `slash dealt ${one}: attack x${d.mod.dmg.toFixed(3)} (a crit is x1.5)`);
    near(P.ink, 9 * d.mod.ink, 'ink gain scaled');
    strike(G, game, 'slash', 40); const two = B.maxHp - B.hp - one;
    assert.ok([8, 12].some(v => Math.abs(two - v * d.mod.dmg * d.mod.combo) < 1e-9), `slash2 dealt ${two}: chain bonus x${d.mod.combo.toFixed(3)}`);
    const P2 = duel(game, s, 0, 200).P; game.startMove(G.B, 'g_thrust'); run(game, 1, passive);
    near(P2.maxHp - P2.hp, 9 * (1 - d.mod.mit), 'mitigation');
    const G3 = duel(game, s, 0, 900); G3.P.ink = 100; strike(G3, game, 'power1', 2);
    near(G3.P.cd.p_red_moon - G3.t + G3.P.mvT, 4 * d.mod.cd, 'power cooldown reduced');
    run(game, 1.5, passive); strike(G3, game, 'roll', 2);
    near(G3.P.rollCd - G3.t + G3.P.stT, .7 * d.mod.roll, 'roll cooldown reduced');
  },

  async 'effective power: the best build stays within budget (<= 1.75x from attributes and echoes, <= 2.0x overall)'() {
    const { game } = await boot(), B = game.PROG.power_budget, ids = Object.keys(game.POWERS), s = profile(game, { xp: 1e9 });
    let best = { v: 0 };
    for (let a = 0; a <= 20; a++) for (let v = 0; v <= 20; v++) for (const sh of [0, 8, 20]) {
      if (a + v + sh > 48) continue;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        Object.assign(s.profile.attrs, { assault: a, survival: v, shadowcraft: sh }); s.loadout.powers = [null, null]; s.loadout.echoes = [ids[i], ids[j]];
        const m = game.derive(s), dmg = m.mod.dmg * (1 + m.mod.crit * (m.mod.critDmg - 1)) * m.mod.combo,
          surv = m.hp / 100 / (1 - m.mod.mit) / (m.mod.skin ? 1 - m.mod.skin.reduce * B.iron_skin_share : 1), e = dmg * surv;
        if (e > best.v) best = { v: e, a, s: v, sh, echoes: [ids[i], ids[j]] };
      }
    }
    assert.ok(best.v <= B.attributes_and_echoes && B.attributes_and_echoes <= B.max, `best build ${best.v.toFixed(3)}x: ${JSON.stringify(best)}`);
    assert.ok(best.v > 1.5, 'and growth is still worth having');
  },

  async 'skill points: first clears plus milestone levels; an older save is paid its milestone on load'() {
    const { game } = await boot(), R = game.PROG.rewards;
    const s = profile(game, { beaten: 5 });
    assert.strictEqual(s.profile.level, 8); assert.strictEqual(s.profile.skillPts, Object.values(R).reduce((a, r) => a + r.skill_points, 0) + 1, 'six from bosses, one for level 5');
    const old = profile(game, { beaten: 5 }); old.profile.skillPts = 6; // an M3 save stored 6
    assert.strictEqual(game.cleanSave(JSON.parse(JSON.stringify(old))).profile.skillPts, 7);
  },

  async 'power tiers: skill points and mon, in order; IV needs the Ink Trial; a power not yet absorbed cannot be upgraded'() {
    const { game } = await boot(), s = profile(game, { beaten: 3 }), T = game.PROG.power_tiers; // level 5: 3 + 1 skill points, 450 mon
    assert.strictEqual(s.profile.skillPts, 4); assert.strictEqual(s.profile.mon, 450);
    assert.ok(game.upgradePower(s, 'red_moon')); assert.strictEqual(s.powers.red_moon.tier, 2);
    assert.strictEqual(s.profile.skillPts, 4 - T[0].sp); assert.strictEqual(s.profile.mon, 450 - T[0].mon);
    assert.ok(game.upgradePower(s, 'red_moon')); assert.strictEqual(s.powers.red_moon.tier, 3); assert.strictEqual(s.profile.skillPts, 1);
    assert.strictEqual(game.upgradePower(s, 'red_moon'), false); assert.match(game.tierBlock(s, 'red_moon'), /Ink Trial/);
    assert.ok(game.upgradePower(s, 'miststep'), 'every absorbed power can be upgraded (M5)'); assert.strictEqual(s.profile.skillPts, 0);
    assert.match(game.tierBlock(s, 'phantom_edge'), /not absorbed/);
    const poor = profile(game, { beaten: 1 }); poor.profile.mon = 10;
    assert.match(game.tierBlock(poor, 'red_moon'), /mon/);
  },

  async 'tier II reaches further and hits harder; tier III breaks hyper-armor and doubles block pushback'() {
    const { game } = await boot(), base = game.HERO_MV.p_red_moon;
    const t2 = game.derive(profile(game, { beaten: 1, tiers: { red_moon: 2 }, powers: ['red_moon', null] })).ov.p_red_moon;
    assert.strictEqual(t2.reach, base.reach + 20); assert.strictEqual(t2.dmg, base.dmg + 2);
    const armor = tier => { // Tetsugorō winds up m_smash (armor to 0.5 s); the Red Moon lands during the armor
      const s = profile(game, { beaten: 3, tiers: { red_moon: tier }, powers: ['red_moon', null] }), G = duel(game, s, 2, 300);
      game.startMove(G.B, 'm_smash'); G.P.ink = 100; G.buf = { a: 'power1', t: G.t }; let st = null;
      run(game, .45, G => { passive(G); if (G.B.hp < G.B.maxHp && !st) st = G.B.st; });
      return st;
    };
    assert.strictEqual(armor(1), 'move', 'tier I: the armor holds'); assert.strictEqual(armor(3), 'hit', 'tier III: the armor breaks');
    const push = tier => {
      const s = profile(game, { beaten: 3, tiers: { red_moon: tier }, powers: ['red_moon', null] }), G = duel(game, s, 0, 300);
      G.P.ink = 100; G.buf = { a: 'power1', t: G.t }; let vx = 0;
      run(game, .45, G => { passive(G); G.B.block = true; G.B.st = G.B.st === 'bstun' ? 'bstun' : 'idle'; if (G.B.st === 'bstun' && !vx) vx = Math.abs(G.B.vx); });
      return vx;
    };
    const p1 = push(1), p3 = push(3);
    assert.ok(p1 > 0 && Math.abs(p3 / p1 - 2) < .05, `block pushback ${p1} -> ${p3}`);
  },

  async 'slots: echoes open at levels 8 and 14; a power fills one kind of slot; the loadout persists; nothing changes mid-fight'() {
    const st = memoryStorage(), { game } = await boot({ storage: st });
    const s7 = profile(game, { beaten: 4 }); // 5,500 XP: level 7
    assert.strictEqual(s7.profile.level, 7); assert.strictEqual(game.setSlot(s7, 'echoes', 0, 'miststep'), false, 'echo slot 1 opens at level 8');
    const s = profile(game, { beaten: 5 }); // level 8
    assert.ok(game.setSlot(s, 'echoes', 0, 'iron_resolve')); assert.strictEqual(game.setSlot(s, 'echoes', 1, 'miststep'), false, 'echo slot 2 opens at level 14');
    assert.ok(game.setSlot(s, 'powers', 1, 'miststep'), 'power slot 2 is open from level 6'); assert.strictEqual(game.setSlot(s7, 'powers', 1, 'nothing'), false, 'only absorbed powers');
    eq(s.loadout.powers, ['red_moon', 'miststep']); assert.ok(game.setSlot(s, 'echoes', 0, 'red_moon')); assert.ok(game.setSlot(s, 'powers', 1, null));
    eq(s.loadout, { powers: [null, null], echoes: ['red_moon', null] }, 'it moved from the power slot to the echo slot');
    game.SV = s; game.writeSave(s);
    const again = await boot({ storage: st }); eq(again.game.SV.loadout, { powers: [null, null], echoes: ['red_moon', null] }, 'persists across a restart');
    const G = duel(game, s, 0, 600), before = JSON.stringify([G.P.def.echoes, G.P.def.powers, G.P.mod]);
    game.setSlot(s, 'echoes', 0, null); game.setSlot(s, 'powers', 0, 'red_moon'); game.spendAttr(s, 'assault');
    assert.strictEqual(JSON.stringify([G.P.def.echoes, G.P.def.powers, G.P.mod]), before, 'the fighter in a running fight keeps the loadout it started with');
  },

  async 'echoes work in combat: Red Moon Reach, Light Step, Iron Skin, Pale Reflection, Ember of Rage'() {
    const { game } = await boot(), at = (echo, lv = 0, d = 300) => duel(game, profile(game, { xp: 1e9, echoes: [echo, null] }), lv, d);
    let G = at('red_moon'); assert.strictEqual(G.P.moves.lunge.reach, 175 * 1.08); assert.strictEqual(game.MV.lunge.reach, 175, 'MV untouched');
    G = at('miststep'); assert.ok(Math.abs(G.P.def.speed - 340 * 1.04) < 1e-9); strike(G, game, 'roll', 2); near(G.P.rollCd - G.t + G.P.stT, .7 * .85, 'roll cooldown');
    G = at('iron_resolve', 0, 200); game.startMove(G.B, 'g_thrust'); let hit1 = false; run(game, .7, G => { passive(G); if (G.P.st === 'hit') hit1 = true; });
    near(G.P.maxHp - G.P.hp, 9 * .75, 'the first hit is 25 % weaker'); assert.strictEqual(hit1, false, 'and does not stagger');
    G.B.cd = {}; game.startMove(G.B, 'g_thrust'); let hit2 = false; run(game, .7, G => { passive(G); if (G.P.st === 'hit') hit2 = true; });
    near(G.P.maxHp - G.P.hp, 9 * .75 + 9, 'a second hit within 6 s is full'); assert.ok(hit2, 'and staggers');
    G = at('phantom_edge', 0, 500); G.P.ink = 40; strike(G, game, 'ink', 20);
    const w = G.proj.find(p => p.o === G.P); assert.ok(w && Math.abs(Math.abs(w.vx) - 1050 * 1.25) < 1e-9 && w.pierce, 'faster, piercing');
    run(game, .5, passive); assert.strictEqual(G.B.maxHp - G.B.hp, 10, 'hit once'); assert.ok(w.x > G.B.x + 100 && !w.dead, 'and flew on through');
    G = at('demon_sovereignty', 0, 130); G.P.hp = G.P.maxHp * .4; strike(G, game, 'kick', 30);
    near(G.P.ink, 9 * 1.5, 'below half health, ink fills 50 % faster');
  },

  async 'equipping and upgrading everything leaves every boss move and boss identical to the golden baseline'() {
    const { game } = await boot(), s = profile(game, { xp: 1e9, attrs: { assault: 20, survival: 20, shadowcraft: 8 }, tiers: { red_moon: 3 }, powers: ['red_moon', null], echoes: ['phantom_edge', 'iron_resolve'] });
    for (let lv = 0; lv < 5; lv++) { game.SV = s; game.enterGame(); game.startFight(lv, 3); run(game, 30, bot); assert.deepStrictEqual(Object.keys(game.G.B.moves), [], 'the boss has no move overrides'); }
    const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'baseline.json'), 'utf8')), ser = v => JSON.stringify(v, (k, x) => typeof x === 'function' ? 'fn ' + x.toString() : x);
    assert.strictEqual(ser(game.MV), JSON.stringify(gold.MV)); assert.strictEqual(ser(game.BOSSES), JSON.stringify(gold.BOSSES)); assert.strictEqual(ser(game.HERO_MV), JSON.stringify(gold.HERO_MV));
  },
};
