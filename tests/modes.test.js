// 1.7 (parts 7-9): the mysterious sun and the two modes. The first time Gekkō falls a sun rises; touching it offers Hell Mode
// and White Mode, neither opens by itself, the choice is saved; the sun waits on the map until both are open. Hell: demons
// counter and chain, healing is halved, wounds carry, vents flare. White: a ward only a parry, a punish or an Issen breaks.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const passive = G => { G.B.ai.t = 1e9; G.B.ai.pt = 0; G.B.ai.blk = 0; G.B.ai.seen = G.P.mvId; };
const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
// win against Gekkō and play on until the fight's end (the sun, or the result)
function beatGekko(game) { game.startFight(0, 1); const G = game.G; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; for (let i = 0; i < 900 && G.state !== 'sun' && G.state !== 'over'; i++) { G.rdt = 1 / 60; G.rt += 1 / 60; game.updGame(1 / 60); if (G.state === 'absorb' && G.st > 1) game.absorbDone(); } return G; }
function modes(game, o) { const s = game.SV; game.grantClear(s, 0, 'g'); Object.assign(s.modes, { sun: 1 }, o); for (const k of ['hell', 'white']) s.story.seen.push(k, ...game.MODES[k].missions.map(M => 'm:' + M.id)); s.story.pending = []; return s; }

