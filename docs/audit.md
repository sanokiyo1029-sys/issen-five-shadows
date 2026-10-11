# M1 audit: Issen — Five Shadows (2026-10-11)

Audited against `issen_master_prompt_v4.txt`, using the real source plus runs in the headless harness (`tools/harness.js`).

## Where the prompt and the code disagree (the code wins)

| Prompt §1 says | Code / project actually |
|---|---|
| Shipped build is v1.0 (versionCode 1) | The current release is **v1.2 (versionCode 3)**. v1.1 added the iOS memory fix and install hints. v1.2 added the performance pass, joystick takeover and Android edge-swipe exclusion. |
| Only the APK exists, with no sources or build script | The full source exists. `samurai-film/` is a Git repo, public on GitHub and published via Pages. `issen-android/` holds the Java shell, manifest, resources, `build.py` and the keystore; it was put under local Git in M1. |
| Hand-assembled, no Gradle (inference) | Confirmed: `build.py` runs aapt2 → javac → d8 → zip repack → zipalign → apksigner. |
| Signed with a key named ISSEN | The alias is `issen` (`CN=Issen, O=Issen`). `META-INF/ISSEN.*` is the upper-cased alias, so it's the same key. |
| `manifest.webmanifest` / `sw.js` are missing | **By design.** Both exist in the web build (PWA on Pages). They are left out of the APK because a WebView on `file://` cannot use a service worker. Audit item j: no action. |
| Touch renders at 0.67; dt capped at 0.05 | v1.2: the live canvas starts at 0.67 and steps down to 0.4 when frames fall below about 40 fps. The frame dt cap is 0.1 s, consumed in sub-steps of ≤0.05 s, so the game stays real-time down to 10 fps. Nothing redraws while paused. |
| Line numbers (index.html 1,019 lines) | 1,040 lines now. Use function names, not line numbers. |
| `window.game` / `window.film` are always exposed | **Fixed in M1:** exposed only with `?debug` or when a test harness sets `ISSEN_DEBUG`. |
| Back always goes to `issenApp.back()` | Still true. In addition, v1.2 excludes the whole view from Android 10+ edge-swipe Back, so a thumb on the joystick near the edge can't pause the fight. |

## Audit items (verified by running the game)

| # | Finding | Verified how | Decision |
|---|---|---|---|
| a | No keyboard Block key; only walk-away (touch has a Block button) | `KMAP` has no block entry | **M2** (§5.2a), with gamepad |
| b | Reposition attacks give little warning. **k_vanish**: hidden at 0.10–0.12 s, teleports at 0.50 s, visible at 0.55 s, hits at 0.60 s, so there is 0.05 s of visible cue. The keyboard "away" direction flips at the teleport. **y_phase**: fades from 0.13 s, visible again at 0.57 s, hits at 0.62 s. | Harness: forced each move and logged alpha, position and hit times at 60 Hz | **M2** (§5.2b): destination marker at vanish start |
| c | Only `g_dragon` has a telegraph (`tell`) | Scanned MV in the harness | **M2** telegraph standard |
| d | The save is unvalidated and unversioned. **New, worse than the prompt says:** `{"beaten":"abc"}` or a negative value **locks all five bosses, including the first** (a soft-lock). Bad JSON silently reads as 0, and the next win overwrites the raw text. | Harness: menu built from 5 corrupted saves | **Fixed in M3** (save v2: clamp, migrate, keep the legacy raw text) |
| e | `confirm()` on Reset in the WebView | The shell sets a plain `WebChromeClient`. Chromium WebView shows its default dialog when `onJsConfirm` isn't overridden. **Not tested on a device.** | Replace with an in-game confirm panel in M4 (settings) |
| f | Debug hooks exposed in release | Code | **Fixed in M1** (debug flag) |
| g | `Math.random` everywhere, so fights aren't reproducible | Code | Tests seed it in the harness, so fights replay identically (test "same seed, same fight"). The in-game seedable RNG lands in **M2** with the fixed-step sim. |
| h | Per-frame allocations: `G.fx.filter`, `G.proj.filter`, point arrays in every brush stroke, `P()` pose objects per fighter per frame | Code | **M8** performance pass. v1.2 already removed the big per-frame GPU costs. |
| i | Yuji Boku is a subset of **38 kanji**: 一五光勝参城墨壱始守寺将山師弐怒敗斬時月林止湖焼白竹終討跳蹴軍郎野鉄閃霞鬼鷺. Any other kanji silently falls back to a serif font. | Listed from `index.html` | M3 reuses only existing glyphs (月). A re-subset (Google Fonts `text=` or pyftsubset on the OFL source) is needed before M4–M5 add power kanji. |
| j | manifest/sw "missing" | See the table above | By design |
| k | Animation gaps: one jump pose (lean only); one hit pose (`STAG`); instant facing flip; no landing pose (straight to idle plus dust); moves start from the guard pose, so a move begun mid-walk pops; no weapon trails in the game | Read `poseOf` and `upd` | **M2** locomotion and hit-reaction pass |

## State of the build

- **Works:**
  - The 57 s film (play, seek, skip) and the menu.
  - The 5 bosses, best-of-3 rounds, timer, KO and result screens.
  - Keyboard and touch controls, pause, and the Back and lifecycle bridge.
  - PWA install and offline play; the Android APK.
  - Adaptive resolution.
  - The scripted bot finishes every boss fight headlessly.
- **Incomplete:** the controls panel documents walk-away blocking only for the keyboard. There is no settings screen.
- **Broken:** the corrupted-save soft-lock (item d).
- **Missing (per §1.7):** XP, levels, attributes, currency, equipment, other weapons, powers, ladders, dodge, keyboard block, gamepad, settings.

## Protection done in M1

- Tags `v1.1` and `v1.2-shipped` in the game repo.
- The shell repo initialised with `.gitignore` excluding `issen-release.keystore`, `keystore-password.txt` and `build/`, and tagged `v1.2-shipped`.
- Reproducible build proved (see `docs/build.md`).
- Golden baseline `tests/golden/baseline.json` (MV, BOSSES, ARENAS, HERO_D, functions by source text). `node tests/run.js` fails on any unintended change.
- **Action for the owner:** copy `issen-android/issen-release.keystore` and `keystore-password.txt` somewhere off this PC. Without them, no update can ever install over the current app.

## Decision record: where JSON data lives

The WebView loads the game from `file:///android_asset/`, where `fetch()` and XHR of sibling files are blocked by default. New engine-neutral data is therefore embedded as `<script type="application/json" id="data-…">` blocks in `index.html`. Each block has a `schema_version` and is checked by a validator at boot and in tests.

The same JSON text can be extracted for the Godot port (D8a). `MV` and `BOSSES` still contain pose and hook functions. They move to declarative tracks in M2 (§6.9), and the golden baseline guards that move.

## Plan

- **M3 (next, the §19 vertical slice):**
  - Save v2: two rotating slots, checksums, quarantine, export/import code, and migration from `{beaten:N}` with idempotent claims.
  - XP and levels from data.
  - Gekkō's victory ceremony granting **Spear of the Red Moon**, usable from power slot 1.
  - A character panel.
  - Restart persistence.
- **M2:** Block key and gamepad, telegraph standard and fairness fixes for b and c, dodge roll, seeded RNG in-game, a fixed 1/60 step, the locomotion and hit-reaction pass, and the Pose Lab.
  - The prompt orders M2 before M3. §19 explicitly makes the M3 slice the first action, so M2 follows it.
- **M4–M9:** as listed in the prompt.
