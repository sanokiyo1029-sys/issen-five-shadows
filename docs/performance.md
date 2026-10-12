# Performance baseline

Measured with `node tools/perf.js [folder]` (spec §16). Headless Edge 1920×1080 with GPU, on the development PC, 2026-10-12. Each fight plays 10 s (600 frames) with a scripted player.

- The figures are the CPU-side cost per frame. GPU work runs asynchronously and isn't included.
- The browser clock is coarse (0.1 ms), so the simulation is timed in batches.
- The frame budget at 60 fps is 16.7 ms.

| boss | M3 (e468f59) render ms, mean / p95 | M2 render ms, mean / p95 | simulation ms per frame |
|---|---|---|---|
| gekko (Burning Field) | 4.68 / 33.7 | 4.82 / 32.6 | < 0.01 |
| kasumi (Bamboo Grove) | 1.56–1.62 / 4–10 | 1.56–1.61 / 4–10 | < 0.01 |
| tetsugoro (Mountain Shrine) | 0.43–0.47 / 0.7 | 0.47–0.50 / 0.7 | < 0.01 |
| shirasagi (Moonlit Lake) | 1.03–1.10 / 0.7–4.6 | 1.10–1.11 / 0.8–2.6 | < 0.01 |
| akuma (Oni Castle) | 0.95–1.01 / 2–4 | 0.96–1.01 / 1.8–4.1 | < 0.01 |

Ranges are the spread over two runs. **M2 does not change frame cost measurably.** The new blends compute joints only on state changes, and the markers, glints and roll streaks are a few strokes each.

The one heavy case is the Burning Field: about 5% of frames take around 33 ms of CPU, in both builds. It predates M2: its rain, fire and smoke layers are the candidates. Adaptive resolution (`adapt`) already scales the canvas down on slow devices.

## Not measured here

- A mid-range Android phone.
- 4× CPU throttling.

Both are for the M8 performance pass and the M9 device tests. The spec targets ≥ 55 fps on mid-range Android.

## After M8 (2026-10-12)

M3 to M8 added powers, phases, ladders, weapon classes, trails, contact shadows and settings. Frame cost is unchanged within noise:

| boss | M8 render ms, mean / p95 | M8 with Low quality | simulation ms per frame |
|---|---|---|---|
| gekko (Burning Field) | 4.88–4.95 / 33.6 | 4.65 / 32.7 | < 0.01 |
| kasumi | 1.57–1.58 / 1.5–5.5 | 1.58 / 0.7 | < 0.01 |
| tetsugoro | 0.46–0.50 / 0.7 | 0.45 / 0.7 | < 0.01 |
| shirasagi | 1.11–1.13 / 2.3–3.9 | 1.05 / 0.6 | < 0.01 |
| akuma | 0.96–1.00 / 2.1–3.4 | 0.91 / 0.8 | < 0.01 |

**Per-frame allocations (§16):** the fight loop now compacts effects and projectiles in place, so they no longer allocate a new array every step (`tests/settings.test.js` checks this).

**The Burning Field spike (about 5% of frames near 33 ms):**
- It survives Low quality.
- Its grass and rain are drawn as single paths, so the CPU work is small.
- It is most likely the GPU stalling the canvas in the arena with the most full-screen layers (storm, hills, burning village, smoke, gradient, grain).

It predates M2. Adaptive resolution (`adapt`) already shrinks the canvas on a device that cannot keep up. It needs profiling on a real phone (M9).

## 1.7: the new arenas

`node tools/perf.js` now also plays the new arenas: the dojo, Ashen Village, the two Hell gates, the two White arenas, and custom maps. These are CPU timings in headless Edge on this PC, mean / p95 in ms per rendered frame:

| Arena | Render, mean / p95 |
|---|---|
| Forgotten Dojo | 0.35 / 0.60 |
| Ashen Village | 0.48 / 0.60 |
| Ash Gate (Hell) | 0.62 / 0.70 |
| Ninth Gate (Hell) | 0.58 / 0.90 |
| Celestial Sanctuary (White) | 0.76 / 1.70 |
| Pale Sun (White) | 0.99 / 3.30 |
| Custom map: dojo theme, rain, dusk, ledge and two hazards | 1.32 / 3.60 |
| Custom map: Burning Field theme, empty | 6.85 / 50.4 |

The new arenas, the layout engine (ledges, obstacles, hazards, pickups) and the weather and light passes are cheap.

The one spike is the Burning Field's own background, already known from 1.6 (Gekkō: p95 about 36 ms here). A custom map that picks that theme inherits it, even with nothing placed. It remains on the list for a phone check.
