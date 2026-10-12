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

All five powers are playable from M5. Spear of the Red Moon:

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

## The five powers (M5)

All costs are in ink bars. Shadowcraft scales each power's damage, including the afterimage, the counter and the Sovereign Cut. The tier columns list only what that tier changes.

| Power | Use | Tier I | Tier II | Tier III |
|---|---|---|---|---|
| Spear of the Red Moon | 1 bar, 4 s | 14 damage at 300 reach | +20 reach, +2 damage | breaks hyper-armor, ×2 block pushback |
| Miststep | 1 bar, 7 s | 0.35 s, invulnerable 0.04–0.28 s. Back or neutral retreats 380 px; toward the foe passes behind them. The afterimage bursts for 4 after 0.5 s if the foe is within 150 px. | +60 px, 6 s cooldown | afterimage 7 damage; +10 ink when it slips a live attack |
| Iron Resolve | 1 bar, 8 s | 0.25 s brace, then a 1.6 s stance: −55% damage, no stagger from non-knockdown hits, walk ×0.4. Slash within 0.5 s of an absorbed blow counters for 8 + 1.2 × absorbed (at most 24), with knockdown. Knockdowns break the stance; so does any other attack. | −65% damage | the counter heals 30% of its damage (× Survival's healing) |
| Phantom Edge | 1 bar, 3.5 s | a tall wave at 650 px/s: 12 damage to any grounded foe (crouching doesn't help; jumping does). It breaks every projectile it meets. | +3 damage, wider | 30% faster |
| Demon Sovereignty | 2 bars, once a round (+20 s) | 8 s: damage ×1.25, speed ×1.15, power cooldowns ×0.6, ink ×1.5. The Issen key becomes the Sovereign Cut (40, unblockable), which ends the form. Then 2 s of burnout with no powers. | 10 s | damage ×1.35; each hit bleeds 2 health a second for 3 s (bleed never kills) |

**AI:**
- Bosses weight their knockdown moves ×3 against a hero in Iron Resolve.
- They block 20% more often while the hero is in Sovereignty.
- `tests/powers.test.js` plays every power against every boss to a result.

**Healing:** Survival now also raises healing (+30% cap). Its only source so far is Iron Resolve tier III. Healing is left out of the effective-power multiplier, which stays at 1.73× best build.

## Boss second phases (M5)

Below 50% health, once a round, each boss:
- shows a banner (Akuma keeps his rage banner);
- fills the notch on its health bar;
- adds one move to its AI, with its own think and aggression tuning in `BOSSES[].phase`.

| Boss | New move | What it is | Answers (verified) |
|---|---|---|---|
| Gekkō | g_twin | a thrust (7), then a low sweep (10, knockdown) with its own low glint | block (crouch-block), roll |
| Kasumi | k_volley | two stars at once, head-high and ankle-high | block (crouch-block), roll |
| Tetsugorō | m_quake2 | two earthquakes 0.25 s apart (9 + 9, knockdown) | block, jump (one jump clears both) |
| Shirasagi | y_wisp2 | two wisps, mid and high, at different speeds | block, crouch |
| Akuma (rage) | a_rend | a cut (8), then a crush (13, knockdown) with a high glint; red swing trail | block, roll |

The first m_quake2 draft spaced the quakes 0.4 s apart. That left only a flickering 1–2 frame jump window, so the second quake now follows after 0.25 s.

## Regions, ladders and Ink Trials (M6)

Each region is a short ladder in `data-ladders`:
- Retainer duels: one round each, in order.
- An optional elite: best of three, paying 1 upgrade material.
- The boss: best of three. It opens once the retainers are cleared, or if it was already beaten before M6.
- Its Ink Trial: opens once the boss is beaten.

A win saves the checkpoint (`progress.ladder`). A loss retries the same duel, with no progress lost. Retainers and elites gain 12% health per region.

| Region | Duels (first-clear XP) | Ladder XP |
|---|---|---|
| Burning Field | footman 250, thrower 300, elite Spear Captain 500 | 1,050 |
| Bamboo Grove | cutthroat 300, thrower 350, footman 350, elite Shinobi Adept 650 | 1,650 |
| Mountain Shrine | guard 400, footman 400, cutthroat 450, elite Iron Acolyte 750 | 2,000 |
| Moonlit Lake | thrower 450, guard 500, cutthroat 500, elite Drowned Ronin 850 | 2,300 |
| Oni Castle | guard 550, thrower 550, cutthroat 600, elite Oni Lieutenant 900 | 2,600 |

**Campaign first clear:** ladders 9,600 + bosses 6,700 = **16,300 XP: level 11** (target 10–12).

| Ink Trial | Rule | XP | Also |
|---|---|---|---|
| Swift Spear (Gekkō) | 30-second rounds | 6,000 | |
| Open Hands (Kasumi) | you cannot block | 7,500 | |
| Half Measure (Tetsugorō) | you start each round at half health | 9,000 | |
| Pale Night (Shirasagi) | she starts in her second phase | 10,500 | |
| Unending Wrath (Akuma) | he is enraged from the first blow | 12,000 | |

Every trial also pays 1 skill point, 300 mon and a named item (its effects come with the gear in M7), and opens tier IV of that boss's power.

**With every trial:** 61,300 XP, **level 19** (target 18–20). Repeat clears of anything pay 25% of the XP only. `tests/ladder.test.js` checks both targets against the data.

**Archetypes (§11.3):** the existing rigs in new ink, using the existing AI and move machinery.

| Archetype | Character | Moves | Health |
|---|---|---|---|
| Footman | plain cuts at three heights | r_slash / r_high / r_low / kick | 55 |
| Cutthroat | fast and close | r_jab / r_low / kick | 50 |
| Knife-thrower | keeps his distance | r_knife / r_jab | 45 |
| Iron Guard | armored overhead r_bash with a tell | r_bash / r_slash / kick | 80, scale 1.12 |

Each elite is a lesser version of its region's boss: the boss's ink and a few of its moves, plus one signature trick (g_spin, k_vanish, m_slam, y_phase, a_wave).

The last region mixes all three troublesome archetypes, so different loadouts pay off: an armored guard (Red Moon III), knives (Phantom Edge, Iron Resolve IV) and a cutthroat (Iron Resolve, Miststep).

## Power tiers IV and V (M6)

| Power | IV (needs that boss's Ink Trial) | V |
|---|---|---|
| Spear of the Red Moon | +80 reach; the lance breaks projectiles in its line; 30% of the damage passes a block | 1 s shorter cooldown; 15 ink back on a hit |
| Miststep | Shadow Clone: 3 s where you stood; it repeats your next melee attack once | 1 s shorter cooldown; the clone waits 4.5 s |
| Iron Resolve | projectiles striking the stance fly back at the thrower | +0.6 s stance; counter +4 (cap 28) |
| Phantom Edge | each hit returns from behind for 60% (unblockable) | 1 s shorter cooldown; a second wave 0.25 s later |
| Demon Sovereignty | Sovereign Cut +12 (52) | 1 s burnout |

## Weapon classes (M7)

Each class's basic moves take their numbers from the katana move they replace, scaled per class. Their animation comes from an existing move of that weapon type, time-warped onto the new timings (`forge` in `index.html`, data in `data-gear`). The katana at tier I adds nothing, so the default hero is byte-identical.

| Class | Found | Reach | Damage | Windups | Trait |
|---|---|---|---|---|---|
| Katana | at the start | ×1 | ×1 | ×1 | balanced; three-hit chain |
| Yari | Spear Captain (Burning Field elite) | ×1.3–1.45 | ×0.9 | ×1.2 | a whiffed thrust recovers 0.15 s later |
| Kodachi pair | Shinobi Adept (Bamboo Grove elite) | ×0.75–0.8 | ×0.6 a hit | ×0.7 | four-hit chain; ink ×1.3 |
| Kanabō | Iron Acolyte (Mountain Shrine elite) | ×1.15 (low ×1.2) | ×1.5 | ×1.4 | third swing: hyper-armor through its windup, and knockdown |
| Naginata | Drowned Ronin (Moonlit Lake elite) | ×1.3 | ×1 | ×1.15 (recovery ×1.15) | `arc` sweeps: no height whiffs, any guard blocks them |
| Nodachi | Oni Lieutenant (Oni Castle elite) | ×1.2 | ×1.25 | ×1.25 | the third cut lunges |

**Rules (§6.2), checked in `tests/gear.test.js`:**
- Every class differs from the katana by at least 10% in two stats.
- Every class has a handling trait.
- None is better than the katana in everything.

**Kanabō reach:** the spec suggests ×0.85. But the drawn club is 150 px long, so at ×0.85 it visibly swept through foes it could not hit (the tip landed 1.4–1.6× past the hit distance). The §6.3 visual / data check wins, so the reach is ×1.15, and the club stays a trade-off through its ×1.4 windups.

**Weapon tiers** (II–V, mon + upgrade materials; each tier is 5% to one stat):

| Tier | Effect | Cost |
|---|---|---|
| II | +5% damage | 100 mon + 1 material |
| III | +5% reach | 200 mon + 1 material |
| IV | 5% faster windups | 300 mon + 2 materials |
| V | +5% ink | 400 mon + 2 materials |

**Rarity:** the schema covers Common, Rare, Epic, Legendary and Mythic, with modifier slots 0 / 1 / 2 / 2 / 3. The game ships Common charms, Rare weapons and Legendary trial charms. Rarity never multiplies base power, and modifiers wait for a later pass.

## Charms (M7)

There is one charm slot, and the item screen shows ▲ / ▼ against the worn charm. Garb is not built: the spec allows starting with weapons and charms.

| Charm | Source | Effect |
|---|---|---|
| Straw / Crane / Fox / Bell / Carp Charm (Common) | the second duel of each region | health +3% / attack +3% / crit +2% / power cooldowns −4% / ink +6% |
| Moon Tassel (Legendary) | Gekkō's Ink Trial | reach +5%, crit +3% |
| Mist Veil | Kasumi's | roll cooldown −10%, walk +3% |
| Iron Bead | Tetsugorō's | health +6%, damage taken −3% |
| Pale Ribbon | Shirasagi's | ink +10%, power cooldowns −6% |
| Oni Horn | Akuma's | attack +6% |

**Power budget with gear:** best build 1.73× from attributes and echoes. The best gear adds a weapon at tier V (+5% damage) and the Iron Bead or Oni Horn. The search in `tests/gear.test.js` keeps it **≤ 2.0×**.

## Economy (M7)

First clears only: repeats pay XP, never mon or materials, so nothing is grindable.

| Resource | Supply | Demand to max everything |
|---|---|---|
| Mon | bosses 1,100 + ladders 860 + trials 1,500 = **3,460** | power tiers 5,000 + weapon tiers 6,000 = 11,000 |
| Upgrade materials | elites 5 + trials 5 = **10** | 36 to max every weapon |
| Skill points | bosses 6 + milestones (3 by level 19) + trials 5 = **14** | 50 to max every power |

**So the player chooses:** for example, one power to tier V (10 skill points, 1,000 mon), one weapon to tier V (1,000 mon, 6 materials), and a few tiers elsewhere. Nothing is required to beat a boss (D4).

## Feel and accessibility (M8)

- **Whiff punish (§5.8a, hero only):** a hit into the foe's recovery (after its last hit window) deals ×1.2 and pays 4 ink (`data-movement.punish`). It rewards the long recoveries the fairness audit guarantees.
- **Guard Assist (§5.8b, off by default):**
  - An idle, standing hero raises the guard against a mid or high melee hit, with 60% pushback.
  - Never against low hits, projectiles or unblockable cuts.
  - Never while attacking, rolling or airborne, and never in the no-blocking Ink Trial.
- **Anti-turtle (§5.8c):** not added. There is no evidence yet that blocking is the dominant strategy; the spec asks for evidence first.

## The 1.7 economy (Ultimate Edition)

There are two currencies. Neither can be bought with money, and everything is earned in play.

| | Mon (ordinary) | Shadow crystals (rare) |
|---|---|---|
| **Pays for** | Weapons, armour, charms, supplies, upgrade material and power and weapon tiers | Blade finishes, swing trails, auras, robe dyes and the Moonlit Katana (a sidegrade). No crystal item is needed to progress. |
| **One-time supply** | About 7,430 from first clears: campaign 3,460, Ashen Village 350, Hell 1,730, White 1,710, drills 180 | About 860: bosses 130, elites 25, trials 75, Ashen 20, Hell 110, White 110, achievements 390 |
| **Repeatable** | Daily challenges: 50–120 each, three a day | The hardest dailies: 5 each |
| **Demand** | Tiers 11,000+ (more with the variants); shop weapons 5,800; armour 1,500; charms 750; supplies 40–60 each; material 300 | Everything in the crystal stall: 655 |

So mon stays a choice: you cannot max everything from one-time rewards. Every cosmetic, though, can be earned through play.

**Rules that hold the economy together:**

- Repeats pay a quarter of the XP and no currency.
- Custom maps and training pay nothing (a drill pays 20 mon once).
- Every payout is a claim, paid once.

### Prices

| Item | Price | Opens |
|---|---|---|
| Yari, Kodachi, Kanabō, Naginata, Nodachi | 600 mon | After that region's shadow falls. Its elite still gives the weapon free. |
| Storm Yari / Hundred-cut Kodachi | 1,400 mon | After the third / fourth shadow |
| Travel Haori | 150 mon | Always |
| Lamellar Dō, Shinobi Garb | 450 mon | The Bamboo Grove |
| Monk's Kesa | 450 mon | The Mountain Shrine |
| Common charms | 150 mon | Their region |
| Healing Tea / Focus Incense / Whetstone | 40 / 50 / 60 mon | Up to 9 of each |
| Upgrade material | 300 mon | After Gekkō |
| Finishes | 30–60 crystals | Always |
| Trails | 30–60 crystals | Always |
| Auras | 80 crystals | Always |
| Robe dyes | 25–35 crystals | Always |
| Moonlit Katana | 150 crystals | Always |

### Armour and variants are sidegrades (the 2.0× budget)

The best 1.6 build already sat at 1.99× effective power, so nothing in 1.7 may add raw power. `tests/shop.test.js` searches every weapon × armour × charm × allocation × echo pair and checks two things:

- A katana-class build stays ≤ 2.0×.
- No variant beats its own base class.

**Armour:** each piece trades one thing for another.

| Armour | Gain | Cost |
|---|---|---|
| Travel Haori | Faster walk and roll | — (power-neutral) |
| Lamellar Dō | −6% damage taken | −6% damage dealt, slower walk |
| Shinobi Garb | +5% damage, shorter roll cooldown | −5% health |
| Monk's Kesa | +12% ink, −8% power cooldowns | −3% damage |
| Oni-gane Plate (Hell) | −10% damage taken, iron footing | −10% damage dealt |
| Celestial Haori (White) | +10% ink, a parry window 0.05 s longer, a lighter walk | — |

**Weapon rarity means traits, not bigger numbers:**

- Common: the katana.
- Rare: the class's own identity.
- Epic: one trait.
- Legendary: two traits.

**The traits and their costs:**

| Trait | Effect | Cost | Weapon |
|---|---|---|---|
| First strike | +25% on the first hit each round | −3% damage | Storm Yari |
| Momentum | +3% per hit in a row, up to 12% | −8% health | Hundred-cut Kodachi |
| First-hit ink | The first hit each round fills an ink bar | — | Moonlit Katana |
| Burn | 1/s for 2 s, never kills | +10% damage taken | Ember Katana |
| Parry heal | A parry heals 6 | +10% ink | Dawn Blade |
| Two traits each | — | — | Hellmaw Kanabō, Sunlit Naginata |

The budget estimate counts each trait's share of a fight's damage: the first hit is about 10% of a round, momentum averages 60% of its cap, and a burn is measured against about 12 damage a second.

**Supplies** are one-fight boosts outside the permanent budget:

- Whetstone: +6% damage.
- Tea: heals 20, once, below 30% health; none in Hell.
- Incense: one ink bar at each round's start.

## The modes (1.7)

| | Hell Mode | White Mode |
|---|---|---|
| **Opens** | The mysterious sun, after Gekkō | The same |
| **Difficulty** | ●●●●● | ●●●●○ |
| **Foes** | Demons: they counter what they block (35–60%), chain a follow-up after a hit, and read the guard (low against a standing guard, mid against a crouch) | Guardians with a radiant ward. Plain blows deal 15% and do not stagger. A perfect parry breaks the ward for 3 s, a whiff punish for 2.5 s, and an Issen passes it. |
| **Rules** | Healing halved, no Healing Tea, half of the lost health returns between rounds, fire vents | The perfect parry is on (0.15 s, +12 ink, the attacker reels 0.6 s) |
| **New attacks** | The fire pillar (12, knockdown; jump or roll); the Judge's sentence (14, wider; jump or roll) | The light pillar (11; jump or roll); the lotus bloom (two ground waves, 10; block low, jump or roll) |
| **Rewards** | XP 900 → 3,500 per mission; mon 120 → 600; crystals 5 → 50; one skill point each from Enra and the Ninth Gate | The same scale; one skill point each from Hakuren and the Pale Sun |

Both modes' foes use the existing moves plus these four, and the four are audited in `docs/fairness.md` like every boss move.
