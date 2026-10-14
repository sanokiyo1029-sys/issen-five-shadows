# Feature status: 1.8 against the v2 brief

**Done** means implemented and covered by automated evidence (a test in `tests/`, or a tool's output). **Device** means implemented and checked here, but only a real phone can confirm it (see `docs/test-report.md`). **Deferred** and **Open** are not done, with the reason.

## Stage 0: inventory, backup, compatibility

| Item | Status | Evidence |
|---|---|---|
| Backup before changes | Done | git tag `backup-1.7-before-v2`; the 1.7 APK is kept unchanged next to the 1.8 one |
| Compatibility plan: every 1.7 save loads | Done | `tests/durable.test.js` (legacy claims), `tests/stage4.test.js` (1.7 modes), `tests/save.test.js` |

## Stage 1: the twelve audited issues

| # | Issue | Status | Evidence |
|---|---|---|---|
| 1 | Back pressed a dialog's first button | Done | `tests/reliability.test.js` |
| 2 | Failed writes were ignored | Done | `tests/durable.test.js` (commit, rollback, retry) |
| 3 | `lastWin` covered only the latest fight | Done | `tests/durable.test.js` (attempt ledger, receipts, epochs) |
| 4 | A clock set back repaid dailies | Done | `tests/durable.test.js` |
| 5 | Supply charges could be dodged | Done | `tests/durable.test.js`, `tests/shop.test.js` |
| 6 | No renewable mon or materials | Done | `tests/durable.test.js`; `docs/economy.md` |
| 7 | The sun coupled seeing it with choosing a path | Done | `tests/stage4.test.js` |
| 8 | Suspending opened the sun's choice and kept buffers | Done | `tests/reliability.test.js`, `tests/stage4.test.js` |
| 9 | The AI blocked instantly | Done | `tests/reliability.test.js` |
| 10 | Double KO / equal timeout went to the player | Done | `tests/reliability.test.js` |
| 11 | Champion / flawless filters; damage counted after healing | Done | `tests/durable.test.js` |
| 12 | Map import and validation | Done | `tests/stage5.test.js` |

## Stage 2: durable progress and the economy

| Item | Status | Evidence |
|---|---|---|
| Attempts and transactions | Done | `tests/durable.test.js` |
| Stable mission ids with legacy mapping | Done | `tests/durable.test.js`, `docs/save-format.md` |
| Profile epoch | Done | `tests/durable.test.js` |
| A save from a newer version is never overwritten | Done | `tests/durable.test.js` |
| Damaged copies disclosed | Done | `tests/durable.test.js`, `tests/save.test.js` |
| Renewable economy and simulation tables | Done | `docs/economy.md` (`tools/economy.js`) |
| Respec route | Done | Attributes (1.7) and power tiers (1.8): `tests/stage3.test.js` |

## Stage 3: the campaign

| Item | Status | Evidence |
|---|---|---|
| Two required lieutenants per region, teaching the Shadow's mechanics; the 19 steps kept | Done | `tests/stage3.test.js`, `tests/ladder.test.js` |
| Throws, with the encyclopedia and a drill | Done | `tests/stage3.test.js` |
| Move tables per weapon family; modifier order; input-buffer evaluation | Done | `docs/moves.md` (`tools/move-tables.js`) |
| Training: enemy registry, accurate hitboxes, frame-data diagnostics | Done | `tests/stage3.test.js` |
| Required-only completion, optional shown apart | Done | `tests/stage3.test.js` |

## Stage 4: the sun

| Item | Status | Evidence |
|---|---|---|
| Both paths eligible after Gekkō; separate ack / eligibility / visits / last path | Done | `tests/stage4.test.js`, `tests/modes.test.js` |
| Skip; choosing navigates and locks nothing; Back and backgrounding never select | Done | `tests/stage4.test.js` |
| Transition table and crash tests | Done | `SUNT` in `index.html`; `tests/stage4.test.js` |

## Stage 5: repeatable content and safe rewards

| Item | Status | Evidence |
|---|---|---|
| Tournament, gauntlet and endless survival with named rules and a payout policy (partial runs included) | Done | `tests/stage5.test.js`; the policy is shown in the game and in `docs/economy.md` |
| Editor validation hardening; a verified win before publishing | Done | `tests/stage5.test.js` |
| A winnability smoke test | Done | `tests/stage5.test.js` (random valid maps crossed and won) |
| Reward-origin isolation | Done | `tests/stage5.test.js` |

## Stage 6: Android delivery

| Item | Status | Evidence |
|---|---|---|
| WebView navigation restricted; file and content access off | Device | Compiles and signs (`build.py`); the page side checked by `tools/apk-check.js`; behaviour on a phone untested |
| WebViewAssetLoader evaluated, `file://` origin kept | Done (decision) | `docs/release.md` |
| 30 fps option; adaptive quality recovery | Done, Device for battery | `tests/stage6.test.js` |
| Touch opacity; captions | Done, Device for legibility | `tests/stage6.test.js` |
| Test report (scenario, revision, APK SHA-256, environment, result) | Done | `docs/test-report.md` |
| Feature status table | Done | this file |
| Asset and license manifest | Done, one open item | `docs/assets.md` (the OFL text should ship with the fonts) |
| Changelog | Done | `docs/changelog.md` |
| APK with hash and install instructions | Done | `Issen-FiveShadows-1.8.apk`; `docs/test-report.md`, `docs/release.md` |

## Open, and why

- **Every Device item:** there is no Android device, emulator or gamepad on this PC. `docs/test-report.md` lists what to run on a phone.
- **Fonts' OFL text:** it should ship alongside the fonts (`docs/assets.md`).
- **Publishing:** pushing updates the live site and the APK it offers. That is the owner's call. Store publication is a separate step and not part of this release.
