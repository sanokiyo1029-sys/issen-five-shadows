# Release 1.6: Android APK and PC (M9)

## How to play

| Platform | How | Save lives in |
|---|---|---|
| **Android** | Install `Issen-FiveShadows.apk` (sideload; versionCode 7). Updates install over 1.0–1.5 because they are signed with the same key. | The WebView's DOM storage in the app's data directory (`app_webview/`). |
| **PC: browser / installed app** | Open https://sanokiyo1029-sys.github.io/issen-five-shadows/ in Chrome or Edge, then "Install the app" (the install hint on the cover, or the browser's install icon). It runs in its own window and works offline. | That origin's storage. The game asks `navigator.storage.persist()`, which installed apps are normally granted. |
| **PC: fully local** | Run `node tools/serve.js`, then open http://localhost:8779/ (it can be installed from there too). | `localhost:8779` storage |
| **iPhone / iPad** | Open the site in Safari, then Share › Add to Home Screen. | Safari's storage for the site |

**Moving between devices:** Character › Save code › Export on one device, then Import on the other. The code carries everything.

## Decision record: how to ship on PC (§15, §14.4)

| Option | Size | Build tools | Updates | Storage | Verdict |
|---|---|---|---|---|---|
| **Served PWA** (GitHub Pages + `sw.js` + manifest) | ~0.4 MB, cached | none (the folder is the site) | automatic: the service worker is network-first | origin storage, with `persist()` requested; export / import codes | **chosen** |
| Tauri | ~3–10 MB | Rust toolchain, WebView2 | a new installer per release | OS user-data directory | no need yet: Rust is a new toolchain |
| Electron | ~80–150 MB | Node + Electron | a new installer per release | OS user-data directory | too heavy for a 0.2 MB game |
| `index.html` opened from disk | 0 | none | manual | `file://` localStorage differs between browsers and can be wiped | rejected |

**Why the PWA:**
- It needs no new dependency.
- It keeps one codebase with the APK.
- Saves survive restarts and offline play.
- The save code is the escape hatch if a browser ever clears site data.

Revisit if a store release (Steam and similar) is wanted. The native port (M10) supersedes this anyway.

## The Android build

```
cd issen-android
python build.py 7 1.6
```

This writes `samurai-film/Issen-FiveShadows.apk`. The APK carries only `index.html`, `fonts/` and `icons/`; `tools/` (the Pose Lab, tests) never ships.

Shell behavior (`MainActivity`):
- `onPause` / `onResume` pause the fight and silence audio.
- **Back** goes to `issenApp.back()`. Since 1.6 it closes the open screen (settings, character, region, notice, help), pauses or leaves a fight, and exits only from the map or the film.
- The view is excluded from edge-swipe Back.

## Storage notes (§14.4)

- **Android:**
  - The save is written to localStorage after every reward, before any ceremony, into two rotating checksummed slots plus the legacy `{beaten:N}` mirror.
  - `allowBackup="true"`. Android Auto Backup covers the app data directory unless excluded, so `app_webview/` should be included. **Not verified on a device.**
- **Corrupt or missing saves:** the quarantine and import flow from M3 is unchanged.

## What could not be tested here (spec §17.3)

This PC has no Android device, emulator or system image attached, and no physical gamepad. The following are **untested**:

1. **Install and update:**
   - A fresh install.
   - An update over 1.5 that keeps the save.
   - Reinstall after uninstall (the save is lost, unless Auto Backup restores it).
2. **Process death:**
   - Under "Don't keep activities".
   - Swiping the app from recents mid-fight, then relaunching: the save stays, and the fight is lost by design.
3. **Touch layout on a real phone:**
   - At 800×360, 915×412 and a tablet, right- and left-handed, at button sizes 0.8 and 1.4.
   - Reaching the stick and the buttons with thumbs. The geometry (≥ 48 dp, ≥ 8 dp gaps) is checked by `tests/roll.test.js`.
4. **The hardware Back button** through every screen. The logic is covered by `tests/release.test.js`.
5. **Frame rate on a mid-range phone:**
   - The target is ≥ 55 fps.
   - The Burning Field GPU spike (see `docs/performance.md`).
   - Low quality.
6. **A physical gamepad** (Xbox / PlayStation, wired and Bluetooth), including hot-plugging. The mapping logic is covered with a simulated pad in `tests/input.test.js`.
7. **Audio:** the steel "ting" tells and all new sounds by ear.
8. **iOS:** Add to Home Screen, landscape, safe areas, audio unlock.

Everything else in the §17.2 list has automated evidence: see `docs/acceptance.md`.
