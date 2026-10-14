# Save format v2 (with the 1.7 and 1.8 additions)

## Storage keys (localStorage)

| Key | Contents |
|---|---|
| `issen-five-shadows.v2.a` and `issen-five-shadows.v2.b` | Two rotating slots, each holding `{"sum": <FNV-1a of doc>, "doc": <save>}`. Every write goes to slot `rev % 2`. |
| `issen-five-shadows` | The v1 key, `{"beaten":N}`. It is never deleted, and it is rewritten after every v2 write so a rollback to v1.x still finds its progress. |
| `issen-five-shadows.quarantine` | Up to three unreadable slot texts `{at, raw}` kept aside, never just dropped. |

## Document (`doc`)

```
{ v: 2, rev, savedAt,
  profile:  { level, xp, attrPts, skillPts, attrs: {assault, survival, shadowcraft}, mon, materials },
  progress: { beaten: 0-5, defeated: [boss_id], ladder: {}, regionsUnlocked: 1-5, trialsDone: [], lastWin: {id, result} | null },
  powers:   { <power_id>: { unlocked: true, tier: 1-5 } },
  loadout:  { powers: [id|null, id|null], echoes: [id|null, id|null] },
  gear:     { owned: [], equipped: {} },
  settings: {}, rewardsClaimed: { "boss:<boss_id>": <timestamp> },
  story:    { pending: [ {kind:"power", id} | {kind:"migrated"|"corrupt", text} ] },
  legacy:   { raw, migratedAt } | null }
```

- **`xp` is the running total.** `level` is always re-derived from it on load (see `docs/balance.md`).
- **`attrPts` and `skillPts` are derived on every load** (M4), as earned minus spent:
  - Attribute points: earned = (level − 1) × 2; spent = the sum of the ranks.
  - Skill points: earned = the claimed bosses' skill points + one per milestone level reached (5, 10, 15, 20, 25); spent = the tier costs.
  - If spent exceeds earned, the save is impossible: ranks (or tiers) reset to 0 (tier I), and the points come back.
- **`attrs`**: ranks from 0 to `rank_cap` (20).
- **`powers[id].tier`**: capped at III until that boss's Ink Trial is in `progress.trialsDone`, and at I for a power that isn't playable yet.
- **`loadout.echoes`**: absorbed powers only, with slots opening at levels 8 and 14. A power in a power slot can't also be an echo.
- **`progress.ladder`** (M6) is `{ <region_id>: steps cleared, 0 to the step count }`. It is the checkpoint, kept through losses.
- **Ladder and trial claims:**
  - `rewardsClaimed` also holds `step:<region_id>:<i>` and `trial:<boss_id>` claims, paid once like the boss claims.
  - `progress.trialsDone` lists the bosses whose Ink Trial is passed (boss ids only); `gear.owned` receives the trial item.
- **`story.seen`** lists the regions whose story card was shown.
- **`settings`** (M8): validated field by field with defaults (see `cleanSettings`); custom key bindings are `{KeyboardEvent.code: action}`.
- **`gear`** (M7):
  - `owned`: weapon and charm ids; the katana is always owned.
  - `equipped`: `{weapon, charm}`; anything not owned falls back to the katana / no charm.
  - `tiers`: `{weapon_id: 1-5}`.
  - Mon and materials are stored (spent on tiers), not derived.
- **`lastWin`** records the last victory processed, keyed by the match id. A victory reported twice replays the stored result and grants nothing again.
- **`story.pending`** holds one-time messages shown on the map and removed once read. It also covers a reveal ceremony interrupted by an app kill.

## Additions in 1.7 (still `v: 2`)

Every field below is optional on load and gets its default when missing, so a 1.6 save loads unchanged. 1.6 itself would read a 1.7 save and drop these fields, never fail on them.

| Field | Contents |
|---|---|
| `profile.crystals` | Shadow crystals, 0 to 1e9 |
| `gear.equipped.armour`, `gear.equipped.item` | The worn armour (owned only) and the supply carried into fights (an id from `data-gear.items`) |
| `gear.items` | `{supply_id: count}`, each count clamped to that supply's `max` |
| `gear.cos` | `{finish, trail, aura, robe}`: worn cosmetics. Each must be owned and of that kind. |
| `gear.owned` | Now also holds armour, weapon variants and cosmetic ids |
| `world` | `{at: region index or -1, loc: a mission location id or '', secret: 0/1}`: where Continue goes and whether the hidden road is found |
| `modes` | `{sun: 0/1, hell, white}`: the sun answered and each mode opened. A mode cannot be open while `sun` is 0. |
| `daily` | `{day: 'YYYY-MM-DD', ids: [3 challenge ids], base: {stat: value at the day's start}}` |
| `stats` | Lifetime counters: `wins`, `losses`, `perfect`, `punishes`, `parries`, `blocks`, `evades`, `chains`, `issen`, `knockdowns`, `powerHits`, `rollsThrough`, `bigWins`, `hellWins`, `whiteWins`, `dailies`, `drills`, `purchases`, `mapsMade` |
| `story.seen` | Also holds mission location ids and `<loc>:<i>` for mission story cards |

