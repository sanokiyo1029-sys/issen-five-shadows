// 1.7 (Ultimate Edition, part 1): the main menu is the hub and every entry opens a real screen; New Game asks first and keeps a
// copy; shadow crystals are paid once per claim (and backfilled for saves from before they existed); Quit degrades gracefully.
'use strict';
const assert = require('assert');
const { boot, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const entries = el => el('hMenu').children.map(b => b.innerHTML.replace(/<.*$/, ''));
const press = (el, label) => { const b = el('hMenu').children.find(b => b.innerHTML.startsWith(label)); assert.ok(b, 'menu entry ' + label); b.click(); };

module.exports = {
  async 'the main menu shows level, both balances, the weapon and progress; its entries open real screens'() {
    const { game, el } = await boot(); game.SV.profile.mon = 1234; game.SV.profile.crystals = 56; game.enterGame();
    assert.strictEqual(open(el, game), 'home');
    assert.match(el('hStat').innerHTML, /Level <b>1<\/b> · <b>1,234<\/b> mon · <b>56<\/b> shadow crystals<br>Katana, tier I · 0 of 5 shadows · campaign 0%/);
    for (const e of ['Begin', 'New Game', 'World Map', 'Settings', 'Quit']) assert.ok(entries(el).includes(e), e);
    press(el, 'World Map'); assert.strictEqual(open(el, game), 'menu'); game.toHome();
    press(el, 'Settings'); assert.strictEqual(open(el, game), 'settings'); el('sClose').click(); assert.strictEqual(open(el, game), 'home');
    press(el, 'Begin'); assert.strictEqual(open(el, game), 'notice', 'a new journey begins with the Burning Field story card');
    el('nBtns').children[0].click(); assert.strictEqual(open(el, game), 'region'); assert.strictEqual(game.SV.world.at, 0);
  },

  async 'Continue resumes the region last visited, after a restart too'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }); game.grantClear(game.SV, 0, 'w1'); game.SV.story.seen = ['bamboo_grove']; game.SV.story.pending = [];
    game.writeSave(game.SV); game.enterGame(); game.openRegion(1);
    const g2 = await boot({ storage: st }); g2.game.SV.story.pending = []; g2.game.enterGame(); assert.match(g2.el('hMenu').children[0].innerHTML, /^Continue<small>Bamboo Grove/);
    g2.el('hMenu').children[0].click(); assert.strictEqual(open(g2.el, g2.game), 'region'); assert.strictEqual(g2.el('gTitle').textContent, 'Bamboo Grove');
  },

  async 'New Game asks first, keeps settings and a copy that can be restored'() {
    const st = memoryStorage(), { game, el } = await boot({ storage: st }); const S = game.SV; game.grantClear(S, 0, 'w1'); S.settings.volume = .3; S.story.pending = []; game.writeSave(S); game.enterGame();
    press(el, 'New Game'); assert.strictEqual(open(el, game), 'notice'); el('nBtns').children[1].click(); assert.strictEqual(game.SV.progress.beaten, 1, 'Cancel changes nothing');
    press(el, 'New Game'); el('nBtns').children[0].click();
    assert.strictEqual(game.SV.progress.beaten, 0); assert.strictEqual(game.SV.profile.xp, 0); assert.strictEqual(game.SV.settings.volume, .3, 'settings stay');
    assert.strictEqual((await boot({ storage: st })).game.SV.progress.beaten, 0, 'the new game is what loads');
    game.CH.tab = 'save'; game.openChar(null, 'home'); const r = el('cCodeBtns').children.find(b => b.textContent.startsWith('Restore')); assert.ok(r, 'restore offered');
    r.click(); el('nBtns').children[0].click(); assert.strictEqual(game.SV.progress.beaten, 1); assert.ok(game.SV.powers.red_moon, 'the old journey is back');
  },

  async 'crystals: a first boss clear pays once, a repeat pays none, elites and trials pay theirs'() {
    const { game } = await boot(), S = game.SV, C = game.ECON.crystals;
    assert.strictEqual(game.grantClear(S, 0, 'a').crystals, C.boss.gekko); assert.strictEqual(game.grantClear(S, 0, 'b').crystals, 0);
    assert.strictEqual(game.grantClear(S, 0, 'b').crystals, 0, 'a double report replays the stored result'); assert.strictEqual(S.profile.crystals, C.boss.gekko);
    assert.strictEqual(game.grantStep(S, 0, 4, 'c').crystals, C.elite, 'the elite'); assert.strictEqual(game.grantStep(S, 0, 0, 'd').crystals, 0, 'a retainer pays none');
    assert.strictEqual(game.grantTrial(S, 0, 'e').crystals, C.trial); assert.strictEqual(S.profile.crystals, C.boss.gekko + C.elite + C.trial);
  },

  async 'a save from before crystals is paid what it earned, exactly once'() {
    const { game } = await boot(), S = game.cleanSave({}); for (const k of ['boss:gekko', 'boss:kasumi', 'step:burning_field:2', 'trial:gekko']) S.rewardsClaimed[k] = 1;
    S.progress.defeated = ['gekko', 'kasumi']; S.progress.beaten = 2; S.progress.trialsDone = ['gekko']; // claims agree with the progress they paid for
    const old = JSON.parse(JSON.stringify(S)); old.profile.crystals = 0; for (const k of Object.keys(old.rewardsClaimed)) if (k.startsWith('cr:')) delete old.rewardsClaimed[k];
    const C = game.ECON.crystals, want = C.boss.gekko + C.boss.kasumi + C.elite + C.trial, a = game.cleanSave(old);
    assert.strictEqual(a.profile.crystals, want); assert.strictEqual(game.cleanSave(JSON.parse(JSON.stringify(a))).profile.crystals, want, 'reloading pays nothing more');
    assert.strictEqual(game.cleanSave({ profile: { crystals: -5 } }).profile.crystals, 0, 'never negative');
  },

  async 'Quit: the Android app closes; a browser tab says it cannot and keeps the game running'() {
    let { game, el, win } = await boot(); game.enterGame(); let closed = 0; win.IssenNative = { exit() { closed++; } };
    press(el, 'Quit'); assert.strictEqual(closed, 1);
    ({ game, el, win } = await boot()); game.enterGame(); press(el, 'Quit'); await new Promise(r => setTimeout(r, 300));
    assert.strictEqual(open(el, game), 'notice'); assert.match(el('nTitle').textContent, /saved/); el('nBtns').children[0].click(); assert.strictEqual(open(el, game), 'home');
  },

  async 'music and effects volumes are separate settings, saved and clamped'() {
    const { game } = await boot(); const s = game.cleanSettings({ music: 3, sfx: -1, sens: 9, lang: 'xx' });
    assert.strictEqual(s.music, 1); assert.strictEqual(s.sfx, 0); assert.strictEqual(s.sens, 1.6); assert.strictEqual(s.lang, 'en');
  },
};
