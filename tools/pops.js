// No-pop check (spec §6.6 #13): plays scripted fights and measures, every 1/60 s frame, how far each joint of each fighter
// moves in the fighter's own frame (so walking and lunges don't count, but a pose snap or an instant facing flip does).
// A pop is the first drawn frame after a visual state change; later frames step evenly through the blend.
// `node tools/pops.js` lists the worst frames; tests/anim.test.js asserts the limit.
'use strict';
const { boot } = require('./harness');

const BODY = ['hip', 'neck', 'head', 'e1', 'h1', 'e2', 'h2', 'k1', 'f1', 'k2', 'f2'];

// joint positions in px relative to the fighter's root, mirrored by the drawn facing, plus the weapon tip
function points(game, F) {
  const p = game.poseOf(F), J = game.joints(p, F.def.kind.L), out = {};
  for (const k of BODY) out[k] = [J[k][0] * p.s * p.f, (J[k][1] + J.oy) * p.s - p.lift - F.y]; // p.lift includes -F.y: add it back
  const t = game.bladePt(p, F.def.kind, 100); out.tip = [t[0] - p.x, t[1] - F.y];
  return { out, alpha: F.alpha };
}

const bot = (G, i) => {
  const d = G.B.x - G.P.x, k = G.keys;
  k.right = d > 165; k.left = d < -165; k.down = i % 300 > 280; k.block = i % 240 > 200;
  if (i % 18 === 0 && Math.abs(d) < 200) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : i % 72 === 0 ? 'kick' : i % 90 === 0 ? 'roll' : 'slash', t: G.t };
  if (i % 130 === 0) G.jb = G.t;
};

/** Play `sec` seconds against each boss; returns every per-frame body / tip jump with its context. */
async function measure({ sec = 40, seed = 3 } = {}) {
  const { game } = await boot({ seed }), G = game.G, rows = [];
  for (let lv = 0; lv < 5; lv++) {
    game.startFight(lv, seed);
    const prev = new Map();
    for (let i = 0; i < sec * 60 && G.state !== 'over'; i++) {
      const round = G.round; bot(G, i); game.updGame(1 / 60);
      if (G.round !== round) prev.clear(); // a new round resets both fighters: a deliberate cut
      for (const F of [G.P, G.B]) {
        const now = points(game, F), was = prev.get(F), tag = F.st + (F.st === 'move' ? ':' + Object.keys(game.MV).concat(Object.keys(game.HERO_MV)).find(k => (game.MV[k] || game.HERO_MV[k]) === F.mv) : '');
        if (was && was.alpha > .03 && now.alpha > .03) {
          let body = 0, tip = 0;
          for (const k of BODY) body = Math.max(body, Math.hypot(now.out[k][0] - was.out[k][0], now.out[k][1] - was.out[k][1]));
          tip = Math.hypot(now.out.tip[0] - was.out.tip[0], now.out.tip[1] - was.out.tip[1]);
          rows.push({ boss: game.BOSSES[lv].id, who: F === G.P ? 'hero' : 'boss', from: was.tag, to: tag, body, tip, t: +G.t.toFixed(2) });
        }
        prev.set(F, Object.assign(now, { tag }));
      }
    }
  }
  return rows;
}

module.exports = { measure, BODY };

if (require.main === module) (async () => {
  const rows = await measure(), by = k => [...rows].sort((a, b) => b[k] - a[k]);
  const show = r => `${r.body.toFixed(1).padStart(6)} px body ${r.tip.toFixed(1).padStart(6)} px tip  ${r.boss.padEnd(10)}${r.who.padEnd(5)} ${r.from} -> ${r.to}  @${r.t}`;
  console.log('worst body jumps:'); by('body').slice(0, 15).forEach(r => console.log(' ', show(r)));
  console.log('worst tip jumps:'); by('tip').slice(0, 8).forEach(r => console.log(' ', show(r)));
  const sw = rows.filter(r => r.from !== r.to).sort((a, b) => b.body - a.body), worst = sw[0];
  console.log(`frames ${rows.length}; state switches ${sw.length}: worst first frame ${worst.body.toFixed(1)} px (${show(worst).trim()}); within states (authored motion and blends): max ${Math.max(...rows.filter(r => r.from === r.to).map(r => r.body)).toFixed(1)} px`);
})();