**New claims in `rewardsClaimed`, each paid once:**

- `cr:<claim>`: the crystals of a claim (idempotent; also backfills older saves).
- `<loc>:<i>`: a mission's first clear (`ashen`, `hell`, `white`).
- `daily:<day>:<id>`: a daily challenge. Older days are pruned when the day turns.
- `ach:<id>`: an achievement.
- `drill:<id>`: a training drill.
- `event:sun`: the sun answered.
- `made:<map id>`: a valid custom map counted once.

**Mission skill points:** derived like the others, as earned (claims) minus spent (tiers).

## Additions in 1.8 (still `v: 2`)

1.8 reads every 1.7 save. Going back is not supported: 1.7 opens a 1.8 save and keeps every claim, and it finds the mode fields mirrored, but it shows ladder steps and missions as unplayed (their claims moved to `m:<id>`).

| Field | Contents |
|---|---|
| `att` | The attempt ledger: `{seq, open: {id, kind, ref, epoch, at, supply} or null, done: [last 64 ids], floor, receipts: {id: result}, at most 24}`. A rewarding fight opens an attempt (saved) before the bell; settling pays it once; a replay returns the receipt; a stale or foreign attempt pays nothing. An attempt still open at load was cut off: it is retired, unpaid. |
| `profile.epoch` | The profile's identity, new on New Game, Restore and Import. An attempt from another epoch never settles. |
| `modes` | `{ack: 0/1, visited: {hell, white}, last: 'hell', 'white' or null}`, plus `sun`, `hell`, `white` written as a mirror for 1.7. Eligibility is never stored: both paths open with the `boss:gekko` claim. A 1.7 save maps `sun` to `ack` and a chosen path to `visited`. |
| `tour` | `{best: {event id: stages}}`: each tournament event's best run |
| `settings` | Adds `opacity` (0.3 to 1), `captions` (true/false), `fps` (60 or 30) |
| `daily.day` | Now a high-water mark: a clock set back never repays a claimed day |

**Claims:** ladder steps and missions are claimed by stable id, `m:<id>`, in place of `step:<region>:<i>` and `<loc>:<i>`. `LEG` maps every 1.7 key onto its id on load (crystal flags and story cards too). A `boss:` or `trial:` claim that disagrees with `progress` is dropped. Lieutenants (new steps) have ids only.

**Writes:** every reward goes through `commit()`: the change is made on the save, written, and rolled back if the write fails, with a "could not be saved" notice offering a retry. A save from a newer version (`v > 2`) is never overwritten (`STORE.lock`).

**Custom maps** gain `verified`: the signature (`mapSig`) of the last layout won. Publishing needs it to match; an imported map arrives unverified and unpublished.

### Other keys (localStorage)

| Key | Contents |
|---|---|
| `issen-five-shadows.maps` | `{sum, maps: [...]}`: up to 24 custom maps, checksummed. Each map is clamped by `cleanMap` on load; a damaged store loads as empty. |
| `issen-five-shadows.before-new-game` | The sealed save from before the last New Game, for Restore |

Custom maps are not part of the save code. Share them one at a time from the workshop (`ISSENMAP1-…`).

## Load order (`loadSave`)

1. Take the slot with the highest `rev` whose checksum matches. Validate and clamp every field with `cleanSave`.
2. If no slot is valid, **migrate** from the v1 key: clamp `beaten` to an integer 0–5 and keep the raw text in `legacy.raw`. Then replay each defeated boss through `grantClear`, the same claim used in live play, so XP, level, skill points, mon and powers follow.
   - If any slot text existed but was unreadable, quarantine it first.
   - Then queue a "your save was damaged" notice that offers **Import a save code**.
3. Write the result immediately as v2.

## Save code

`ISSEN2-` + base64(UTF-8 of `{"sum","doc"}`), produced from **Character → Export save code**.

On import, the checksum is verified and the document is run through `cleanSave`. An in-game confirmation shows both levels before anything is replaced.

## Guarantees (tested in `tests/save.test.js` and `tests/progression.test.js`)

- Rewards are written **before** the victory ceremony, so killing the app mid-ceremony loses nothing. The interrupted reveal is shown on the next visit to the map.
- Each first-clear reward is granted exactly once, through its claim, and each fight settles exactly once, through the attempt ledger (1.8; the old `lastWin` field is kept for older builds but no longer used). Tests: `tests/durable.test.js`, `tests/stage4.test.js`.
- A damaged newest slot falls back to the previous slot.
- Values like `"abc"`, `-2`, `99`, `true` or bad JSON never lock a boss.
