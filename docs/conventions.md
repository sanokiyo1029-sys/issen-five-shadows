# Conventions (keep current; the Godot port reads these)

- **Time:** seconds. The simulation advances in fixed 1/60 s steps (`stepGame`); rendering interpolates fighter and projectile positions between the last two steps. A display frame is capped at 0.1 s (up to 6 steps), so the game stays real-time down to 10 fps.
- **Space:** px in a 1920×1080 logical space. The arena spans x = −900 to +900. The ground is y = 0, and airborne positions are negative y. The hero starts at x = −300 and the opponent at +300.
- **Angles:** radians, facing-relative: 0 points down and positive is forward. The facing flag `f` (±1) mirrors the whole figure.
- **Hit zones:** `high`, `mid`, `low`, with vertical offsets −200, −135 and −45 px (`ZY`). Melee hits use the 1-D reach test: the defender must be within [−40, reach·s_attacker + 20·s_defender] in front of the attacker.
- **Ink:** 0–100, with three bars of 33.3. Costs are in bars.
- **Ids:** lower-case snake_case and stable forever, because saves refer to them.
  - Bosses: `gekko`, `kasumi`, `tetsugoro`, `shirasagi`, `akuma`.
  - Powers: `red_moon`, `miststep`, `iron_resolve`, `phantom_edge`, `demon_sovereignty`.
  - Reward claims: `boss:<boss_id>` for a first clear.
- **Data:** engine-neutral JSON in `<script type="application/json" id="data-…">` blocks in `index.html`. Each has a `schema_version` and a validator that runs at boot and in tests. See the decision record in `docs/audit.md`.
- **Saves:** schema v2 (see `docs/save-format.md`).
- **Movement data:** `data-movement` (schema 1) holds the roll (duration, distance, invulnerable window, cooldown) and the cosmetic blend timings. Boss moves carry `answers` (verified by `tools/answers.js`), `tell:[from,to]` (heavy moves) and, for repositions, `mark:[vanish,teleport]` plus `dest(F,O)`. Pose keyframes (`fr`) are still JavaScript functions; JSON tracks come in a later pass (§6.9).
- **Determinism:** every fight has a seed (`G.seed`; debug: `?debug&seed=N`, or `startFight(lv, seed)`). All simulation randomness (the AI) draws from `G.rand`, a mulberry32 stream of that seed. Cosmetic randomness (ink-splash shapes, audio noise) stays on `Math.random` and never changes the outcome. A replay is `{ seed, boss, inputs per tick }` (see `tests/sim.test.js`); it reproduces a fight exactly in this engine.
- **Assets:** everything is procedural or original. `assets/PROVENANCE.md` will list any file asset if one is ever added. Nothing comes from another game's package.
