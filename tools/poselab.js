// Pose Lab and review sheets (spec §6.9). Debug only: index.html loads this file when the URL has ?debug, and the APK
// does not ship tools/. Open it from the map ("Pose Lab"), or with ?debug&lab or ?debug&lab=<move id>.
//  - Lab: pick a fighter and a move; play at 1x or 0.25x, step frames, scrub. Overlays: reach line and hit height, the
//    striking point's path (red while active, circled where it jumps > 60 px in a frame), the contact pose as a ghost, and
//    a timeline of windup / hit windows / tell / reposition marker. Timings edit live (they write the shared move table
//    for this session only) and export as JSON; pose sliders preview offsets and export them as a patch to apply later.
//  - Sheet (?debug&sheet=<move id>): a contact sheet of 12 frames plus the §6.6 checklist, captured by tools/capture.js.
//  - In a fight, the ` key toggles a frame-data overlay (state, move phase, reach lines, tell windows).
(() => {
'use strict';
const game = window.game; if (!game || !game.lab) return;
const L = game.lab, G = game.G, MV = game.MV, HMV = game.HERO_MV;
const PARAMS = ['tl', 'hd', 'ua1', 'fa1', 'ua2', 'fa2', 'sw', 'th1', 'sh1', 'th2', 'sh2'];
const HERO_MOVES = ['slash', 'slash2', 'slash3', 'lunge', 'low', 'kick', 'round', 'sweepK', 'air', 'airKick', 'wave', 'issen', ...Object.keys(HMV)];
const FIGHTERS = [{ name: 'Issen', def: game.HERO_D, moves: HERO_MOVES }, ...game.BOSSES.map(b => ({ name: b.name, def: b, moves: [...b.moves, ...(b.phase ? [b.phase.move] : [])] }))];
const KICKS = new Set(['kick', 'round', 'sweepK', 'airKick', 'b_kick', 'k_low']);
const DELIBERATE = m => !!(m.lunge || m.start || m.mark || m.issen || m.proj); // big jumps are the point of these moves
const moveOf = id => MV[id] || HMV[id];
const ownerOf = id => FIGHTERS.find(f => f.moves.includes(id)) || FIGHTERS[0];
const tipLen = k => k.spear ? 132 : k.club ? 150 : k.nagi ? 170 : k.blen || 112;

function poseAt(def, m, t, off) {
  const p = Object.assign(L.P(), L.kf(t, m.fr(def.guard)), def.wk);
  if (off) for (const k in off) p[k] += off[k];
  return Object.assign(p, { x: 0, f: 1, s: def.s, lift: p.lift || 0 });
}
// the striking point: the lead foot for kicks, the weapon tip otherwise (fighter-local px, ground at y = 0)
function striker(def, id, p) {
  if (KICKS.has(id)) { const J = L.joints(p, def.kind.L); return [J.f1[0] * p.s, (J.f1[1] + J.oy) * p.s - p.lift]; }
  return L.bladePt(p, def.kind, tipLen(def.kind));
}
function frameData(m) {
  const w = m.hit || (m.proj ? [[m.proj.t, m.proj.t]] : []), st = w.length ? w[0][0] : null, en = w.length ? w[w.length - 1][1] : null;
  return { startup: st, active: w.reduce((a, x) => a + x[1] - x[0], 0), recovery: en == null ? null : m.dur - en, windows: w };
}
const phaseAt = (m, t) => { const f = frameData(m); return f.startup == null ? '—' : t < f.startup ? 'windup' : f.windows.some(w => t >= w[0] && t <= w[1]) ? 'ACTIVE' : t < f.windows[f.windows.length - 1][1] ? 'between hits' : 'recovery'; };
const path = (def, id, m, off) => { const out = []; for (let i = 0; i <= Math.round(m.dur * 60); i++) out.push(striker(def, id, poseAt(def, m, i / 60, off))); return out; };

/** The §6.6 checklist for one move: ok true / false, or null for "review by eye". */
function checklist(id) {
  const m = moveOf(id), def = ownerOf(id).def, f = frameData(m), P = t => poseAt(def, m, t), J = t => { const p = P(t), j = L.joints(p, def.kind.L); return [j, p]; };
  const sil = (a, b) => { const [A, pa] = J(a), [B] = J(b); let d = 0; for (const k in A) if (Array.isArray(A[k])) d = Math.max(d, Math.hypot(A[k][0] - B[k][0], A[k][1] - B[k][1]) * pa.s); return d; };
  const tp = path(def, id, m), jumps = tp.slice(1).map((q, i) => Math.hypot(q[0] - tp[i][0], q[1] - tp[i][1])), maxJ = Math.max(...jumps), at = jumps.indexOf(maxJ) / 60;
  const out = [];
  if (f.startup == null) out.push({ n: 1, name: 'Anticipation', ok: null, detail: 'scripted move (no hit window): review by eye' });
  else { const s = sil(0, f.startup); out.push({ n: 1, name: 'Anticipation', ok: f.startup >= 2 / 60 && s >= 20, detail: `${f.startup.toFixed(2)} s windup; the silhouette moves ${s.toFixed(0)} px` }); }
  if (f.startup != null && !m.proj) {
    const xs = tp.map(q => q[0]), peak = xs.indexOf(Math.max(...xs)) / 60, w = f.windows[0];
    out.push({ n: 2, name: 'Contact', ok: peak >= w[0] - 2 / 60 && peak <= f.windows[f.windows.length - 1][1] + 2 / 60, detail: `furthest reach at ${peak.toFixed(2)} s; active ${w[0]}–${w[1]} s` });
  } else out.push({ n: 2, name: 'Contact', ok: null, detail: m.proj ? 'projectile: review the release pose' : 'review by eye' });
  out.push({ n: 3, name: 'Follow-through', ok: null, detail: `recovery ${f.recovery == null ? '—' : f.recovery.toFixed(2) + ' s'}: review the overshoot and the return to guard` });
  out.push({ n: 4, name: 'Arcs', ok: maxJ <= 60 || DELIBERATE(m), detail: `largest striking-point jump ${maxJ.toFixed(0)} px per frame at ${at.toFixed(2)} s${maxJ > 60 && DELIBERATE(m) ? ' (lunge / scripted: allowed)' : ''}` });
  if (m.lunge || m.start || m.mark || m.air) out.push({ n: 5, name: 'Feet planted', ok: null, detail: 'the move travels: review by eye' });
  else { const feet = t => { const [j, p] = J(t); return [j.f1[0] * p.s, j.f2[0] * p.s]; }, a = feet(0); let slide = 0;
    for (let i = 1; i <= Math.round(m.dur * 60); i++) { const b = feet(i / 60); slide = Math.max(slide, Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
    out.push({ n: 5, name: 'Feet planted', ok: slide <= 12, detail: `feet move ${slide.toFixed(0)} px against the ground${slide > 12 ? ' (the pose changes stance without a step: foot slide)' : ''}` }); }
  out.push({ n: 6, name: 'Timing and spacing', ok: null, detail: 'review the holds and the o5 strike' });
  out.push({ n: 7, name: 'Secondary motion', ok: false, detail: 'cloth reacts to wind only (planned, §6.6 #7)' });
  out.push({ n: 8, name: 'Trails', ok: m.proj || KICKS.has(id) ? null : false, detail: m.proj || KICKS.has(id) ? 'n/a' : 'no swing trail yet (planned, §6.6 #8)' });
  out.push({ n: 12, name: 'Time-based', ok: true, detail: 'poses are evaluated from time in seconds' });
  out.push({ n: 13, name: 'No pops', ok: true, detail: 'entered through the state blend (tools/pops.js)' });
  return out;
}

/* ---------- drawing ---------- */
const X = L.X, ink = L.ink;
function ground(c, x0, x1) { c.strokeStyle = ink(.35); c.lineWidth = 2; L.line(c, [x0, 0], [x1, 0]); }
function drawPath(c, pts, m, scale = 1, now = -1) {
  const f = frameData(m), act = i => f.windows.some(w => i / 60 >= w[0] && i / 60 <= w[1]);
  for (let i = 1; i < pts.length; i++) {
    c.strokeStyle = act(i) ? L.RED : ink(.45); c.lineWidth = (act(i) ? 4 : 2) / scale; L.line(c, pts[i - 1], pts[i]);
    if (Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) > 60 && !DELIBERATE(m)) { c.lineWidth = 2 / scale; c.strokeStyle = L.RED; c.beginPath(); c.arc(pts[i][0], pts[i][1], 14 / scale, 0, 6.3); c.stroke(); }
  }
  if (now >= 0 && pts[now]) { c.fillStyle = L.INK; L.circ(c, pts[now][0], pts[now][1], 7 / scale); }
}
function timeline(c, m, t, x, y, w) {
  const f = frameData(m), sx = v => x + v / m.dur * w;
  c.fillStyle = ink(.18); c.fillRect(x, y, w, 18);
  if (f.startup != null) { c.fillStyle = ink(.4); c.fillRect(x, y, sx(f.startup) - x, 18); }
  c.fillStyle = L.RED; for (const v of f.windows) c.fillRect(sx(v[0]), y, Math.max(3, sx(v[1]) - sx(v[0])), 18);
  c.strokeStyle = L.RED; c.lineWidth = 2; if (m.tell) c.strokeRect(sx(m.tell[0]), y - 12, sx(m.tell[1]) - sx(m.tell[0]), 8);
  c.strokeStyle = ink(.7); if (m.mark) c.strokeRect(sx(m.mark[0]), y + 22, sx(m.mark[1]) - sx(m.mark[0]), 6);
  c.fillStyle = ink(.6); for (let v = 0; v <= m.dur + 1e-9; v += .1) c.fillRect(sx(v), y + 18, 1, 6);
  c.fillStyle = L.INK; c.fillRect(sx(t) - 1.5, y - 16, 3, 50);
  c.font = '500 18px "Cormorant Garamond", serif'; c.textAlign = 'left'; c.fillStyle = ink(.75);
  c.fillText('windup · hit · recovery     ▭ red: tell     ▭ grey: reposition marker', x, y + 48);
}

/* ---------- the lab ---------- */
const LAB = { fi: 0, id: 'slash', t: 0, speed: 1, playing: true, off: Object.fromEntries(PARAMS.map(k => [k, 0])), ui: null };
function labFrame(dt) {
  const m = moveOf(LAB.id); if (LAB.playing) { LAB.t += dt * LAB.speed; if (LAB.t > m.dur + .35) LAB.t = 0; }
  const t = Math.min(LAB.t, m.dur), fr = FIGHTERS[LAB.fi], def = fr.def, s = def.s, p = poseAt(def, m, t, LAB.off), c = X;
  L.screen(c); c.fillStyle = L.PAPER; c.fillRect(0, 0, L.W, L.H);
  L.setCam({ x: 140, y: -230, z: 1.25 }, 0, 0); L.camT(c, 1); ground(c, -900, 900);
  const reach = m.reach ? m.reach * s + 20 : null, zy = m.zone || m.proj && m.proj.zone || 'mid';
  if (reach) { c.globalAlpha = .16; L.fig(c, Object.assign(L.P(), game.HERO_D.guard, { x: reach + 14, f: -1, s: 1 }), game.HERO_D.kind, 0); c.globalAlpha = 1;
    c.strokeStyle = L.RED; c.lineWidth = 2; c.setLineDash([10, 8]); L.line(c, [reach, 10], [reach, -330]); c.setLineDash([]); L.line(c, [reach - 26, L.ZY[zy]], [reach + 26, L.ZY[zy]]); }
  const f = frameData(m), tp = path(def, LAB.id, m, LAB.off);
  if (f.startup != null) { c.globalAlpha = .18; L.fig(c, poseAt(def, m, f.windows[0][0], LAB.off), def.kind, 0); c.globalAlpha = 1; }
  L.fig(c, p, def.kind, G.rt); drawPath(c, tp, m, 1, Math.min(tp.length - 1, Math.round(t * 60)));
  L.screen(c); timeline(c, m, t, 160, 960, 1600);
  c.fillStyle = L.INK; c.textAlign = 'left'; c.font = '600 34px "Cormorant Garamond", serif'; c.fillText(`${fr.name} · ${LAB.id}`, 60, 70);
  c.font = '500 22px "Cormorant Garamond", serif'; const fd = v => v == null ? '—' : v.toFixed(2);
  [`t ${t.toFixed(3)} s · frame ${Math.round(t * 60)} / ${Math.round(m.dur * 60)} · ${phaseAt(m, t)} · ${LAB.speed === 1 ? '1×' : '¼×'}${LAB.playing ? '' : ' · paused'}`,
   `startup ${fd(f.startup)} · active ${fd(f.active)} · recovery ${fd(f.recovery)} · reach ${m.reach || (m.proj ? 'projectile' : '—')} · dmg ${m.dmg ?? (m.proj && m.proj.dmg) ?? '—'} ${zy}${m.kd || m.proj && m.proj.kd ? ' · knockdown' : ''}`,
   `answers: ${(m.answers || ['—']).join(', ')}${m.tell ? ` · tell ${m.tell.join('–')} s` : ''}${m.mark ? ` · marker ${m.mark.join('–')} s` : ''}`,
   'Space play · ← → frame · [ ] move · Esc close'].forEach((s, i) => c.fillText(s, 60, 108 + i * 30));
}
function labUI() {
  const box = document.createElement('div'); box.id = 'lab';
  box.style.cssText = 'position:fixed;top:8px;right:8px;z-index:50;width:290px;max-height:96vh;overflow:auto;background:rgba(236,229,214,.94);color:#15130f;border:1px solid rgba(21,19,15,.5);padding:10px;font:13px/1.35 Georgia,serif';
  const opt = (v, t, s) => `<option value="${v}"${s ? ' selected' : ''}>${t}</option>`;
  box.innerHTML = `<b>Pose Lab</b> <button id="lbClose" style="float:right">close</button>
   <div><select id="lbF">${FIGHTERS.map((f, i) => opt(i, f.name, i === LAB.fi)).join('')}</select> <select id="lbM"></select></div>
   <div><button id="lbPlay">play / pause</button> <button id="lbSp">1× / ¼×</button> <button id="lbPrev">◀ frame</button> <button id="lbNext">frame ▶</button></div>
   <div><input id="lbT" type="range" min="0" max="1" step="0.001" style="width:100%"></div>
   <div><b>Timings</b> (live, this session)</div><div id="lbTim"></div>
   <div><b>Pose offsets</b> (preview, radians)</div><div id="lbPose"></div>
   <div><button id="lbExp">export timings</button> <button id="lbPatch">export pose patch</button> <button id="lbZero">zero offsets</button></div>
   <textarea id="lbOut" rows="5" style="width:100%;font:11px monospace"></textarea>`;
  document.body.appendChild(box);
  const $ = id => document.getElementById(id), fields = [['dur', m => m.dur, (m, v) => { m.dur = v; }], ['hit start', m => m.hit && m.hit[0][0], (m, v) => { m.hit[0][0] = v; }],
    ['hit end', m => m.hit && m.hit[0][1], (m, v) => { m.hit[0][1] = v; }], ['reach', m => m.reach, (m, v) => { m.reach = v; }], ['dmg', m => m.dmg, (m, v) => { m.dmg = v; }],
    ['tell from', m => m.tell && m.tell[0], (m, v) => { m.tell[0] = v; }], ['tell to', m => m.tell && m.tell[1], (m, v) => { m.tell[1] = v; }]];
  const fill = () => {
    const fr = FIGHTERS[LAB.fi]; $('lbM').innerHTML = fr.moves.map(id => opt(id, id, id === LAB.id)).join('');
    const m = moveOf(LAB.id); $('lbT').max = m.dur;
    $('lbTim').innerHTML = fields.map(([n, get], i) => get(m) == null ? '' : `<label style="display:inline-block;width:48%">${n} <input data-i="${i}" type="number" step="0.01" value="${get(m)}" style="width:62px"></label>`).join('');
    $('lbPose').innerHTML = PARAMS.map(k => `<label style="display:block">${k} <input data-k="${k}" type="range" min="-1" max="1" step="0.01" value="${LAB.off[k]}" style="width:180px;vertical-align:middle"> <span>${LAB.off[k].toFixed(2)}</span></label>`).join('');
    for (const e of $('lbTim').querySelectorAll('input')) e.oninput = () => { const v = parseFloat(e.value); if (Number.isFinite(v)) fields[+e.dataset.i][2](moveOf(LAB.id), v); };
    for (const e of $('lbPose').querySelectorAll('input')) e.oninput = () => { LAB.off[e.dataset.k] = +e.value; e.nextElementSibling.textContent = (+e.value).toFixed(2); };
  };
  $('lbF').onchange = () => { LAB.fi = +$('lbF').value; LAB.id = FIGHTERS[LAB.fi].moves[0]; LAB.t = 0; fill(); };
  $('lbM').onchange = () => { LAB.id = $('lbM').value; LAB.t = 0; fill(); };
  $('lbPlay').onclick = () => { LAB.playing = !LAB.playing; }; $('lbSp').onclick = () => { LAB.speed = LAB.speed === 1 ? .25 : 1; };
  $('lbPrev').onclick = () => step(-1); $('lbNext').onclick = () => step(1); $('lbT').oninput = () => { LAB.playing = false; LAB.t = +$('lbT').value; };
  $('lbExp').onclick = () => { const m = moveOf(LAB.id); out(JSON.stringify({ move: LAB.id, dur: m.dur, hit: m.hit, reach: m.reach, dmg: m.dmg, tell: m.tell, mark: m.mark }, null, 1)); };
  $('lbPatch').onclick = () => out(JSON.stringify({ move: LAB.id, fighter: FIGHTERS[LAB.fi].name, at: +LAB.t.toFixed(3), offsets: Object.fromEntries(Object.entries(LAB.off).filter(e => e[1])) }, null, 1));
  $('lbZero').onclick = () => { for (const k of PARAMS) LAB.off[k] = 0; fill(); };
  $('lbClose').onclick = closeLab;
  const out = s => { $('lbOut').value = s; try { navigator.clipboard.writeText(s); } catch (e) {} };
  LAB.fill = fill; fill(); return box;
}
const step = d => { LAB.playing = false; LAB.t = Math.max(0, Math.min(moveOf(LAB.id).dur, Math.round(LAB.t * 60 + d) / 60)); };
function labKey(e) {
  if (!G.lab || e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const fr = FIGHTERS[LAB.fi], i = fr.moves.indexOf(LAB.id);
  if (e.code === 'Space') LAB.playing = !LAB.playing; else if (e.code === 'ArrowLeft') step(-1); else if (e.code === 'ArrowRight') step(1);
  else if (e.code === 'BracketLeft' || e.code === 'BracketRight') { LAB.id = fr.moves[(i + (e.code === 'BracketRight' ? 1 : -1) + fr.moves.length) % fr.moves.length]; LAB.t = 0; LAB.fill(); }
  else if (e.code === 'Escape') closeLab(); else return;
  e.preventDefault(); e.stopImmediatePropagation();
}
function openLab(id) {
  if (id && moveOf(id)) { LAB.id = id; LAB.fi = FIGHTERS.indexOf(ownerOf(id)); }
  game.enterGame(); L.show(null); L.setMode('lab'); G.lab = labFrame; if (!LAB.ui) LAB.ui = labUI(); else { LAB.ui.style.display = ''; LAB.fill(); }
}
function closeLab() { G.lab = null; if (LAB.ui) LAB.ui.style.display = 'none'; game.toMenu(); }

/* ---------- review sheet ---------- */
function sheet(id) {
  const m = moveOf(id), fr = ownerOf(id), def = fr.def, f = frameData(m), c = X, n = 12, ts = [];
  for (let i = 0; i < n; i++) ts.push(m.dur * i / (n - 1));
  if (f.startup != null) { const k = ts.reduce((b, v, i) => Math.abs(v - f.startup) < Math.abs(ts[b] - f.startup) ? i : b, 0); ts[k] = f.startup; }
  L.screen(c); c.fillStyle = L.PAPER; c.fillRect(0, 0, L.W, L.H); c.fillStyle = L.INK; c.textAlign = 'left';
  c.font = '600 36px "Cormorant Garamond", serif'; c.fillText(`${id} — ${fr.name}`, 40, 56);
  const fd = v => v == null ? '—' : v.toFixed(2);
  c.font = '500 22px "Cormorant Garamond", serif';
  c.fillText(`dur ${m.dur} s · startup ${fd(f.startup)} · active ${fd(f.active)} · recovery ${fd(f.recovery)} · reach ${m.reach || (m.proj ? 'projectile' : '—')} · dmg ${m.dmg ?? (m.proj && m.proj.dmg) ?? '—'} · ${m.zone || m.proj && m.proj.zone || ''}${m.kd ? ' · knockdown' : ''}${m.answers ? ' · answers ' + m.answers.join(', ') : ''}`, 40, 92);
  const tp = path(def, id, m), sc = .62 / def.s;
  ts.forEach((t, i) => {
    const cx = 40 + (i % 6) * 310 + 120, gy = 140 + Math.floor(i / 6) * 350 + 300, ph = phaseAt(m, t);
    c.setTransform(L.QS(), 0, 0, L.QS(), 0, 0); c.translate(cx, gy); c.scale(sc, sc); ground(c, -170 / sc, 330 / sc);
    c.globalAlpha = .5; drawPath(c, tp, m, sc); c.globalAlpha = 1; L.fig(c, poseAt(def, m, t), def.kind, 0);
    L.screen(c); c.fillStyle = ph === 'ACTIVE' ? L.RED : ink(.75); c.font = '600 20px "Cormorant Garamond", serif'; c.textAlign = 'left';
    c.fillText(`${t.toFixed(2)} s · f${Math.round(t * 60)} · ${ph}`, cx - 110, gy + 30);
  });
  const cl = checklist(id); c.font = '500 19px "Cormorant Garamond", serif'; c.textAlign = 'left';
  cl.forEach((r, i) => { c.fillStyle = r.ok === false ? L.RED : L.INK; c.fillText(`${r.ok === true ? 'pass' : r.ok === false ? 'NEEDS WORK' : 'review'} · ${r.n} ${r.name}: ${r.detail}`, 40 + (i % 2) * 940, 870 + Math.floor(i / 2) * 32); });
  return cl;
}

/* ---------- in-fight frame-data overlay (` key) ---------- */
function overlay(c) {
  L.camT(c, 1); c.font = '600 22px "Cormorant Garamond", serif'; c.textAlign = 'center';
  for (const F of [G.P, G.B]) {
    const m = F.st === 'move' && F.mv, O = F === G.P ? G.B : G.P, id = m ? Object.keys(MV).find(k => MV[k] === m) || Object.keys(HMV).find(k => HMV[k] === m) : '';
    c.fillStyle = L.INK; c.fillText(`${F.st}${m ? ` ${id} ${F.mvT.toFixed(2)}/${m.dur} ${phaseAt(m, F.mvT)}` : ''}${F.inv > 0 || game.rollInv(F) ? ' · invulnerable' : ''}`, F.x, F.y - 290 * F.def.s);
    if (m && m.reach) { const r = F.x + F.f * (m.reach * F.def.s + 20 * O.def.s); c.strokeStyle = m.tell && F.mvT > m.tell[0] && F.mvT < m.tell[1] ? L.RED : ink(.6); c.lineWidth = 3; c.setLineDash([8, 8]); L.line(c, [r, 0], [r, -300]); c.setLineDash([]); }
  }
  L.screen(c);
  [G.P, G.B].forEach((F, i) => { const m = F.st === 'move' && F.mv; if (m) timeline(c, m, F.mvT, i ? 1100 : 100, 250, 700); });
}

addEventListener('keydown', e => { if (e.code === 'Backquote' && L.MODE() === 'game') { G.overlay = G.overlay ? null : overlay; e.preventDefault(); } }, true);
addEventListener('keydown', labKey, true);
window.poseLab = { checklist, frameData, sheet, openLab, closeLab, overlay, FIGHTERS, moveOf, LAB };

// entry points: a "Pose Lab" link on the map; ?debug&lab[=<move>] opens it; ?debug&sheet=<move> draws a review sheet
const q = new URLSearchParams(location.search), help = document.getElementById('mHelp');
if (help) { help.insertAdjacentHTML('afterend', '<button class="lnk" id="mLab">Pose Lab</button>'); const b = document.getElementById('mLab'); if (b) b.onclick = () => openLab(); }
const whenReady = fn => { const go = () => L.MIST ? fn() : setTimeout(go, 50); go(); };
if (q.has('lab')) whenReady(() => openLab(q.get('lab')));
if (q.has('sheet')) whenReady(() => { game.enterGame(); L.show(null); L.setMode('lab'); for (const e of document.querySelectorAll('.cover,#bar,#skip,#install')) e.style.display = 'none'; /* no fade-out mid-capture */ const cl = sheet(q.get('sheet')); G.lab = () => {}; document.title = 'sheet ' + q.get('sheet') + ' ' + cl.filter(r => r.ok === false).length; });
})();
