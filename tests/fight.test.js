// Every boss fight runs to a result without errors, and the same seed replays to the same outcome.
'use strict';
const assert = require('assert');
const { boot, run } = require('../tools/harness');

// a simple scripted player: close in, slash, kick now and then, Issen when the meter is full
const bot = (G, i) => {
  const d = G.B.x - G.P.x, k = G.keys;
  k.right = d > 165; k.left = d < -165;
  if (i % 18 === 0 && Math.abs(d) < 200) G.buf = { a: G.P.ink >= 99.5 ? 'issen' : i % 72 === 0 ? 'kick' : 'slash', t: G.t };
};

async function fight(lv, seed) {
  const { game } = await boot({ seed });
  game.enterGame(); game.startFight(lv);
  const G = run(game, 400, bot);
  return { state: G.state, wins: [G.P.wins, G.B.wins], hp: [G.P.hp, G.B.hp].map(v => +v.toFixed(3)), t: +G.t.toFixed(3) };
}

module.exports = {
  async 'all five boss fights finish'() {
    for (let lv = 0; lv < 5; lv++) {
      const r = await fight(lv, 7);
      assert.ok(['over', 'sun'].includes(r.state), `boss ${lv} did not finish: ${JSON.stringify(r)}`); // 1.7: Gekkō's first fall raises the sun
      assert.ok(Math.max(...r.wins) === 2, `boss ${lv} ended without a 2-round winner: ${JSON.stringify(r)}`);
    }
  },
  async 'same seed, same fight'() {
    const a = await fight(2, 42), b = await fight(2, 42);
    assert.deepStrictEqual(a, b);
  },
};
