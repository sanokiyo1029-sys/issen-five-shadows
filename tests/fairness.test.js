// Telegraph standard and fairness (M2, spec §5.2b-d): every heavy boss move has a shape + audio + pose tell, reposition
// attacks show where they land from the moment they vanish, every move has >= 2 verified answers, and no wake-up loop.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');
const { audit } = require('../tools/audit-moves');
const { ANSWERS, first } = require('../tools/answers');

const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const bossMoves = game => [...new Set(game.BOSSES.flatMap(b => b.moves))];
const lvOf = (game, id) => game.BOSSES.findIndex(b => b.moves.includes(id));

module.exports = {
  async 'audit: every boss move has >= 2 answers, all verified by simulation; every flag is judged'() {
    const rows = await audit();
    assert.strictEqual(rows.length, 26);
    for (const f of rows) {
      assert.ok(f.answers.length >= 2 && f.answers.every(a => ANSWERS.includes(a)), `${f.id}: answers ${f.answers}`);
      assert.deepStrictEqual(f.verified, f.answers, `${f.id}: declared ${f.answers}, simulation confirms ${f.verified}`);
      assert.ok(!f.flags.length || f.judged, `${f.id}: unjudged flags ${f.flags.join('; ')}`);
      if (f.heavy) assert.ok(f.recovery >= .3 - 1e-9, `${f.id}: heavy recovery ${f.recovery}`);
      if (f.mark) assert.ok(f.warning >= .25, `${f.id}: reposition warning ${f.warning}`);
    }
  },

  async 'every heavy boss move (dmg >= 10 or knockdown) carries a tell that ends by its first active frame'() {
    const { game } = await boot(), MV = game.MV;
    for (const id of bossMoves(game)) {
      const m = MV[id], dmg = m.dmg ?? m.proj.dmg, kd = m.kd || m.proj && m.proj.kd;
      if (!(dmg >= 10 || kd || m.mark)) continue;
      assert.ok(Array.isArray(m.tell) && m.tell[0] >= 0 && m.tell[0] < m.tell[1] && m.tell[1] <= first(m), `${id}: tell ${m.tell}`);
    }
  },

  async 'pose cue: each tell is a visible windup (the silhouette moves >= 20 px from the guard)'() {
    const { game } = await boot(), G = game.G;
    for (const id of bossMoves(game)) {
      const m = game.MV[id]; if (!m.tell) continue;
      game.startFight(lvOf(game, id), 1);
      const B = G.B, kind = B.def.kind, at = t => { B.st = 'move'; B.mv = m; B.mvT = t; B.stT = t; const p = game.poseOf(B), J = game.joints(p, kind.L);
        return Object.keys(J).filter(k => Array.isArray(J[k])).map(k => J[k].map(v => v * p.s)).concat([game.bladePt(p, kind, 100)]); };
      const a = at(0), b = at(m.tell[1]), moved = Math.max(...a.map((q, i) => Math.hypot(q[0] - b[i][0], q[1] - b[i][1])));
      assert.ok(moved >= 20, `${id}: windup moves the silhouette only ${moved.toFixed(1)} px`);
    }
  },

  async 'audio cue: the tell sound plays once, when each boss tell begins'() {
    const { game, win } = await boot(), G = game.G;
    const au = win.film.au, fake = { state: 'running', currentTime: 0 }; // pretend audio is running; only the cue is counted
    let n = 0; game.S.tell = () => { n++; };
    for (const id of bossMoves(game)) {
      const m = game.MV[id]; if (!m.tell) continue;
      au.ctx = null; game.startFight(lvOf(game, id), 1); au.ctx = fake; G.state = 'fight'; G.P.x = -800; G.B.x = 800; n = 0;
      passive(G); game.startMove(G.B, id);
      let at = -1;
      run(game, m.dur, G => { passive(G); if (n && at < 0) at = G.B.mvT; });
      au.ctx = null;
      assert.strictEqual(n, 1, `${id}: tell sound count`);
      assert.ok(Math.abs(at - m.tell[0]) <= 1 / 60 + 1e-9, `${id}: sound at ${at}, tell starts ${m.tell[0]}`);
    }
  },

  async 'reposition attacks land exactly where their marker pointed, at the marked time'() {
    const { game } = await boot(), G = game.G;
    for (const id of ['k_vanish', 'y_phase']) {
      const m = game.MV[id];
      game.startFight(lvOf(game, id), 1); G.state = 'fight'; G.P.x = -150; G.B.x = 250;
      passive(G); game.startMove(G.B, id);
      let predicted = null, jumpAt = null, x0 = G.B.x;
      run(game, m.mark[1] + .1, G => {
        passive(G); G.keys.left = G.B.mvT < .3; // the hero moves while the marker tracks them
        if (G.B.mvT >= m.mark[0] && G.B.mvT < m.mark[1] - 1e-9) predicted = m.dest(G.B, G.P);
        if (jumpAt == null && Math.abs(G.B.x - x0) > 1) jumpAt = G.B.mvT;
      });
      assert.ok(Math.abs(jumpAt - m.mark[1]) <= 1 / 60 + 1e-9, `${id}: teleported at ${jumpAt}, marked ${m.mark[1]}`);
      assert.ok(Math.abs(G.B.x - predicted) < 1, `${id}: landed at ${G.B.x}, marker showed ${predicted}`);
    }
  },

  async 'no unavoidable wake-up loop: a knocked-down hero who holds the right guard takes nothing more'() {
    const { game } = await boot(), G = game.G;
    for (const b of game.BOSSES) for (const id of b.moves) {
      const m = game.MV[id]; if (m.proj || m.mark || m.start || m.cd) continue; // repeatable melee pressure; a move on a cooldown cannot loop
      const low = m.zone === 'low';
      for (const guard of [true, false]) {
        game.startFight(game.BOSSES.indexOf(b), 1); G.state = 'fight'; G.P.x = -60; G.B.x = 60;
        Object.assign(G.P, { st: 'down', stT: 0, hp: 50 });
        run(game, 3, G => { passive(G); G.keys.block = guard; G.keys.down = guard && low;
          if (G.B.st === 'idle' || G.B.st === 'walk') game.startMove(G.B, id); G.B.x = Math.min(G.B.x, G.P.x + 120); });
        if (guard) assert.strictEqual(G.P.hp, 50, `${b.id} ${id}: hit after getting up (hp ${G.P.hp})`);
        else assert.ok(G.P.hp < 50, `${b.id} ${id}: control — without a guard the pressure should land`);
      }
    }
  },
};
