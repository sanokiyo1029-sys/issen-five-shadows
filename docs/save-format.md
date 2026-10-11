# Save format v2

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
- **`lastWin`** records the last victory processed, keyed by the match id. A victory reported twice replays the stored result and grants nothing again.
- **`story.pending`** holds one-time messages shown on the map and removed once read. It also covers a reveal ceremony interrupted by an app kill.

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
- Each first-clear reward is granted exactly once, through the `boss:<id>` claims plus the `lastWin` match id.
- A damaged newest slot falls back to the previous slot.
- Values like `"abc"`, `-2`, `99`, `true` or bad JSON never lock a boss.
