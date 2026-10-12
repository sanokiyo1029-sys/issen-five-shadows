# Changelog

## 1.7 — Ultimate Edition (versionCode 8)

Built on 1.6, keeping its ink-wash identity, its duel engine and every existing fight unchanged. The golden baseline confirms that boss moves, bosses and the default hero are untouched. 1.7 only adds new arenas and moves.

### Main menu
- **Main menu:** a night-ink hub with the cliff at night, embers and its own music. Its entries:
  - Continue / Begin, New Game, World Map, Training Room, Shop, Inventory, Hell Mode, White Mode, Challenges, Settings and Quit.
  - Character, Controls and the intro film as links.
- **Status line:** level, mon, shadow crystals, the equipped weapon and campaign completion.
- **Locked entries:** they say what opens them. Back exits only from here.
- **New Game:** asks first and keeps the old journey as a copy (Character › Save code › Restore). Settings stay.
- **Quit:** closes the Android app through the new `IssenNative` bridge. In a browser it explains that a tab cannot close itself.

### Two currencies, shop and inventory
- **Shadow crystals:** paid once per claim from bosses, elites, trials, mode missions, achievements and the hardest daily challenges. Saves from before 1.7 are paid what they already earned.
- **Shop:**
  - Weapons, armour, charms, supplies and upgrade material for mon.
  - Blade finishes, swing trails, auras, robe dyes and the Moonlit Katana for crystals.
  - Shows prices, insufficient funds, a comparison with what you carry, then a confirmation.
  - A purchase takes the price only when it goes through and is saved; otherwise it is undone.
- **Inventory:** weapons (variants included), armour, charms, supplies and cosmetics.
- **Armour and weapon variants are sidegrades:** every gain has a cost.
  - Rarity adds traits: first strike, momentum, burn, first-hit ink, parry heal, iron footing.
  - The 2.0× effective-power budget is tested over every combination.
- **Supplies (Healing Tea, Whetstone, Focus Incense):** used in campaign, Hell and White fights, one per finished fight.
- **Victory screen:** shows XP, mon, crystals, items, the challenges completed and the purse.

### Training Room (the Forgotten Dojo)
- **Partner:** a straw dummy or any foe already met. It can stay still, always block, attack (every move or one pattern, at three tempos) or fight back.
- **Options:**
  - Any owned weapon, without touching the loadout.
  - Infinite health or ink.
  - Hitboxes and hurtboxes.
  - Combo counter and damage numbers.
  - Reset, controls, leave.
- **Nine drills:** chain, guard, high and low, roll through, punish, perfect parry, combo, Issen and sparring. Each pays 20 mon the first time only.
- Nothing else in training changes the save.
- **The perfect parry:** a fresh guard within 0.15 s. Training and White Mode only.

### Challenges
- **Three daily challenges per local date,** drawn only from those you can do.
- The five Ink Trials, playable from here.
- **23 achievements.**
- Everything pays once, the moment it is met. Training and custom maps never count.

### World map
- An ink map one and a half screens wide. It pans by drag, wheel, arrows or keyboard / gamepad focus.
- **Markers:** locked (dashed, with the reason) or open, with difficulty, completion and the boss or mission count. The next road pulses.
- A preview shows the rewards still to earn. The hero stands where you last went.
- **A hidden road to Ashen Village:** a new arena, two foes and three missions, including a gauntlet. It is found once two shadows fall and every Burning Field duel is won.

### Ink Workshop: a map editor
- **Custom arenas:**
  - Width, floor, light and weather.
  - One-way ledges and obstacles you can jump onto or over.
  - Telegraphed hazards that hurt both fighters (fire, spikes, ink).
  - Pickups and spawn points.
  - One to five foes in waves, with a difficulty multiplier.
- **Editor:** tap the live preview to place pieces, then adjust their size, timing and damage. Validation explains every unplayable layout in a plain sentence.
- **Workshop:**
  - Up to 24 maps in their own checksummed storage.
  - Play, test-play, edit, duplicate and delete (asks first).
  - Publish to the world map; share or load as a code.
  - Custom maps pay nothing.

