// v2 brief, stage 1: the baseline made reliable. Back / Esc / gamepad B cancel every destructive dialog (never press its first
// button); suspending the app pauses a fight without navigating or keeping buffered presses; the AI reacts after a delay;
// a double KO or an equal-health timeout is a draw that replays the round.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };

module.exports = {
  async 'Back cancels every destructive or choosing dialog; it never presses the first button'() {
    const { game, el, win } = await boot(), back = () => win.issenApp.back(), s = game.SV; game.grantClear(s, 0, 'g'); game.award(s); s.story.pending = []; s.profile.mon = 500; game.enterGame(); // achievements already announced
    const xp = s.profile.xp;
    game.newGameAsk(); assert.strictEqual(open(el, game), 'notice'); back(); assert.strictEqual(game.SV.profile.xp, xp, 'New Game: Back cancels'); assert.strictEqual(open(el, game), 'home');
    game.SV.gear.owned.length; game.openShop('home', 'armour'); game.SH.sel = 'travel_haori'; game.openShop(); el('shActs').children[0].click(); assert.strictEqual(open(el, game), 'notice');
    back(); assert.strictEqual(game.SV.profile.mon, 500, 'purchase: Back buys nothing'); assert.strictEqual(open(el, game), 'shop');
    game.storeMap(game.blankMap()); game.WK.sel = game.maps()[0].id; game.openWorkshop('menu'); el('wkBtns').children.find(b => b.textContent === 'Delete').click(); back();
    assert.strictEqual(game.maps().length, 1, 'delete map: Back keeps it');
    const st = memoryStorage(), b2 = await boot({ storage: st }); b2.game.grantClear(b2.game.SV, 0, 'g'); b2.game.SV.story.pending = []; b2.game.writeSave(b2.game.SV); b2.game.enterGame();
    b2.game.newGame(); b2.game.CH.tab = 'save'; b2.game.openChar(null, 'home'); b2.el('cCodeBtns').children.find(x => x.textContent.startsWith('Restore')).click(); b2.win.issenApp.back();
    assert.strictEqual(b2.game.SV.progress.beaten, 0, 'restore: Back keeps the current journey');
  },

  async 'suspending a fight pauses it, drops held and buffered input, and resuming waits for Continue'() {
    const { game, el, win } = await boot(); game.enterGame(); game.startFight(0, 1); const G = game.G; G.state = 'fight'; G.keys.right = true; G.buf = { a: 'slash', t: G.t }; G.jb = G.t;
    win.issenApp.pause(); assert.strictEqual(G.paused, true); assert.strictEqual(open(el, game), 'pause'); assert.strictEqual(G.buf, null); assert.ok(!G.keys.right); assert.strictEqual(G.jb, -9);
    win.issenApp.resume(); assert.strictEqual(G.paused, true, 'still paused: Continue resumes');
    el('pResume').click(); assert.strictEqual(G.paused, false); run(game, .3); assert.notStrictEqual(G.P.st, 'move', 'no stale attack fires on resume');
  },

  async 'suspending during the sun or a ceremony does not navigate, choose or skip'() {
    const { game, el, win } = await boot(); game.enterGame(); game.startFight(0, 1); const G = game.G; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0;
    for (let i = 0; i < 400 && G.state !== 'absorb'; i++) game.updGame(1 / 60);
    assert.strictEqual(G.state, 'absorb'); run(game, 1); win.issenApp.pause(); assert.strictEqual(G.state, 'absorb', 'the ceremony is not skipped'); assert.strictEqual(open(el, game), null);
    game.absorbDone(); assert.strictEqual(G.state, 'sun'); run(game, 3); win.issenApp.pause(); assert.strictEqual(G.state, 'sun', 'the sun is not touched'); assert.notStrictEqual(open(el, game), 'sunp');
  },

  async 'the AI reacts to an attack only after its reaction time'() {
    const { game } = await boot(); game.enterGame(); game.startFight(4, 1); const G = game.G; G.state = 'fight'; G.P.x = -100; G.B.x = 100; G.B.ai.t = 1e9; G.B.ai.pt = 0;
    game.BOSSES[4].ai.block = 9; // it will choose to guard; when is the question
    game.startMove(G.P, 'lunge'); let seenAt = null, blockAt = null; const t0 = G.t;
    for (let i = 0; i < 40; i++) { game.updGame(1 / 60); G.B.ai.t = 1e9; if (seenAt == null && G.B.ai.react) seenAt = G.t; if (blockAt == null && G.B.ai.blk > 0) blockAt = G.t; }
    assert.ok(seenAt != null && blockAt != null, 'it decided to guard'); assert.ok(blockAt - t0 >= (game.BOSSES[4].ai.react ?? .15) - 1e-9, `guarded after ${(blockAt - t0).toFixed(3)} s`);
  },

  async 'a double KO is a draw: the round is fought again and nobody scores; survival still wins on the clock'() {
    const { game } = await boot(); game.enterGame(); game.startFight(0, 1); let G = game.G; G.state = 'fight'; G.P.hp = 0; G.B.hp = 0; run(game, .1, passive);
    assert.strictEqual(G.rw, null); assert.match(G.ban.sub, /Draw/); run(game, 3.5, passive); assert.strictEqual(G.P.wins + G.B.wins, 0); assert.strictEqual(G.round, 1);
    G.state = 'fight'; G.timer = .01; G.P.hp = 40; G.B.hp = G.B.maxHp * .4; run(game, .1, passive); assert.strictEqual(G.rw, null, 'equal health at time: a draw');
    const s = game.SV; s.modes.sun = 1; s.modes.white = true; game.grantClear(s, 0, 'g'); s.story.seen.push('white', 'm:' + game.MODES.white.missions[2].id); game.startMission('white', 2, 1); G = game.G; G.state = 'fight'; G.timer = .01; G.P.hp = 1;
    run(game, .1, passive); assert.strictEqual(G.rw, G.P, 'survival: alive when the clock ends is a win');
  },
};
