# Acceptance checklist: release 1.7 (Ultimate Edition) and the §17.2 list

`node tests/run.js` runs the 89 headless tests. `node tools/smoke.js` walks every screen in headless Edge and fails on any console error. Both passed on 2026-10-12.

| # | Spec item | Evidence | State |
|---|---|---|---|
| 1 | The game starts; film, skip, menu, fullscreen | `tools/smoke.js` (boot, film skip, map, film seek / render); the fullscreen button exists | ✅ automated (fullscreen by hand) |
| 2 | Move, jump, crouch, block, attacks, chain, lunge, low, kicks, Ink Wave, Issen | `tests/sim.test.js` (scripted exchange), `fight`, `input`, `anim` | ✅ |
| 3 | Damage, blocking, knockback, knockdown, armor, ink, duplicate-hit protection | golden baseline, `fairness`, `powers`, `rpg` (derived damage), `settings` (whiff punish) | ✅ |
| 4 | Rounds, timer, best of three; start / end / retry / restart | `fight`, `ladder` (one-round retainers, retries keep the checkpoint), `release` (Back) | ✅ |
| 5 | Block key, roll, gamepad, and no spam into invulnerability | `input`, `roll` (spam stays under 30% invulnerable and still gets hit) | ✅ logic; a physical pad is untested |
| 6 | XP formula, level-ups, attribute points and caps | `progression`, `rpg` | ✅ |
| 7 | Each boss grants its power, XP and skill points once (replay, double dispatch, kill mid-sequence) | `progression`, `save`, `ladder` (step / trial claims) | ✅ |
| 8 | Each power works, each tier changes behavior, the AI handles each power | `powers` (every power against every boss), `ladder` (tiers IV–V), `rpg` (tiers II–III) | ✅ |
| 9 | Loadouts and echoes persist and cannot change mid-fight | `rpg`, `charscreen` | ✅ |
| 10 | Legacy saves migrate (N = 0–5); corrupted / missing saves; export / import | `save` | ✅ |
| 11 | Ladder progression and region unlocks | `ladder` | ✅ |
| 12 | Equipping / upgrading leaves every boss identical | `rpg`, `gear` (golden comparisons, no boss move overrides) | ✅ |
| 13 | Android: touch, safe areas, pause / resume, Back, process death, update over install. PC: keyboard, mouse, gamepad, resize, fullscreen, persistent save | `release` (Back / Esc), `roll` (touch geometry), the `bgPause` lifecycle hooks, `docs/release.md` (PWA + persist) | ⚠️ logic automated; **device behavior untested** (see `docs/release.md`) |
| 14 | No console errors; frame-time baseline compared | `tools/smoke.js` (none); `docs/performance.md` (M3, M2 and M8 compared) | ✅ desktop; ⚠️ phone untested |
| 15 | Animation review sheets, no-pop script, hit reactions / jump / landing / turn / roll | 85 sheets in `docs/animation-review/`; `anim` (no pop over 60 px); `reach` (§6.3) | ✅, with known issues listed (foot slide, boss reach exceptions) |
| 16 | Effects tiers and power effects hold frame rate; Low quality works | `perf.js` (no regression); `settings` (Low drops the halo and trails) | ✅ desktop; ⚠️ weak-phone untested |

**Design checks the spec asks for, also automated:**
- The fairness audit, with every answer verified by simulation (`docs/fairness.md`).
- The effective-power cap: ≤ 1.75× from attributes and echoes, ≤ 2.0× with gear.
- The XP targets: level 11 after the campaign, level 19 with every trial.
- Font coverage: every kanji on screen is in the subset.
- Replay determinism.

## 1.7: the Ultimate Edition test list (brief §13)

`node tests/run.js` and `node tools/smoke.js` both pass. The smoke test walks the main menu, shop, inventory, challenges, training, world map, workshop and editor, a custom map, Hell, White and Ashen Village in headless Edge, with no console errors.

| Requirement | Evidence | State |
|---|---|---|
| The game launches successfully | `tools/smoke.js` (boot to the end of the walk); every test boots the page | ✅ |
| The main menu buttons work | `menu.test.js` (each entry opens its screen; locked ones explain); `modes.test.js` (Hell / White entries); smoke | ✅ |
| Mon and shadow crystals update correctly | `menu.test.js` (crystals once per claim, backfill); `shop.test.js`; `challenges.test.js`; `world.test.js`; `modes.test.js` | ✅ |
| Purchases deduct the correct amount | `shop.test.js` (exact price, once; refusals take nothing; an unsaved purchase is undone; never negative) | ✅ |
| Rewards are granted once per intended event | Claims for bosses, steps, trials, missions, dailies, achievements, drills and the sun; `lastWin` replays; tests in `menu`, `challenges`, `world`, `training` and `modes` | ✅ |
| Save data survives restarting the app | Restart tests in `menu`, `shop`, `world`, `workshop` and `modes`; the 1.6 save tests | ✅ logic; ⚠️ a real Android process death untested |
| The first boss triggers the sun event exactly as intended | `modes.test.js` (after the ceremony; untouchable for 2.4 s; once; Later; old saves; the map's sun) | ✅ |
| Clicking the sun opens the Hell / White choice | `modes.test.js`, smoke | ✅ |
| Both modes load their correct missions and visual themes | `modes.test.js` (all 14 missions, their arenas, Hell / White rules); screenshots reviewed | ✅ |
| The training room works without damaging campaign progression | `training.test.js` (the save is byte-identical after free practice; no stats; drills pay once) | ✅ |
| Custom maps can be created, saved, loaded and played | `workshop.test.js` (editor, storage, codes, validation, play, waves) | ✅ |
| Locked areas cannot be entered prematurely | `world.test.js` (locked markers, missions in order), `modes.test.js` (sealed modes), `shop.test.js` (closed stock), the 1.6 ladder tests | ✅ |
| Android navigation and screen scaling work | Back on every new screen (`release.test.js` plus each panel's Back); layouts checked at 1920×1080 and 800×360 | ✅ logic; ⚠️ device untested |
| No major crashes, missing assets or broken transitions | Smoke walk with no console errors; fairness audit (41 moves); golden baseline: only additions | ✅ |

**Design guarantees, also automated:**

- The 2.0× effective-power budget with every armour, charm and weapon variant.
- Variants never beat their class.
- Cosmetics change no number.
- Every new attack carries a tell and at least two simulated answers.
- The campaign is unchanged: golden baseline, sim and fairness tests.
