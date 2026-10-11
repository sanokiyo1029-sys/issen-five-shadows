// M9 (spec §15, §17.2 #13): Android Back and desktop Esc close whatever screen is open and only leave the app from the map;
// the version is shown; storage persistence is requested safely.
'use strict';
const assert = require('assert');
const { boot } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;

module.exports = {
  async 'Back closes each screen in turn and returns 0 only on the map'() {
    const { game, el, win } = await boot(); const back = () => win.issenApp.back();
    game.SV.story.pending = []; game.enterGame(); assert.strictEqual(open(el, game), 'menu'); assert.strictEqual(back(), 0, 'on the map Back may leave the app');
    game.openSettings('menu'); assert.strictEqual(back(), 1); assert.strictEqual(open(el, game), 'menu');
    game.openChar(null, 'menu'); assert.strictEqual(back(), 1); assert.strictEqual(open(el, game), 'menu');
    game.SV.story.seen = ['burning_field']; game.openRegion(0); assert.strictEqual(open(el, game), 'region'); assert.strictEqual(back(), 1); assert.strictEqual(open(el, game), 'menu');
    game.startFight(0, 1); game.G.state = 'fight'; assert.strictEqual(back(), 1); assert.strictEqual(game.G.paused, true, 'in a fight Back pauses');
    game.openSettings('pause'); assert.strictEqual(back(), 1); assert.strictEqual(open(el, game), 'pause', 'settings from the pause menu return to it');
    assert.strictEqual(back(), 1); assert.strictEqual(game.G.paused, false, 'and Back resumes');
    game.G.state = 'over'; assert.strictEqual(back(), 1); assert.strictEqual(game.mode, 'menu', 'after a fight Back goes to the map');
  },

  async 'Esc on the keyboard does the same outside a fight; the version shows on the map'() {
    const { game, el } = await boot(); game.SV.story.pending = []; game.enterGame();
    assert.strictEqual(el('ver').textContent, 'v' + game.VERSION);
    game.openSettings('menu'); game.gameKey({ code: 'Escape', repeat: false, preventDefault() {} }, true); assert.strictEqual(open(el, game), 'menu');
  },
};
