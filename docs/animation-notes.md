# Animation notes

Decisions and the reasons for them (spec §3.5). Numbers live in the `data-movement` JSON block in `index.html` and can be tuned there. Everything here is cosmetic: the simulation changes state exactly when it did before, and the golden baseline and replay tests guard that.

## M2 pass 1: locomotion, transitions, hit reactions

| Area | Before | Now | Why |
|---|---|---|---|
| State changes | Instant snaps. The worst was **246 px** for one joint in one frame, and the weapon tip moved 404 px. | Every visual change (state, block or crouch flag, a new move, a new hit) blends linearly from the last drawn pose. The base blend is 0.07 s (moves 0.05, hits 0.05, falls 0.10). A long way between poses gets a longer blend, up to 0.2 s, so **no joint moves more than 45 px in the first frame** (`blend.step_px`). The worst state switch is now **56 px**. | A pop reads as a glitch, not as speed. Linear blending, not eased: over 3–4 frames a curve can't be seen, and even steps never pop. |
| Facing | An instant mirror flip, often the single largest pop. | The drawn facing passes through a paper-thin squash over 0.07 s (`blend.turn`). The simulation still flips at once. | A 2D turn read as a quick body rotation. Cross-ups and teleports stay readable. |
| Jump | One pose, with lean varied by vertical speed. | A push-off crouch blending out over 0.07 s, then rise (legs trailing), apex tuck (knees up), and fall (legs reaching for the ground). The pose is driven by vertical speed, so it always matches the arc. | The arc gains weight without changing the committed jump. |
| Landing | Straight to the guard, plus dust. | The knees give into a half crouch and recover over 0.14 s (`blend.land`). The fighter is free on the landing frame, as before. | The spec asks for absorption, but landing must stay instant for play. |
| Crouch | A snap. | The general blend: about 4 frames in and out. | The spec's 0.06–0.08 s. |
| Hit reactions | One stagger pose; only its duration varied. | **High**: the head snaps back. **Mid**: the torso folds over the blow. **Low**: the front knee buckles. Light hits play at 85 %; heavy hits (≥ 10 dmg) at 130 %, overshooting. Arms keep their weapon grip. Each new hit re-blends. Median blend 3 frames, longest 6. | The zone you were hit in should be readable within ~3 frames. |
| Block | A static pose. | It recoils 0.2 rad back, recovering over the block-stun. | The spec's "recoil on a blocked hit". The clash sparks were already the guard flare. |
| Knockdown | A rotation lerp. | A decaying bounce as the body lands (24 px), then a get-up through an upright kneel (`KNEEL`) into guard. | The spec's slide / bounce settle and a clearer get-up. |
| Idle | A breathing sway. | Plus a slow weight shift (both thighs ±0.05 rad at 0.9 rad/s). | It keeps a waiting fighter alive without moving the feet. |
| Roll (new) | — | Tuck in over 0.05 s, one full-body turn across the 0.26 s travel, then unroll into a crouched guard. Half ink while invulnerable, speed streaks, and dust at both ends. Rotation stays within ±π, so a hit mid-roll blends the short way. | Readable safe window (spec §5.3). The ±π fix removed a 232 px pop: a hit late in a roll spun the body backwards. |

## How it's checked

- `node tools/pops.js` plays the five boss fights with a scripted player. Every frame it measures how far each joint moves in the fighter's own frame, which excludes walking and lunges. It lists the worst state switches and the fastest authored motion.
- `tests/anim.test.js` checks:
  - No state switch moves a joint more than 60 px in its first frame.
  - The jump phases, landing absorb, crouch and turn blends.
  - The three hit zones and heavy amplification.
  - The knockdown bounce and the kneel.

## Known gaps (next passes, spec §6.9 order)

- **Authored strikes are fast by design.** For example, Tetsugorō's club strikes move a joint up to 115 px in one frame with the `o5` ease-out. 6.6 #4 asks to flag tip jumps over ~60 px. The Pose Lab plots the tip path for review rather than this pass changing boss timing.
- **Not yet built:**
  - Secondary motion reacting to velocity (6.6 #7).
  - Per-weapon guard stances (M7).
  - A shorter backstep cycle.
  - Per-boss KO flourishes (M5).

## M5: trails, sheen, power looks

- **Swing trails (6.6 #8):**
  - What: the weapon tip is sampled every drawn frame during a move's hit windows. The trail is drawn as a tapered brush that fades over 0.2 s, capped at 16 points per fighter. It is ink, or red for hero powers, Akuma's rage and Demon Sovereignty. Kicks draw none.
  - Why: the strike's arc becomes readable without new art.
- **Iron sheen:** a pale grey copy of the figure, offset 3 px and pulsing. It shows during Iron Resolve's stance and during any boss's hyper-armor frames (spec §10: "show when light hits will not stagger him").
- **Miststep:** the body thins to 30% ink through the invulnerable window, and a column of mist marks where the afterimage will burst.
- **Phantom Edge:** a 262 px pale crescent with a dry-brush edge.
- **Demon Sovereignty:** the rig's rage eye and glow, plus two ink horns on the hero.
- **No-pop measure:** pops are now measured in the character's own unmirrored frame. A facing turn is its own animated transition (the drawn facing squashes through zero over 0.07 s) and has its own test. Counting a mid-turn mirror as a pose pop double-counted it whenever a hit landed during a cross-up.

## M8: polish

- **Secondary motion (6.6 #7):** the rig's `stream` parameter (hair, scarf and sleeves) now follows the fighter's own speed, plus a push during lunges and rolls, as well as the wind.
- **Grounding (6.8):**
  - A soft ink contact shadow under each fighter, shrinking and fading with height.
  - Landing dust (M2) and knockdown dust (existing).
- **Impact tiers (6.8):**
  - Light hits keep the brush mark.
  - Heavy hits (≥ 10) and knockdowns add a camera punch (2% and 3% zoom, decaying), which honors Reduce Shake.
  - Knockdowns keep the persistent ink splash; blocks keep the spark ring.
- **Whiff punish (5.8a):** a red ring flash and a steel note when the hero hits a foe in recovery.
- **KO flourish (5.7):** the fallen fighter's ink breaks into mist and a lasting splash.
- **Still open:**
  - Foot sliding where attack poses change stance without a step. The sheets flag it, and fixing it means re-posing or adding root motion: a review item for the owner.
  - Footstep dust.
  - Per-boss KO flourishes beyond the shared one.
  - Weapon-specific secondary parts (a spear tassel, a naginata ribbon).
