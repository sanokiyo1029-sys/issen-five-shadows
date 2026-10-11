# Balance notes

All numbers live in the `data-progression` and `data-powers` JSON blocks in `index.html`. Values marked (tune) are starting points.

## XP curve

Going from level L to L+1 costs `round(100 · L^1.5)` XP. The cap is level 25 (tune).

| Level reached | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Total XP | 100 | 383 | 903 | 1,703 | 2,821 | 4,291 | 6,143 | 8,406 | 11,106 | 14,268 | 17,916 |

Each level-up grants 2 attribute points (tune), spent on the character screen (M4). Levels 5, 10, 15, 20 and 25 each grant a skill point.

## Boss first-clear rewards (M3)

| Boss | XP | Skill points | Mon | Power |
|---|---|---|---|---|
| Gekkō | 600 | 1 | 100 | Spear of the Red Moon (playable) |
| Kasumi | 900 | 1 | 150 | Miststep (absorbed; playable in M5) |
| Tetsugorō | 1,300 | 1 | 200 | Iron Resolve (M5) |
| Shirasagi | 1,700 | 1 | 250 | Phantom Edge (M5) |
| Akuma | 2,200 | 2 | 400 | Demon Sovereignty (M5) |
| **All five** | **6,700** | **6** | **1,100** | |

- **Bosses alone:** 6,700 XP reaches **level 8** (6,143).
- **Campaign target (§7.2, levels 10–12):** reaching level 11 needs 14,268 XP, so the M6 retainer and elite duels should pay about 5,000–8,000 XP across the five regions, roughly 1,000–1,600 per region.
- **Ink Trials (M6):** these should then carry the player toward levels 18–20.
- **Repeat wins** pay 25% of the boss XP (tune), with no skill points, mon or powers. No grind is required to progress.

## Spear of the Red Moon (tier I)

| Stat | Value |
|---|---|
| Cost | 1 ink bar |
| Cooldown | 4 s |
| Startup | 0.24 s, with the red-glint tell from 0.02 s to 0.22 s |
| Active | 0.12 s |
| Recovery | 0.34 s |
| Reach | 300 |
| Damage | 14, mid |
| Step-in | about 260 px (lunge at 1,450 px/s from 0.12 s to 0.30 s) |
| Push | 220 |

Tiers II and III arrived in M4 (below). For comparison:
- The hero's lunge does 10 damage at reach 175.
- Ink Wave does 10 damage as a projectile for the same one-bar cost.

So the Red Moon trades the projectile's safety for range and damage, and its 0.34 s recovery is a punishable whiff.

## Attributes (M4)

Each path has a rank from 0 to 20 (tune). Every bonus follows `cap · (1 − e^(−0.1 · rank))`: early points count most, and rank 20 reaches 86.5% of the cap. A level-25 hero has 48 points, so two paths can be maxed but not all three. Ranks can be reset for free from the character screen.

| Path | Bonus | Cap | At rank 20 |
|---|---|---|---|
| Assault | attack | +20% | +17.3% |
| | chain hits 2–3 (slash2, slash3) | +6% | +5.2% |
| | crit chance (a crit deals ×1.5; rolled from the fight's seeded RNG) | 10% | 8.6% |
| Survival | max health | +15% | +13.0% (113 health) |
| | damage taken | −6% | −5.2% |
| Shadowcraft | power damage and echo strength | +25% | +21.6% |
| | power cooldowns | −20% | −17.3% |
| | ink gain | +20% | +17.3% |
| | roll cooldown | −20% | −17.3% |
| | walk speed | +5% | +4.3% |

Healing has no source in the game yet (Iron Resolve's counter tier comes with the power in M5), so it is neither tracked nor shown.

## Effective power (spec §7.3)

Effective power = damage multiplier × survivability multiplier, relative to a level-1 hero (1.0×):

- Damage multiplier = attack × (1 + crit chance × 0.5) × chain bonus. The chain bonus is counted on every hit, which is conservative.
- Survivability multiplier = health / (1 − mitigation) / (1 − Iron Skin's reduction × 0.4).
  - The 0.4 assumes Iron Skin can cover at most about 40% of the hits taken, since it works once every 6 s.

`tests/rpg.test.js` searches every allocation (ranks 0–20 per path, at most 48 points) with every pair of echoes:

| Build | Effective power |
|---|---|
| Attributes only: Assault 20, Survival 20 | **1.53×** |
| Best overall: Assault 20, Survival 18, Shadowcraft 10, echoes Red Moon Reach + Iron Skin | **1.73×** |
| Budget (`power_budget` in data) | attributes + echoes ≤ 1.75×; everything, gear included, ≤ 2.0× |

That leaves about ×1.15 for M7 gear.

The spec's suggested caps (+35% attack, +30% health, 25% mitigation, 30% crit) would reach about 2.4× once two paths are maxed. That breaks its own 2.0× rule, so the caps above are lower.

Power damage (Shadowcraft) is left out of the multiplier: powers are limited by ink and cooldowns, and they are a small share of a fight's damage.

## Skill points and power tiers (M4)

- **Sources:**
  - First boss clears: 6 in all.
  - Milestone levels: up to 5.
  - Ink Trials: M6.
  - The bosses alone reach level 8, which gives **7 skill points**.
- **Derived, never stored blindly:** skill and attribute points are recomputed on every load as earned minus spent, so a hand-edited save cannot invent points.

| Tier | Skill points | Mon | Also needs |
|---|---|---|---|
| II | 1 | 50 | — |
| III | 2 | 150 | — |
| IV | 3 | 300 | that boss's Ink Trial (M6) |
| V | 4 | 500 | tier IV |

Tiers apply to the equipped power's move as a per-fighter copy. `MV` and `HERO_MV` never change.

Only Spear of the Red Moon is playable so far:

| Red Moon tier | Effect |
|---|---|
| I | 14 damage at reach 300 |
| II | +20 reach (320), +2 damage (16) |
| III | Breaks hyper-armor (Tetsugorō's windups stagger) and doubles block pushback |
| IV, V | Moon Pierce, then a shorter cooldown with an ink refund. They arrive with the Ink Trials; tiers are capped at III until then. |

Shadowcraft multiplies the power's damage (×1.216 at rank 20).

## Echoes (M4)

Two echo slots, at levels 8 and 14. An echo is a power's passive. A power sits in a power slot or an echo slot, never both.

Echo strength scales with Shadowcraft's power bonus. Iron Skin's reduction is capped at 50%.

| Echo (power) | Effect |
|---|---|
| Red Moon Reach (Gekkō) | lunge, slash3 and the Red Moon reach 8% further |
| Light Step (Kasumi) | roll cooldown −15%; walk +4% |
| Iron Skin (Tetsugorō) | every 6 s, the first hit taken is 25% weaker and doesn't stagger (knockdowns still knock down) |
| Pale Reflection (Shirasagi) | Ink Wave flies 25% faster and pierces: it hits each foe once and survives clashes |
| Ember of Rage (Akuma) | below half health, ink fills 50% faster |

Echoes work from the moment the power is absorbed, even while the active power still awaits M5.
