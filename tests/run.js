// Test runner: `node tests/run.js` runs every tests/*.test.js; `--update-golden` rewrites tests/golden/*.json.
// Each test file exports { 'name': async () => { ...throw on failure... } }. No dependencies.
'use strict';
const fs = require('fs'), path = require('path');
(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
  let pass = 0, fail = 0;
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
    for (const [name, fn] of Object.entries(require(path.join(__dirname, f)))) {
      if (only.length && !only.some(o => (f + ' ' + name).includes(o))) continue;
      const t0 = Date.now();
      try { await fn(); pass++; console.log(`  ok   ${f} › ${name} (${Date.now() - t0} ms)`); }
      catch (e) { fail++; console.log(`  FAIL ${f} › ${name}\n       ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
