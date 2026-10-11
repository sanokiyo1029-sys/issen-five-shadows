// The character screen (M4): its buttons spend points, buy tiers and set slots through the same rules as the tests in
// rpg.test.js, save at once, and do nothing while a fight is running.
'use strict';
const assert = require('assert');
const { boot, memoryStorage } = require('../tools/harness');

const cards = el => el('cBody').children, acts = el => el('cCodeBtns').children;
const press = (list, text) => { const b = [...list].find(x => x.textContent.includes(text)); assert.ok(b, `button "${text}"`); assert.ok(!b.disabled, `"${text}" is enabled`); b.click(); };

module.exports = {
  async 'attributes, tiers and slots through the screen; each change is saved'() {
    const st = memoryStorage(), { game, el } = await boot({ storage: st });
    const s = game.migrate(JSON.stringify({ beaten: 5 })).save; s.story.pending = []; game.SV = s; game.writeSave(s);
    game.enterGame(); game.openChar(null, 'menu');
    assert.strictEqual(cards(el).length, 3, 'three attribute paths');
    press(cards(el)[0].children, '+ 1 point'); press(cards(el)[0].children, '+ 1 point');
    assert.strictEqual(game.SV.profile.attrs.assault, 2); assert.strictEqual(game.SV.profile.attrPts, 12);
    game.CH.tab = 'powers'; game.openChar();
    assert.strictEqual(cards(el).length, 5, 'five powers'); press(cards(el)[0].children, 'Upgrade to II');
    assert.strictEqual(game.SV.powers.red_moon.tier, 2);
    game.CH.tab = 'loadout'; game.openChar(); cards(el)[2].click(); // echo slot 1
    press(acts(el), 'Pale Reflection'); assert.deepStrictEqual(JSON.parse(JSON.stringify(game.SV.loadout.echoes)), ['phantom_edge', null]);
    const again = (await boot({ storage: st })).game.SV;
    assert.strictEqual(again.profile.attrs.assault, 2); assert.strictEqual(again.powers.red_moon.tier, 2); assert.strictEqual(again.loadout.echoes[0], 'phantom_edge');
  },

  async 'during a fight the screen cannot change anything; after it (the result panel) it can'() {
    const { game, el } = await boot();
    const s = game.migrate(JSON.stringify({ beaten: 2 })).save; s.story.pending = []; game.SV = s;
    game.enterGame(); game.startFight(0, 1); game.G.state = 'fight';
    game.CH.tab = 'attrs'; game.openChar(null, 'result'); cards(el)[0].children[0].click();
    assert.strictEqual(game.SV.profile.attrs.assault, 0, 'no change mid-fight');
    game.G.state = 'over'; game.openChar(null, 'result'); cards(el)[0].children[0].click();
    assert.strictEqual(game.SV.profile.attrs.assault, 1, 'allowed once the fight is over');
    assert.strictEqual(el('cClose').textContent, 'Back'); el('cClose').click(); assert.strictEqual(el('result').classList.contains('off'), false, 'Back returns to the result panel');
  },
};
