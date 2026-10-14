# Release 1.8: Android APK and PC

What 1.8 adds is listed in `docs/changelog.md`; the evidence is in `docs/test-report.md` and the state of every feature in `docs/status.md`. The packaging is as in 1.7, plus the WebView hardening below. Signing secrets (`issen-release.keystore`, `keystore-password.txt`) are never deliverables, and publishing to a store is a separate step not taken here.

## How to play

| Platform | How | Save lives in |
|---|---|---|
| **Android** | Install `Issen-FiveShadows-1.8.apk` (sideload; versionCode 9) **over** the installed app. It installs over 1.0–1.7 and keeps the save, because every build is signed with the same key. | The WebView's DOM storage in the app's data directory (`app_webview/`). |
| **PC: browser / installed app** | Open https://sanokiyo1029-sys.github.io/issen-five-shadows/ in Chrome or Edge, then "Install the app" (the install hint on the cover, or the browser's install icon). It runs in its own window and works offline. | That origin's storage. The game asks `navigator.storage.persist()`, which installed apps are normally granted. |
| **PC: fully local** | Run `node tools/serve.js`, then open http://localhost:8779/ (it can be installed from there too). | `localhost:8779` storage |
| **iPhone / iPad** | Open the site in Safari, then Share › Add to Home Screen. | Safari's storage for the site |

**Moving between devices:** Character › Save code › Export on one device, then Import on the other. The code carries everything.

## Installing 1.8 on Android (keep your save)

1. **Back up first:** in the game, Character › Save code › Export, and keep the code somewhere safe (a note, an email to yourself).
2. Copy `Issen-FiveShadows-1.8.apk` to the phone (or download it), then open it. Allow "install unknown apps" for the app that opens it if Android asks.
3. Choose **Update**. **Do not uninstall the old version first:** uninstalling deletes the app's data, and the save with it.
4. Open Issen: the main menu shows v1.8 and your progress. If anything looks wrong, Character › Save code › Import the code from step 1.

Check the file before installing: its SHA-256 is in `docs/test-report.md`. The 1.7 file (`Issen-FiveShadows.apk`, versionCode 8) is kept unchanged next to it.

## Decision record: WebViewAssetLoader (v2 brief, stage 6)

| Option | Origin | Saves | Verdict |
|---|---|---|---|
| `file:///android_asset/index.html` + navigation guard | `file://` | every existing save stays where it is | **chosen for 1.8** |
| WebViewAssetLoader (`https://appassets.androidplatform.net/`) | a real https origin (no file-access settings needed) | localStorage is per origin: the new origin starts **empty**, so every installed player would seem to lose their journey | **deferred** |

WebViewAssetLoader becomes worth it once a migration exists: the old page exports its save, and the new origin imports it on first start (the save-code path already carries everything). Until then, the shell keeps the `file://` origin and closes what that origin would otherwise allow:

- `shouldOverrideUrlLoading` keeps only `file:///android_asset/index.html` inside the WebView; an https link opens in the browser; anything else is refused. No other page can ever reach the `IssenNative` bridge.
- `setAllowFileAccess(false)` (assets still load), `setAllowContentAccess(false)`, no file-URL cross-access, no geolocation, no extra windows.
- The manifest has no INTERNET permission: the WebView cannot fetch anything off the device.

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
python build.py 9 1.8 Issen-FiveShadows-1.8.apk
```

This writes `samurai-film/Issen-FiveShadows-1.8.apk` and leaves the 1.7 `Issen-FiveShadows.apk` as it was (without the third argument the build replaces `Issen-FiveShadows.apk`, the file the site links to). The APK carries only `index.html`, `fonts/` and `icons/`; `tools/` (the Pose Lab, tests) never ships.

Shell behavior (`MainActivity`):
- `onPause` / `onResume` pause the fight and silence audio.
- **Back** goes to `issenApp.back()`. Since 1.6 it closes the open screen (settings, character, region, notice, help), pauses or leaves a fight, and exits only from the map or the film.
- The view is excluded from edge-swipe Back.
- Navigation is guarded and file access is off (1.8; see the WebViewAssetLoader decision above).

## Storage notes (§14.4)

- **Android:**
  - The save is written to localStorage after every reward, before any ceremony, into two rotating checksummed slots plus the legacy `{beaten:N}` mirror.
  - `allowBackup="true"`. Android Auto Backup covers the app data directory unless excluded, so `app_webview/` should be included. **Not verified on a device.**
- **Corrupt or missing saves:** the quarantine and import flow from M3 is unchanged.

## What could not be tested here (spec §17.3)

The same limits apply to 1.8, plus what is new on a real phone: the navigation guard (a link out should open the browser), the 30 fps option's battery effect, the captions' legibility, the touch-button opacity, and the touch size of the codex rows and the tournament cards. `docs/test-report.md` lists each scenario with its result.

This PC has no Android device, emulator or system image attached, and no physical gamepad. The following are **untested**:

1. **Install and update:**
   - A fresh install.
   - An update over 1.7 that keeps the save (and maps its claims to stable ids).
   - Quit from the main menu closing the app (the new `IssenNative` bridge).
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
7. **Audio:** the steel "ting" tells, the menu music, the sun's chord and all new sounds by ear; the separate music / effects volumes.
8. **iOS:** Add to Home Screen, landscape, safe areas, audio unlock.

Everything else in the §17.2 list has automated evidence: see `docs/acceptance.md`.
