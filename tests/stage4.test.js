// v2 brief, stage 4: the sun as one exact state machine. Gekkō's first clear makes both paths eligible; the save keeps the
// acknowledgement (completed or skipped), the paths visited and the last one apart; every state and event does what SUNT says
// and nothing else; Back, Esc and the app going to the background never choose; killing the app anywhere keeps what was saved.
'use strict';
const assert = require('assert');
const { boot, run, memoryStorage } = require('../tools/harness');

const open = (el, game) => game.PANELS.find(p => !el(p).classList.contains('off')) || null;
const key = (game, code) => game.gameKey({ code, preventDefault() {}, target: null }, true);
// a profile that has beaten Gekkō, standing in the sun's scene (risen) or at its choice
async function at(state, storage) {
  const b = await boot({ storage }), { game } = b; game.grantClear(game.SV, 0, 'g'); game.SV.story.pending = []; game.writeSave(game.SV); game.enterGame();
  game.startSunScene(); run(game, 3); if (state === 'chosen') game.sunEvent('skip'); assert.strictEqual(game.G.state, state); return b;
}
const EVENTS = ['complete', 'skip', 'back', 'later', 'suspend', 'hell', 'white'];

module.exports = {
  async 'every state and event does what the table says, and an event the table lacks does nothing'() {
    for (const state of ['sun', 'chosen']) for (const ev of EVENTS) {
      const { game, el, win } = await at(state), rev = game.SV.rev, ack = game.SV.modes.ack, want = game.SUNT[state][ev] || null;
      const got = ev === 'suspend' ? (win.issenApp.pause(), 'stay') : game.sunEvent(ev), S = game.SV, msg = `${state} × ${ev}`;
      assert.strictEqual(got, want, msg);
      if (want === 'choice') { assert.strictEqual(game.G.state, 'chosen', msg); assert.strictEqual(open(el, game), 'sunp'); assert.strictEqual(S.modes.ack, 1, 'acknowledged and saved'); }
      else if (want === 'leave') { assert.strictEqual(game.G.state, 'over', msg); assert.notStrictEqual(open(el, game), 'sunp'); assert.strictEqual(S.modes.ack, ack, 'leaving saves nothing'); }
      else if (want === 'enter') { assert.strictEqual(S.modes.last, ev, msg); assert.ok(S.modes.visited[ev]); const other = ev === 'hell' ? 'white' : 'hell'; assert.ok(!S.modes.visited[other] && game.locOpen(S, other), 'the other stays open'); }
      else { assert.strictEqual(game.G.state, state, msg + ': unchanged'); assert.strictEqual(S.rev, rev, msg + ': nothing written'); assert.strictEqual(S.modes.last, null); }
    }
    const { game } = await at('sun'); game.startSunScene(); run(game, 1); assert.strictEqual(game.sunEvent('complete'), null, 'the sun cannot be touched before it has risen'); assert.strictEqual(game.SV.modes.ack, 0);
  },

  async 'Back, Esc, gamepad B and pause never choose; Enter touches the risen sun; Skip is there from the start'() {
    let b = await at('sun'); b.win.issenApp.back(); assert.strictEqual(b.game.G.state, 'over'); assert.strictEqual(b.game.SV.modes.ack, 0, 'Back: leaves, the sun still waits'); assert.ok(b.game.sunWaits(b.game.SV));
    b = await at('sun'); key(b.game, 'Escape'); assert.strictEqual(b.game.G.state, 'over', 'Esc: the same'); assert.strictEqual(b.game.SV.modes.last, null);
    b = await at('sun'); b.game.togglePause(); assert.strictEqual(b.game.G.state, 'sun', 'pause: nothing'); key(b.game, 'Enter'); assert.strictEqual(b.game.G.state, 'chosen', 'Enter: the sun touched');
    b.win.issenApp.back(); assert.strictEqual(b.game.G.state, 'over'); assert.strictEqual(b.game.SV.modes.last, null, 'Back at the choice: Later, nothing chosen');
    b = await at('chosen'); key(b.game, 'Escape'); assert.strictEqual(b.game.G.state, 'over'); assert.deepStrictEqual({ ...b.game.SV.modes.visited }, { hell: false, white: false });
    const { game, el } = await boot(); game.grantClear(game.SV, 0, 'g'); game.enterGame(); game.startSunScene(); assert.ok(!el('sunSkip').classList.contains('off'), 'Skip at once'); el('sunSkip').click();
    assert.strictEqual(game.G.state, 'chosen'); assert.ok(el('sunSkip').classList.contains('off')); game.sunEvent('later'); assert.ok(el('sunSkip').classList.contains('off') && el('sunBtn').classList.contains('off'));
  },

  async 'killed anywhere: what was saved stays, nothing is chosen for the player, both paths stay open'() {
    const st = memoryStorage(), { game } = await boot({ storage: st }); game.enterGame(); game.startFight(0, 1); const G = game.G; G.state = 'fight'; G.P.wins = 1; G.B.hp = 0;
    for (let i = 0; i < 900 && G.state !== 'sun'; i++) { G.rdt = 1 / 60; G.rt += 1 / 60; game.updGame(1 / 60); if (G.state === 'absorb' && G.st > 1) game.absorbDone(); }
    const xp = game.SV.profile.xp; let r = (await boot({ storage: st })).game.SV; // 1: killed while the sun rises
    assert.ok(r.rewardsClaimed['boss:gekko']); assert.strictEqual(r.profile.xp, xp, 'the victory paid once'); assert.strictEqual(r.modes.ack, 0); assert.strictEqual(r.modes.last, null);
    run(game, 3); game.sunEvent('complete'); r = (await boot({ storage: st })).game; // 2: killed at the choice
    assert.strictEqual(r.SV.modes.ack, 1); assert.ok(!r.sunWaits(r.SV), 'seen: it does not rise again'); assert.ok(r.locOpen(r.SV, 'hell') && r.locOpen(r.SV, 'white')); assert.strictEqual(r.SV.modes.last, null);
    game.sunEvent('white'); r = (await boot({ storage: st })).game.SV; // 3: killed in the chosen path
    assert.strictEqual(r.modes.last, 'white'); assert.deepStrictEqual({ ...r.modes.visited }, { hell: false, white: true }); assert.strictEqual(r.profile.xp, xp);
  },

  async 'a failed write at the sun: the choice still shows, the acknowledgement is not half-saved'() {
    const st = memoryStorage(), { game } = await at('sun', st); const set = st.setItem; st.setItem = () => { throw new Error('quota'); };
    assert.strictEqual(game.sunEvent('complete'), 'choice'); assert.strictEqual(game.SV.modes.ack, 0, 'rolled back in memory'); st.setItem = set;
    const r = (await boot({ storage: st })).game; assert.ok(r.sunWaits(r.SV), 'the sun still waits on the map'); assert.ok(!r.SV.rewardsClaimed['event:sun']);
  },

  async 'saves from 1.7 keep their meaning; the 1.7 fields are written for an older build'() {
    const { game } = await boot(), base = () => { const s = game.cleanSave({}); s.rewardsClaimed['boss:gekko'] = 1; s.progress.defeated = ['gekko']; s.progress.beaten = 1; return JSON.parse(JSON.stringify(s)); };
    let o = base(); o.modes = { sun: 1, hell: true, white: false }; let s = game.cleanSave(o);
    assert.strictEqual(s.modes.ack, 1); assert.deepStrictEqual({ ...s.modes.visited }, { hell: true, white: false }); assert.ok(game.locOpen(s, 'white'), 'the path not chosen in 1.7 is open now');
    assert.strictEqual(s.modes.sun, 1); assert.strictEqual(s.modes.hell, true); assert.strictEqual(s.modes.white, true, 'mirrored: an older build opens both');
    o = base(); o.modes = { sun: 0, hell: false, white: false }; s = game.cleanSave(o); assert.strictEqual(s.modes.ack, 0); assert.ok(game.sunWaits(s), 'Gekkō beaten, the sun never touched: it waits');
    s = game.cleanSave({ modes: { ack: 1, last: 'nowhere', visited: { hell: 'yes' } } }); assert.strictEqual(s.modes.last, null); assert.strictEqual(s.modes.visited.hell, false); assert.ok(!game.locOpen(s, 'hell'), 'no Gekkō, no path');
  },
};
