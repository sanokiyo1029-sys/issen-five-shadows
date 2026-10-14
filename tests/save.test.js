// Save v2: defaults, migration from v1 {beaten:N}, clamping, slot rotation, corruption recovery, export / import.
'use strict';
const assert = require('assert');
// values from the game's vm realm have foreign prototypes: compare plain JSON copies
const eq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const { boot, memoryStorage } = require('../tools/harness');
const SKEY = 'issen-five-shadows', SLOTS = [SKEY + '.v2.a', SKEY + '.v2.b'], QKEY = SKEY + '.quarantine';
const legacy = raw => memoryStorage({ [SKEY]: raw });
const slotDocs = st => SLOTS.map(k => st.getItem(k)).filter(Boolean).map(t => JSON.parse(t).doc);

module.exports = {
  async 'data tables validate'() {
    const { game } = await boot();
    eq(game.validateData(), []);
  },

  async 'a new profile starts at level 1 with exactly the v1.2 hero'() {
    const { game, storage } = await boot();
    const S = game.SV;
    assert.strictEqual(S.profile.level, 1); assert.strictEqual(S.profile.xp, 0); eq(S.loadout.powers, [null, null]);
    const d = game.heroDef(); // M4: the hero is derived from the profile; at level 1 every number is HERO_D's and every modifier neutral
    assert.strictEqual(d.hp, game.HERO_D.hp); assert.strictEqual(d.speed, game.HERO_D.speed); eq(d.mod, game.NEUTRAL); eq(d.ov, {}); eq(d.powers, [null, null]); eq(d.echoes, [null, null]);
    assert.strictEqual(slotDocs(storage).length, 1, 'v2 save written on first boot');
    game.startFight(0);
    eq(Object.keys(game.G.P.moves), [], 'level-1 hero has no move overrides');
    assert.strictEqual(storage.getItem(SKEY), '{"beaten":0}', 'legacy key mirrored');
  },

  async 'legacy {beaten:N} migrates for N = 0..5, once'() {
    const { game: g0 } = await boot(), R = g0.PROG.rewards, ids = g0.BOSSES.map(b => b.id);
    for (let n = 0; n <= 5; n++) {
      const st = legacy(JSON.stringify({ beaten: n })), { game } = await boot({ storage: st }), S = game.SV;
      const xp = ids.slice(0, n).reduce((a, id) => a + R[id].xp, 0), sp = ids.slice(0, n).reduce((a, id) => a + R[id].skill_points, 0);
      assert.strictEqual(S.progress.beaten, n); eq(S.progress.defeated, ids.slice(0, n));
      const milestones = game.PROG.level_up.skill_point_levels.filter(L => game.levelOf(xp).level >= L).length; // M4: milestone levels pay a skill point too
      assert.strictEqual(S.profile.xp, xp, `N=${n} xp`); assert.strictEqual(S.profile.skillPts, sp + milestones);
      assert.strictEqual(S.profile.level, game.levelOf(xp).level);
      eq(Object.keys(S.powers), ids.slice(0, n).map(id => R[id].power));
      assert.strictEqual(S.loadout.powers[0], n ? 'red_moon' : null);
      assert.ok(Object.keys(S.rewardsClaimed).filter(k => !k.startsWith('cr:')).length === n, 'one claim per defeated boss');
      assert.strictEqual(S.profile.crystals, ids.slice(0, n).reduce((a, id) => a + game.ECON.crystals.boss[id], 0), '1.7: and their shadow crystals, once');
      assert.strictEqual(S.legacy.raw, JSON.stringify({ beaten: n }));
      assert.strictEqual(st.getItem(SKEY), JSON.stringify({ beaten: n }), 'legacy key kept and current');
      assert.strictEqual(S.story.pending.some(p => p.kind === 'migrated'), n > 0);
      const again = (await boot({ storage: st })).game.SV; // relaunch: loads v2, never migrates twice
      assert.strictEqual(again.profile.xp, xp); assert.strictEqual(again.rev, S.rev);
    }
  },

  async 'corrupted legacy values are clamped and the raw text kept'() {
    for (const [raw, n] of [['{"beaten":"abc"}', 0], ['{"beaten":-2}', 0], ['{"beaten":"3"}', 3], ['{bad json', 0], ['{"beaten":99}', 5], ['{"beaten":2.7}', 2], ['{"beaten":true}', 0]]) {
      const { game, el } = await boot({ storage: legacy(raw) });
      assert.strictEqual(game.SV.progress.beaten, n, raw); assert.strictEqual(game.SV.legacy.raw, raw);
      game.toMenu();
      assert.ok(!el('wpins').children.find(p => p.dataset.place === 'burning_field').className.includes('locked'), `first boss must always be open (${raw})`); // 1.7: the world map
    }
  },

  async 'invalid v2 fields are clamped on load'() {
    const { game } = await boot(), st = memoryStorage();
    const doc = Object.assign(game.cleanSave({}), { rev: 5 });
    Object.assign(doc.profile, { xp: -50, level: 99, skillPts: 'lots', attrs: { assault: 1e6 } });
    doc.progress.beaten = 'x'; doc.powers = { red_moon: { unlocked: true, tier: 9 }, fake_power: { unlocked: true } };
    doc.loadout.powers = ['nope', 'red_moon']; doc.story.pending = [{ kind: 'power', id: 'fake' }, { kind: 'evil', text: 'x' }];
    const j = JSON.stringify(doc); let h = 0x811c9dc5; for (let i = 0; i < j.length; i++) h = Math.imul(h ^ j.charCodeAt(i), 0x01000193);
    st.setItem(SLOTS[1], JSON.stringify({ sum: (h >>> 0).toString(36), doc }));
    const S = (await boot({ storage: st })).game.SV;
    assert.strictEqual(S.profile.xp, 0); assert.strictEqual(S.profile.level, 1); assert.strictEqual(S.profile.skillPts, 0); assert.strictEqual(S.profile.attrs.assault, 0, 'ranks beyond the points a level-1 profile has earned are reset (M4)'); assert.strictEqual(S.profile.attrPts, 0);
    assert.strictEqual(S.progress.beaten, 0); eq(S.powers, { red_moon: { unlocked: true, tier: 1 } }, 'tier capped at III without the Ink Trial, then reset: no skill points were earned (M4)');
    eq(S.loadout.powers, [null, null], 'slot 2 needs level 6; unknown ids dropped'); eq(S.story.pending, []);
  },

  async 'writes alternate slots; a damaged newest slot falls back to the previous save'() {
    const { game, storage } = await boot();
    for (let i = 0; i < 3; i++) { game.SV.profile.mon = i + 1; game.writeSave(game.SV); }
    const docs = slotDocs(storage).sort((a, b) => b.rev - a.rev);
    assert.strictEqual(docs.length, 2); assert.strictEqual(docs[0].rev, docs[1].rev + 1);
    const newest = SLOTS.find(k => JSON.parse(storage.getItem(k)).doc.rev === docs[0].rev);
    storage.setItem(newest, storage.getItem(newest).slice(0, 40)); // a write cut short
    const S = (await boot({ storage })).game.SV;
    assert.strictEqual(S.rev, docs[1].rev + 1, 'the good copy, written back over the damaged slot'); assert.strictEqual(S.profile.mon, docs[1].profile.mon);
  },

  async 'every slot damaged: text quarantined (last 3), progress rebuilt from the legacy mirror, player told'() {
    const st = legacy('{"beaten":2}');
    for (let k = 0; k < 4; k++) {
      SLOTS.forEach((s, i) => st.setItem(s, `garbage ${k}.${i}`));
      const { game } = await boot({ storage: st });
      assert.strictEqual(game.SV.progress.beaten, 2); assert.strictEqual(game.SV.story.pending[0].kind, 'corrupt');
    }
    const q = JSON.parse(st.getItem(QKEY));
    assert.strictEqual(q.length, 3); eq(q.map(e => e.raw), ['garbage 2.1', 'garbage 3.0', 'garbage 3.1']);
  },

  async 'save code export / import round-trips; damaged codes are refused'() {
    const { game } = await boot({ storage: legacy('{"beaten":3}') });
    const code = game.exportCode(), back = game.importCode(code);
    assert.ok(code.startsWith('ISSEN2-')); eq(back, game.cleanSave(game.SV));
    assert.strictEqual(game.importCode('ISSEN2-not-a-save'), null);
    const i = code.length - 12, bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    assert.strictEqual(game.importCode(bad), null, 'checksum mismatch must be refused');
  },
};
