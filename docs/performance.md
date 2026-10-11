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