module.exports = {
  async 'the first fall of Gekkō raises the sun; touching it offers both paths and opens neither by itself'() {
    const st = memoryStorage(), { game, el } = await boot({ storage: st }); game.enterGame(); const G = beatGekko(game);
    assert.strictEqual(G.state, 'sun', 'after the ceremony the sun rises'); assert.ok(el('sunBtn').classList.contains('off'), 'it cannot be touched at once');
    run(game, 3); assert.ok(!el('sunBtn').classList.contains('off'), 'then it can'); assert.strictEqual(game.SV.modes.hell || game.SV.modes.white, false, 'nothing opens by itself');
    el('sunBtn').click(); assert.strictEqual(open(el, game), 'sunp'); assert.strictEqual(el('suCards').children.length, 2);
    el('suCards').children[0].click(); assert.strictEqual(game.SV.modes.hell, true); assert.strictEqual(game.SV.modes.white, false);
    assert.ok(game.SV.rewardsClaimed['event:sun']); assert.ok(game.SV.rewardsClaimed['ach:sun'], 'The Light Awakens');
    el('nBtns').children[1].click(); assert.strictEqual(open(el, game), 'result', 'Later: the victory screen');
    const again = (await boot({ storage: st })).game.SV; assert.strictEqual(again.modes.hell, true, 'saved'); assert.strictEqual(again.modes.white, false);
  },

  async 'it rises only once; the map keeps the sun for the other path, then it is gone'() {
    const { game, el } = await boot(); game.enterGame(); let G = beatGekko(game); run(game, 3); game.openSunChoice(); el('suBtns').children[0].click();
    assert.strictEqual(game.SV.modes.sun, 0, 'Not yet: no choice made'); G = beatGekko(game); assert.strictEqual(G.state, 'sun', 'a later win offers it again until it is answered');
    run(game, 3); game.openSunChoice(); el('suCards').children[1].click(); assert.strictEqual(game.SV.modes.white, true); el('nBtns').children[1].click();
    G = beatGekko(game); assert.strictEqual(G.state, 'over', 'answered: the next win goes straight to its result');
    game.toMenu(); assert.ok(el('wpins').children.some(p => p.dataset.place === 'sun'), 'the sun waits for the dark path'); assert.ok(el('wpins').children.some(p => p.dataset.place === 'white'));
    game.selPlace('sun'); el('wiBtns').children[0].click(); assert.strictEqual(open(el, game), 'sunp'); assert.match(el('suText').textContent, /other path/);
    el('suCards').children[0].click(); el('nBtns').children[1].click(); game.toMenu(); assert.ok(!el('wpins').children.some(p => p.dataset.place === 'sun'), 'both open: the sun is gone');
  },

  async 'a save from before 1.7 with Gekkō beaten finds the sun on the map, with its scene'() {
    const st = memoryStorage(); st.setItem('issen-five-shadows', JSON.stringify({ beaten: 1 })); const { game, el } = await boot({ storage: st }); game.SV.story.pending = []; game.enterGame(); game.toMenu();
    assert.ok(el('wpins').children.some(p => p.dataset.place === 'sun')); game.startSunScene(); assert.strictEqual(game.G.state, 'sun'); assert.strictEqual(game.G.B.alpha, 0);
    run(game, 3); el('sunBtn').click(); assert.strictEqual(open(el, game), 'sunp');
  },

  async 'the main menu: both modes locked and explained until chosen, then they open their own missions and arenas'() {
    const { game, el } = await boot(); game.enterGame(); const hell = () => el('hMenu').children.find(b => b.innerHTML.startsWith('Hell Mode'));
    assert.ok(hell().className.includes('lock')); hell().click(); assert.match(el('nText').textContent, /Defeat Gekkō/);
    modes(game, { hell: true, white: true }); game.toHome(); hell().click(); assert.strictEqual(el('gTitle').textContent, 'Hell Mode'); assert.strictEqual(el('gNodes').children.length, 7);
    for (const [loc, arenas] of [['hell', [7, 8]], ['white', [9, 10]]]) for (let i = 0; i < 7; i++) {
      game.startMission(loc, i, 1); assert.ok(arenas.includes(game.G.arena), `${loc} ${i} in its own arena`); assert.strictEqual(!!game.G.hell, loc === 'hell'); assert.strictEqual(!!game.G.parry, loc === 'white'); }
  },

  async 'Hell: a demon strikes back at what it blocks and chains after a hit; healing halved, no tea; wounds carry between rounds'() {
    const { game } = await boot(); modes(game, { hell: true }); game.enterGame(); game.FOES.h_ghoul.ai.counter = 1; /* certain, for the test (its own VM) */ game.startMission('hell', 0, 1); const G = game.G; G.state = 'fight'; G.hint = 0;
    G.P.x = -100; G.B.x = 60; passive(G); G.B.ai.blk = 1; G.B.ai.low = false; G.buf = { a: 'slash', t: G.t }; let struck = false;
    run(game, 1.2, (G, i) => { if (i < 14) G.B.ai.blk = 1; else { G.B.ai.blk = 0; G.B.ai.t = 1e9; } if (i > 10 && G.B.st === 'move') struck = true; }); // it guards through the cut, then is free assert.ok(struck, 'it struck back right after blocking');
    near(G.P.mod.heal, game.derive(game.SV).mod.heal * .5, 'healing halved'); game.SV.gear.items.healing_tea = 3; game.equip(game.SV, 'item', 'healing_tea');
    game.startMission('hell', 6, 1); assert.strictEqual(game.G.tea, false, 'no tea in Hell'); const H = game.G; H.state = 'fight'; H.P.hp = 40; H.B.hp = 0; run(game, 4, passive);
    assert.strictEqual(H.round, 2); assert.strictEqual(H.P.hp, 40 + (H.P.maxHp - 40) * .5, 'half of what was lost comes back');
    game.startMission('hell', 1, 1); assert.strictEqual(game.G.L.hazards.length, 2, 'the river has its vents');
  },

  async 'White: the ward turns plain blows aside; a parry, a punish or an Issen breaks through'() {
    const { game } = await boot(); modes(game, { white: true }); game.enterGame(); game.startMission('white', 0, 1); let G = game.G; G.state = 'fight'; G.hint = 0; G.P.x = -60; G.B.x = 60; passive(G);
    G.buf = { a: 'kick', t: G.t }; run(game, .5, passive); near(G.B.maxHp - G.B.hp, 5 * .15, 'a plain kick glances off the ward');
    game.startMission('white', 0, 2); G = game.G; G.state = 'fight'; G.P.x = -100; G.B.x = 60; passive(G); game.startMove(G.B, 'r_slash'); run(game, .2, passive); G.keys.block = true; run(game, .3, passive); G.keys.block = false;
    assert.ok(G.B.wardOff > G.t, 'a parry shatters it'); run(game, .2, passive); G.P.x = -60; G.B.x = 60; const hp = G.B.hp; G.buf = { a: 'kick', t: G.t }; run(game, .5, passive); near(hp - G.B.hp, 5, 'then blows land in full');
    game.startMission('white', 0, 3); G = game.G; G.state = 'fight'; G.P.x = -60; G.B.x = 60; passive(G); G.P.ink = 100; G.buf = { a: 'issen', t: G.t }; run(game, 1.5, passive); near(G.B.maxHp - G.B.hp, 30, 'Issen passes the ward');
  },

  async 'mode victories count as their own stats, and the finals pay their exclusive gear once'() {
    const { game } = await boot(), s = modes(game, { hell: true, white: true }); s.daily = { day: '2000-01-01', ids: ['parry3'], base: { parries: 0 } }; game.setToday(() => '2000-01-01'); game.enterGame();
    game.startMission('hell', 6, 1); let G = game.G; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; run(game, 4, passive);
    assert.strictEqual(s.stats.hellWins, 1); assert.ok(s.gear.owned.includes('hellmaw_kanabo') && s.gear.owned.includes('trail_hellfire')); assert.ok(s.rewardsClaimed['ach:hell_done'], 'Lord of Ash');
    game.startMission('white', 6, 1); G = game.G; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0; run(game, 4, passive);
    assert.strictEqual(s.stats.whiteWins, 1); assert.ok(s.gear.owned.includes('sunlit_naginata') && s.gear.owned.includes('trail_dawn')); assert.ok(s.rewardsClaimed['ach:white_done'], 'Dawnbringer');
  },
};
