// Golden baseline: the move table, bosses, arenas and the default hero must not change by accident.
// Functions (pose keyframes, scripted hooks) are compared by source text. Intentional changes: run with --update-golden.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { boot } = require('../tools/harness');
const FILE = path.join(__dirname, 'golden', 'baseline.json');

const snapshot = game => JSON.parse(JSON.stringify({ MV: game.MV, BOSSES: game.BOSSES, ARENAS: game.ARENAS, HERO_D: game.HERO_D },
  (k, v) => typeof v === 'function' ? 'fn ' + v.toString() : v));

module.exports = {
  async 'moves, bosses, arenas and hero match the golden baseline'() {
    const now = snapshot((await boot()).game);
    if (process.argv.includes('--update-golden') || !fs.existsSync(FILE)) {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(now, null, 1) + '\n');
      console.log('       (golden baseline written)');
      return;
    }
    const gold = JSON.parse(fs.readFileSync(FILE, 'utf8')), diff = [];
    for (const table of Object.keys(gold)) for (const k of new Set([...Object.keys(gold[table]), ...Object.keys(now[table] || {})]))
      if (JSON.stringify(gold[table][k]) !== JSON.stringify((now[table] || {})[k])) diff.push(`${table}.${k}`);
    assert.deepStrictEqual(diff, [], 'changed vs golden: ' + diff.join(', ') + ' (intentional? run: node tests/run.js --update-golden)');
  },
};
