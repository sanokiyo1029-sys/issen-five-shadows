# Building Issen — Five Shadows

Two folders, two Git repos:

| Folder | What | Git |
|---|---|---|
| `Downloads/samurai-film/` | The game: `index.html` (film + game, one file), `fonts/`, `icons/`, `manifest.webmanifest`, `sw.js`, the built APK, `docs/`, `tests/`, `tools/` | Public: `github.com/sanokiyo1029-sys/issen-five-shadows`. Pushing `main` redeploys GitHub Pages. |
| `Downloads/issen-android/` | The Android shell: `AndroidManifest.xml`, `src/.../MainActivity.java`, `res/`, `build.py` | Local only. `.gitignore` keeps the signing key out. |

Tags: `v1.1` (versionCode 2) and `v1.2-shipped` (versionCode 3) in the game repo, and `v1.2-shipped` in the shell repo. The original v1.0 APK (versionCode 1) predates the repo, so there is no v1.0 tag.

## Toolchain (no Gradle, no Android Studio)

The toolchain is in `C:/Users/2025/android-toolchain/`. The original zips are in `downloads/` and can be deleted.

- **JDK:** Eclipse Adoptium (Temurin) 17.0.20.1+1, in `jdk/jdk-17.0.20.1+1/`.
- **Android SDK build-tools:** 34.0.0, in `build-tools/android-14/`. It provides `aapt2`, `d8`, `zipalign` and `apksigner`.
- **Android platform:** android-34 (Android 14, rev 3). `platform/android-34/android.jar` is the compile target.
- **Python:** 3.13.7, which runs `build.py`.
- **Node:** 24.21.0. It runs the tests only and is not needed for the build.

## Build the APK

```
cd Downloads/issen-android
python build.py <versionCode> <versionName>     # e.g. python build.py 4 1.3
```

`build.py` copies `index.html`, `fonts/` and `icons/` from `../samurai-film` into the APK's `assets/`, then runs these steps:

1. `aapt2 compile` and `aapt2 link` (minSdk 24, targetSdk 34)
2. `javac -source 8 -target 8`
3. `d8`
4. A zip repack that keeps `resources.arsc` stored
5. `zipalign -p 4`
6. `apksigner` (v1+v2+v3 signatures, no v4)

It writes `samurai-film/Issen-FiveShadows.apk`.

- **Raise versionCode on every release.** Android refuses to install a lower or equal version over an existing install.
- **Signing key:** `issen-android/issen-release.keystore` (PKCS12, alias `issen`, certificate `CN=Issen, O=Issen`). Its password is in `keystore-password.txt`.
  - Back up both files offline.
  - A different key forces an uninstall, which wipes the player's saves.

## Reproducibility (checked in M1, 2026-10-11)

Rebuilding tag `v1.2-shipped` with `python build.py 3 1.2` produced an APK whose 13 non-signature entries are byte-identical (SHA-256) to the shipped `Issen-FiveShadows.apk`. Only `META-INF/` (the signature) differs.

I have not confirmed that the rebuild installs on a device or emulator, because none is available here.

## Tests

```
cd Downloads/samurai-film
node tests/run.js                  # all tests
node tests/run.js save             # only tests whose file or name contains "save"
node tests/run.js --update-golden  # after an intentional change to moves/bosses/arenas/hero
```

`tools/harness.js` boots the real `index.html` script in a Node `vm`, with a stub DOM and canvas and a seeded `Math.random`. Fights and saves are therefore tested headlessly and reproducibly.

## Web build

There is no build step for the web version: the folder is the site. Run `python -m http.server 8779 -d samurai-film` for localhost.

Add `?debug` to the URL to expose `window.game` and `window.film` for console debugging. Without it they don't exist, which is how the APK runs.

`?debug` also loads `tools/poselab.js`: the **Pose Lab** (a link on the map, or `?debug&lab=<move>`), the in-fight frame-data overlay (the ` key), and review sheets (`?debug&sheet=<move>`). `?debug&seed=N` fixes a fight's seed. The APK ships only `index.html`, `fonts/` and `icons/`, so none of `tools/` is in a release build.

## Design tools (M2)

```
node tools/audit-moves.js --write  # boss move fairness: frame data, tells, verified answers -> docs/fairness.md
node tools/answers.js              # which of block / crouch / jump / roll answers each boss move (by simulation)
node tools/pops.js                 # worst per-frame joint jumps at state changes (no-pop check)
node tools/capture.js [move ...]   # review sheets for every move -> docs/animation-review/ (needs Edge or Chrome)
```
