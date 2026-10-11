# Acceptance checklist (spec §17.2): release 1.6

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
