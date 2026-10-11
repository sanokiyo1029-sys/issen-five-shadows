# Conventions (keep current; the Godot port reads these)

- **Time:** seconds. The simulation step is 1/60 s; the current build still uses a variable dt with ≤0.05 s sub-steps until M2.
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
- **Determinism:** tests replace `Math.random` with a seeded generator (`tools/harness.js`). The in-game seedable RNG and the fixed step come in M2.
- **Assets:** everything is procedural or original. `assets/PROVENANCE.md` will list any file asset if one is ever added. Nothing comes from another game's package.
