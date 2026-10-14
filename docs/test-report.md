# Test report: Issen 1.8 (versionCode 9)

## What was tested

| | |
|---|---|
| Game revision | `samurai-film` 0a0cfff664df2789ac8540e0c79adb040c73e0ba |
| Android shell revision | `issen-android` c24a4fab405082ab73383c4828354d120c811dee |
| APK | `Issen-FiveShadows-1.8.apk`, 312,454 bytes, `com.issen.fiveshadows` versionCode 9, versionName 1.8, minSdk 24, targetSdk 34 |
| **APK SHA-256** | **`7169f9b5a778ff3c31f8efc0191fb9dbc6ef47bfa5622d84ef369630448b9ac8`** |
| Signing certificate SHA-256 | `b9a812770075c1a69a4034f08c42d6ef59e8549f35f93b6eb753390ff94c277d`. This is the same certificate as 1.7, so 1.8 installs over it and keeps the save. |
| The site's download | `Issen-FiveShadows.apk`: a byte-for-byte copy of the APK above (the same SHA-256), published on the owner's go. The 1.7 build it replaced (versionCode 8, SHA-256 `a7fc7c7d7dd52a77aabdf826f3a4866784fe10a7b425d27ed629ccd679142eb9`) stays in git history, tag `backup-1.7-before-v2`. |

## Environment

| | |
|---|---|
| OS | Windows 11 Pro 10.0.26200 |
| Node | v24.21.0 (the test harness: the game in a `vm` with a stub DOM) |
| Browser | Google Chrome 155.0.8059.40, headless (Edge 155 was mid-update and would not start headless) |
| Android build | JDK 17.0.20.1, build-tools 34 (aapt2, d8, zipalign, apksigner), platform android-34; no Gradle |
| Python | 3.13.7 (`build.py`) |
| Devices | **None:** no Android phone, emulator, gamepad or iOS device was available |

## Results

| # | Scenario | How | Result |
|---|---|---|---|
| 1 | Unit and integration suite: 31 files, every stage of the brief | `node tests/run.js` on 0a0cfff | **Pass: 173 passed, 0 failed** |
| 2 | The twelve audited issues (stage 1) | `tests/reliability.test.js`, `tests/durable.test.js`, `tests/stage4.test.js`, `tests/stage5.test.js` | **Pass** (part of 1) |
| 3 | Durable attempts, rollback and retry on a failed write, epochs, a newer save never overwritten | `tests/durable.test.js` | **Pass** |
| 4 | Every 1.7 save loads with its progress (legacy claims, modes, story cards, crystals) | `tests/durable.test.js`, `tests/stage4.test.js`, `tests/save.test.js`, `tests/menu.test.js` | **Pass** |
| 5 | The sun: every state × event against `SUNT`, input routes, crash at every point, a failed write | `tests/stage4.test.js` | **Pass** |
| 6 | Lieutenants, throws, codex, frame data, hitbox geometry, required-only completion, respec | `tests/stage3.test.js`, `tests/ladder.test.js` | **Pass** |
| 7 | Tournament payouts and forfeits, reward-origin isolation, map validation and import, publish after a win, random-map winnability | `tests/stage5.test.js`, `tests/workshop.test.js` | **Pass** |
| 8 | Settings: opacity, captions, 30 fps, adaptive quality recovery | `tests/stage6.test.js`, `tests/settings.test.js` | **Pass** |
| 9 | Boss moves, bosses, arenas and the default hero unchanged | `tests/baseline.test.js` (golden). The only addition is `MV.throw`. | **Pass** |
| 10 | Every screen in a real browser, console clean | `node tools/smoke.js` (Chrome), served over http | **Pass:** every step, no console errors |
| 11 | The APK builds, aligns and signs; signature schemes v2 and v3 verify; same certificate as 1.7 | `python build.py 9 1.8 Issen-FiveShadows-1.8.apk`; `apksigner verify --print-certs` | **Pass** |
| 12 | The APK's own page, booted as the WebView loads it (from `file://`, app user agent): version, fonts, in-app hints hidden, shell hooks, a save surviving a reload, no console errors | `node tools/apk-check.js Issen-FiveShadows-1.8.apk` | **Pass: 7 of 7.** This check first found two real problems: the install manifest failing on `file://` (fixed by adding it only over http(s)), and the Pose Lab loading under `?debug` (by design: that tool never ships). |
| 13 | The site still offers the install manifest over http | headless Chrome against `tools/serve` | **Pass** |
| 14 | The navigation guard and file-access settings in `MainActivity` | Compiled and signed (11) | **Not run on a device** |

## To run on a phone (not done here)

Each needs a real Android device. Expected results are in brackets.

1. **Update over 1.7 with a save:** export a save code first, install `Issen-FiveShadows-1.8.apk` over 1.7 without uninstalling, then open the game. [v1.8 on the main menu; level, Shadows, mon and gear as before; ladders show the new lieutenants as unplayed.]
2. **Fresh install.** [It starts at level 1 and the film plays.]
3. **Back through every screen** (settings, shop, character, notices, the sun and its choice, the codex). [Each closes its own screen; the sun's choice is never made by Back.]
4. **Home or the app switcher during a fight, during the sun, during a ceremony.** [A fight pauses; the sun and the ceremony wait; nothing is chosen.]
5. **Swipe the app away mid-tournament, then relaunch.** [The run is gone and pays nothing; everything before it is kept.]
6. **Settings:**
   - 30 fps: does it play smoothly, and is battery use lower over 20 minutes?
   - Captions: are they legible at arm's length?
   - Touch opacity at 0.3: are the buttons still findable?
7. **Frame rate on a mid-range phone,** in the Burning Field and Hell's arena. [≥ 55 fps at 60, steady at 30; quality recovers after a busy moment.]
8. **Gamepad and iOS,** as in `docs/release.md`.

## Reproducing

```
cd samurai-film
node tests/run.js
node tools/smoke.js            # CHROME=<path to chrome.exe> if Edge will not start
cd ../issen-android && python build.py 9 1.8 Issen-FiveShadows-1.8.apk
cd ../samurai-film && node tools/apk-check.js Issen-FiveShadows-1.8.apk
certutil -hashfile Issen-FiveShadows-1.8.apk SHA256
```
