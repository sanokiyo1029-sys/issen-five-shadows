// Pose Lab and review sheets (M2, spec §6.9): the debug tools load and run for every move without touching the game data.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { boot, run, ROOT } = require('../tools/harness');

async function withLab() {
  const b = await boot();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tools', 'poselab.js'), 'utf8'), b.win);
  return Object.assign(b, { lab: b.win.poseLab });
}

module.exports = {
  async 'every move of every fighter gets a review sheet and a §6.6 checklist'() {
    const { lab, game } = await withLab(), ids = [...new Set(lab.FIGHTERS.flatMap(f => f.moves))];
    const want = new Set([...lab.FIGHTERS[0].moves, ...game.BOSSES.flatMap(b => [...b.moves, b.phase && b.phase.move].filter(Boolean)), ...Object.values(game.FOES).flatMap(f => f.moves),
      ...Object.entries(game.GEAR.weapons).flatMap(([w, x]) => w === 'katana' || x.class ? [] : Object.keys(x.moves).map(n => w + '.' + n))]);
    assert.strictEqual(ids.length, want.size, 'every hero move and every boss move, phase moves included');
    for (const id of ids) {
      const cl = lab.sheet(id);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(cl.map(r => r.n))), [1, 2, 3, 4, 5, 6, 7, 8, 12, 13], id); // vm arrays: compare as JSON
      assert.ok(cl.every(r => r.ok === true || r.ok === false || r.ok === null) && cl.every(r => r.detail), id);
    }
    const fd = lab.frameData(lab.moveOf('g_thrust'));
    assert.deepStrictEqual([fd.startup, +fd.recovery.toFixed(2)], [.27, .24]);
  },

  async 'the lab opens, plays, steps and closes; the fight overlay draws; the move table is untouched'() {
    const { lab, game } = await withLab(), before = JSON.stringify(game.MV.g_dragon);
    lab.openLab('g_dragon');
    assert.strictEqual(game.mode, 'lab'); assert.strictEqual(lab.LAB.fi, 1, 'opens on the move owner (Gekkō)');
    for (let i = 0; i < 90; i++) game.G.lab(1 / 60);
    assert.ok(lab.LAB.t > 0);
    lab.closeLab(); assert.strictEqual(game.mode, 'menu'); assert.strictEqual(game.G.lab, null);
    game.startFight(4, 1); game.G.overlay = lab.overlay; run(game, 3, () => {}); game.renderGame();
    assert.strictEqual(JSON.stringify(game.MV.g_dragon), before);
  },
};
