# Assets and licenses

Everything that ships in the page and the APK, where it came from and under what terms. The APK carries `index.html`, `fonts/` and
`icons/` only (`issen-android/build.py`); the site also serves `manifest.webmanifest`, `sw.js` and the APK files.

| Asset | Files | Source | License | Notes |
|---|---|---|---|---|
| Game code, data and story text | `index.html` | Written for this project | The owner's (no license file yet) | No third-party libraries are bundled. |
| Art (fighters, arenas, ink effects, the map, the sun) | none: drawn at runtime on canvas | Procedural, written for this project | The owner's | No image files in the game itself. |
| Music and sound | none: synthesised at runtime (Web Audio) | Procedural, written for this project | The owner's | No audio files. Captions for meaningful cues come from the `data-captions` block. |
| Yuji Boku (brush kanji) | `fonts/yuji-boku.woff2` | Google Fonts (Yuji family, by Kinuta Font Factory) | SIL Open Font License 1.1 | Subset to 38 kanji (`docs/audit.md`). |
| Cormorant Garamond | `fonts/cormorant.woff2`, `fonts/cormorant-italic.woff2` | Google Fonts (by Christian Thalmann, Catharsis Fonts) | SIL Open Font License 1.1 | Subset to the Latin glyphs used. |
| App and launcher icons | `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`; Android mipmaps generated from them at build time | Made for this project | The owner's | |
| PWA manifest and service worker | `manifest.webmanifest`, `sw.js` | Written for this project | The owner's | `sw.js` caches the files above for offline play. |
| Android shell | `issen-android/` (`MainActivity.java`, `AndroidManifest.xml`, `res/`, `build.py`) | Written for this project | The owner's | Built with the Android SDK build tools (aapt2, d8, zipalign, apksigner) and JDK 17; nothing from them ships except the platform's own classes at runtime. |
| Tests and tools | `tests/`, `tools/` | Written for this project | The owner's | Node standard library only; the smoke and screenshot tools drive a locally installed Edge or Chrome. Never shipped in the APK. |

**Not shipped, never published:** `issen-android/issen-release.keystore` and `keystore-password.txt` (the signing key; gitignored).

## Open items

- **OFL notice with the fonts:** the OFL allows bundling a font with software if its copyright notice and the license travel with it. Whether the subset `woff2` files kept their name-table notices has not been checked here (no font tools on this PC). The safe fix is to add `fonts/OFL.txt` with the two fonts' copyright lines and the OFL 1.1 text. This needs the exact license text from scripts.sil.org or the fonts' Google Fonts pages.
- **The project's own license:** none is declared. Choosing one (or "all rights reserved") is the owner's decision.