### The mysterious sun
- The first time Gekkō falls, a sun rises over the field with a sound of its own: "The light has awakened. Choose what lies beyond."
- Touching it offers Hell Mode or White Mode. Neither opens by itself, and the choice is saved.
- The sun then waits on the world map until both paths are open. Saves from before 1.7 find it there.

### Hell Mode (the Infernal Realm)
- **Look:** black and crimson arenas (the Ash Gate, the Ninth Gate). The fighters' ink reads as silhouettes against the fire.
- **Demons:**
  - They strike back at what they block, chain a second cut after one lands, and read your guard.
  - Healing is halved, there is no tea, wounds carry between rounds, and fire vents flare.
- **Seven missions:**
  - Duels, a gauntlet and a survival.
  - The Wraith Captain (elite), Enra the Ember Judge, and Akuma Unbound at the Ninth Gate.
  - Exclusive rewards: Ember Katana, Hellmaw Kanabō, Ember Heart, Oni-gane Plate, Hellfire Wake.
- **New telegraphed attacks:** a fire pillar on a locked ring, and the Judge's wide "sentence".

### White Mode (the Celestial Sanctuary)
- **Look:** pale blue, silver and gold arenas (the Celestial Sanctuary, the Pale Sun). Floating islands and torii. The fighters stay dark for contrast.
- **The radiant ward:** guardians wear a ward that turns plain blows aside. A perfect parry, a whiff punish or an Issen breaks it.
- **Seven missions:**
  - Falling light (survive), your Reflection, the Bell Tower, a gauntlet.
  - Hakuren the White Lotus, and the Warden of the Pale Sun.
  - A story card before the key ones.
  - Exclusive rewards: Dawn Blade, Sunlit Naginata, Celestial Haori, Dawn Wake.
- All new attacks have a telegraph and at least two answers verified by simulation (`docs/fairness.md`).

### Settings and quality of life
- Master, music and sound-effect volumes, plus joystick sensitivity.
- Language (English, the only translation so far) and full screen.
- Typing in a text field no longer triggers game keys.
- Android Back is consistent on every new screen.

## Tests

`node tests/run.js` runs the headless suite. `node tools/smoke.js` walks every screen in headless Edge and fails on any console error. The new test files:

| File | What it proves |
|---|---|
| `menu.test.js` | The main menu and its entries; Continue after a restart; New Game asks and can be restored; crystals pay once and are backfilled; Quit; volumes |
| `shop.test.js` | Prices taken exactly once; refusals with reasons; closed stock; an unsaved purchase undone; the shop screen; equipment changes the fight; the 2.0× budget with every armour, charm and weapon; cosmetics change no number; supplies |
| `training.test.js` | No clock and no KO; the save untouched; every behaviour and one-pattern practice; infinite health; weapons without the loadout; hitboxes; combo counter; drills pay once; the parry (and none in the campaign) |
| `challenges.test.js` | Dailies by date, counted from that day; yesterday spent; achievements once; fight tallies only from campaign and mode fights; the challenges screen |
| `world.test.js` | Markers, locks and reasons, the rewards preview, panning, the hidden road, missions in order, repeats and losses, gauntlets, Continue to a location |
| `workshop.test.js` | Validation of every unplayable layout; clamping; checksummed storage; ledges, walking off, obstacles, walls; hazards and pickups; the foe avoiding a flare; the editor; publish, duplicate, share, load, delete; waves and no rewards |
| `modes.test.js` | The sun after Gekkō: touched, not automatic, saved, once; Later; the map's sun for the other path; old saves; locked menu entries; each mode's own missions and arenas; Hell's counter, halved healing, no tea, carried wounds and vents; White's ward and what breaks it; finals pay their gear and achievements |

The tests from 1.6 still pass. Changed expectations are listed in each commit:

- The main menu is now the root.
- The world map replaced the five cards.
- Rewards include crystals.
- Gekkō's first fall leads through the sun.

**Not testable on this PC:**

- A real Android phone or tablet (install over 1.6, touch, Back, performance).
- A physical gamepad.
- iOS.
- Audio by ear.

See `docs/release.md`.
