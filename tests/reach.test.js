// Visual / data consistency (spec §6.3): no bladed move's tip ends more than 25% away from where it actually hits, except the
// boss moves judged in tools/reach-check.js (lunges, leaps, a rising cut). Every weapon class must pass.
'use strict';
const assert = require('assert');
const { check } = require('../tools/reach-check');

module.exports = {
  async 'every flagged move is a judged boss move; every weapon-class and katana move passes'() {
    const rows = await check();
    assert.ok(rows.length > 60);
    const bad = rows.filter(r => r.flag && !r.known).map(r => `${r.name} ${r.ratio}`);
    assert.deepStrictEqual(bad, [], 'new reach mismatches: ' + bad.join(', '));
    assert.ok(rows.filter(r => /^(katana|yari|kodachi|kanabo|naginata|nodachi)\./.test(r.name)).every(r => !r.flag), 'the hero\'s weapons all pass');
  },
};
