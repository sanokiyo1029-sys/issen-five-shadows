# Balance notes

All numbers live in the `data-progression` and `data-powers` JSON blocks in `index.html`. Values marked (tune) are starting points.

## XP curve

Going from level L to L+1 costs `round(100 · L^1.5)` XP. The cap is level 25 (tune).

| Level reached | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Total XP | 100 | 383 | 903 | 1,703 | 2,821 | 4,291 | 6,143 | 8,406 | 11,106 | 14,268 | 17,916 |

Each level-up grants 2 attribute points (tune). They are stored now and can be spent from M4.

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

Tiers II–V are M4. For comparison:
- The hero's lunge does 10 damage at reach 175.
- Ink Wave does 10 damage as a projectile for the same one-bar cost.

So the Red Moon trades the projectile's safety for range and damage, and its 0.34 s recovery is a punishable whiff.
