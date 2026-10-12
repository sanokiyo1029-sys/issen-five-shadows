// Verifies, by simulation, how a boss move can be answered (spec §5.2d): block, crouch, jump or roll.
// The boss is passive except for the one forced move; the hero performs the answer and must take no damage.
// Held answers (block, crouch) are held from the start; timed answers (jump, roll) are tried at every start tick and
// must work for a window of at least MIN_WINDOW consecutive ticks. Used by tests/fairness.test.js and tools/audit-moves.js.
'use strict';
const { boot } = require('./harness');
const MIN_WINDOW = 3; // ticks (50 ms): an answer you can only hit on one exact frame is not an answer
const ANSWERS = ['block', 'crouch', 'jump', 'roll'];

const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const first = m => m.hit ? m.hit[0][0] : m.proj.t;

async function verifier() {
  const { game } = await boot(), G = game.G, MV = game.MV;
  const lvOf = id => game.BOSSES.findIndex(b => b.moves.includes(id) || b.phase && b.phase.move === id);
  const foeOf = id => Object.values(game.FOES).find(f => f.moves.includes(id) || f.phase && f.phase.move === id); // retainer moves: fought in region 1 by their foe

  // one trial: boss `id` at distance d; `act(G, tick)` drives the hero; returns the damage the hero took
  function trial(id, d, act) {
    const lv = lvOf(id);
    if (lv >= 0) game.startFight(lv, 1); else { game.startFight(0, 1); G.B = game.mkF(foeOf(id), false); game.newRound(); }
    G.state = 'fight'; G.st = 0; G.P.x = -d / 2; G.B.x = d / 2;
    passive(G); game.updGame(1 / 60);
    if (!game.startMove(G.B, id)) throw new Error('could not start ' + id);
    const m = MV[id], ticks = Math.ceil((m.dur + (m.proj ? 2 : .2)) * 60);
    if (lvOf(id) >= 0 && game.BOSSES[lvOf(id)].phase && game.BOSSES[lvOf(id)].phase.move === id) G.B.phase = true;
    for (let i = 0; i < ticks; i++) {
      passive(G); act(G, i); game.updGame(1 / 60);
      if (G.P.hp < G.P.maxHp) break;
    }
    return G.P.maxHp - G.P.hp;
  }
  const idle = () => {};
  // the distance a trial uses: the first candidate inside the AI's range at which an idle hero gets hit
  function distance(id) {
    const m = MV[id], s = (lvOf(id) >= 0 ? game.BOSSES[lvOf(id)] : foeOf(id)).s, lo = m.ai[0] * s, hi = m.ai[1] * s;
    const cands = m.proj ? [600] : [.85 * m.reach * s, lo + 30, (lo + hi) / 2].map(v => Math.min(hi, Math.max(lo + 1, v)));
    for (const d of cands) if (trial(id, d, idle) > 0) return d;
    return null;
  }
  function works(id, answer, d) {
    const m = MV[id], low = [m.zone, m.proj && m.proj.zone, m.proj2 && m.proj2.zone, ...(m.win || []).map(w => w && w.zone)].includes('low');
    if (answer === 'block') return trial(id, d, G => { G.keys.block = true; G.keys.down = low; }) === 0;
    if (answer === 'crouch') return trial(id, d, G => { G.keys.down = true; }) === 0;
    const last = Math.ceil((first(m) + (m.proj ? 1.2 : 0)) * 60) + 2, ok = []; // a projectile is answered when it arrives, not when it is thrown
    for (let s = 0; s <= last; s++) ok.push(answer === 'jump'
      ? trial(id, d, (G, i) => { if (i === s) G.jb = G.t; }) === 0
      : [0, 1].some(dir => trial(id, d, (G, i) => { if (i === s) { G.keys.right = dir > 0; G.buf = { a: 'roll', t: G.t }; } else G.keys.right = false; }) === 0));
    let run = 0, best = 0;
    for (const v of ok) { run = v ? run + 1 : 0; best = Math.max(best, run); }
    return best >= MIN_WINDOW;
  }
  return { game, MV, distance, works, trial };
}

module.exports = { verifier, ANSWERS, MIN_WINDOW, first };

if (require.main === module) (async () => {
  const v = await verifier(), ids = [...new Set([...v.game.BOSSES.flatMap(b => [...b.moves, b.phase && b.phase.move].filter(Boolean)), ...Object.values(v.game.FOES).flatMap(f => [...f.moves, f.phase && f.phase.move].filter(Boolean))])];
  for (const id of ids) {
    const d = v.distance(id);
    console.log(id.padEnd(9), d == null ? 'NEVER HITS AN IDLE HERO' : 'd=' + Math.round(d), d == null ? '' : ANSWERS.filter(a => v.works(id, a, d)).join(' '), ' declared:', (v.MV[id].answers || []).join(' '));
  }
})();
