# QA plan — action dock (one run, one demo video)

**One snapshot. One continuous play sequence.** Each step lists the features it shows (`D#`).

| | |
|---|---|
| Snapshot | `tmp/qa/snapshots/action-dock-qa-run.json` |
| Regen | `cd lib && pnpm exec tsx ../.agents/skills/QA/make-action-dock-qa-run.ts` (add `simulate` to play the plan on the engine, no UI) |
| Replay | `node .agents/skills/QA/replay-action-dock-qa.mjs` — plays this plan in the UI, checks each step against `GET /game` and the page, records `tmp/artifacts/action-dock-qa/qa-action-dock-demo.mp4` |
| Dice | None: the plan has no battle. |

## Features under test

| Id | Feature | Step |
|----|---------|------|
| **D1** | Action tray is a dock of icon tiles in the colour of the faction taking the turn; a tile is named on hover | 1, 6, 9 |
| **D2** | Log, items and discard pile sit top right; the dock takes the bottom right corner | 1 |
| **D3** | Crafted-card actions sit in a Cards panel above the dock, with a played tally | 2, 5 |
| **D4** | A clamped card action description carries its full text on hover | 2 |
| **D5** | Dock action grid is always four tiles wide | 3 |
| **D6** | A spent action stays in its dock tile, faded; Undo is a dock tile | 3 |
| **D7** | A move walks its meeples in a line, treading faction-coloured footsteps | 4, 8, 10 |
| **D8** | Add to Decree can be cancelled while staging | 6 |
| **D9** | Eyrie Daylight dock shows the Decree as its four columns | 7, 8 |
| **D10** | Woodland Alliance military operations each have their own icon | 9 |
| **D11** | The dock tab counts the military operations left | 9, 10 |

## Setup

1. Regen snapshot (optional).
2. Spare pair of servers, so a game in progress is left alone (`ROOT_GAME_STORE_FILE=off` is required):
   ```bash
   ROOT_GAME_STORE_FILE=off PORT=3100 pnpm --filter @root/web dev
   ROOT_DEV_API=http://localhost:3100 pnpm --filter @root/react exec vite --port 5180 --strictPort
   ROOT_DEV_API=http://localhost:3100 ROOT_REACT_URL=http://localhost:5180 node .agents/skills/QA/replay-action-dock-qa.mjs
   ```
3. By hand: `pnpm --filter @root/cli start -- load "$PWD/tmp/qa/snapshots/action-dock-qa-run.json"`, then React → **QA: Continue loaded game**.
4. **One browser tab only** (every QA tab ends empty phases by itself).

**Seats:** `0` Marquise · `1` Eyrie (builder) · `2` Woodland Alliance

**Start:** first Marquise Birdsong, after a standard setup (keep on **2**, roost on **0**).

| Who | Extra to the standard setup |
|-----|-----------------------------|
| Marquise | 3 warriors on the keep (**2**); crafted Swap Meet, League of Adventurous Mice, Propaganda Bureau, Charm Offensive; a Boot; Anvil in hand |
| Eyrie | Foxfolk Steel and Bake Sale in hand |
| Alliance | 2 officers; base + sympathy + 2 warriors on **9**; 1 warrior on **1**; no supporter, no hand |

## Steps

| # | Do | Expect | Shows | ✓ |
|---|----|--------|-------|---|
| 1 | Look; hover the **End phase** tile | Orange dock in the bottom right corner, tab "Birdsong", tooltip "End phase". Log / Items / Discarded top right | **D1 D2** | ☐ |
| 2 | Click the **Cards** tab; hover a rule text; close | Tab reads `0/1 played`. Five lines; only Swap Meet is lit, the Daylight and Evening ones are pale. The two-line rule has its full text as hover title | **D3 D4** | ☐ |
| 3 | **End phase** twice (Birdsong, craft step) → hover **March** → **Recruit** | Tab `3/3`; recruit, march, build, battle fill two columns of a grid four tiles wide. After Recruit: `2/3`, the Recruit tile stays, faded; Undo tile in the dock | **D5 D6** | ☐ |
| 4 | **March** → **2** → **5** → `>` `>` → **OK** → **OK** | Three warriors leave the keep one behind the other on orange footsteps. 4 Cat warriors on 5 | **D7** | ☐ |
| 5 | **Cards** → **League: move** → **Boot** → **10** → **11** → **OK**; open **Cards** again | Boot exhausted, warrior on 11. Tab `2/3 played`; both League lines struck through, tagged "played" | **D3** | ☐ |
| 6 | **End phase** → **Draw**. Eyrie: **Add to Decree** → Foxfolk Steel → **move** → **X** | Blue dock. After X nothing was sent: hand still 2, move column still 1 card, Add to Decree offered again | **D1 D8** | ☐ |
| 7 | **Add to Decree** → Foxfolk Steel → **move** → **OK**; hover the recruit medallion | Daylight dock = four medallions (recruit, move, battle, build) over strips of suits (3 cards). Tab `0/3` | **D9** | ☐ |
| 8 | Recruit medallion (→ **0**) → fox suit of the move column → **0** → **4** → `>` `>` → **OK** | Tab `1/3`, then `2/3`. Three Eyrie warriors walk 0 → 4 on blue footsteps | **D7 D9** | ☐ |
| 9 | Bird suit of the move column → **0** → **8** → **OK**; (turn passes by itself to the Alliance Evening) hover the four tiles | Green dock, tab `2/2`; move, battle, recruit, organize each with their own icon | **D1 D10 D11** | ☐ |
| 10 | **Move** → **9** → **11** → `>` → **OK** | Two Alliance warriors walk on green footsteps. Tab `1/2` | **D7 D11** | ☐ |

## Not covered by this run

- "Tray offers no stale action after a submit" — a race between a click and the next state (unit test: `GameSession.test.ts`).
- The hover text of D4 is the browser's own tooltip: a headless recording does not draw it. The replay checks the `title` attribute against the full rule.
- Holding a Cards line to see the crafted card; a ninth tile opening a fifth column (`phaseTiles.test.ts`, `cardActionRows.test.ts`).
- Decree battle and build columns, turmoil (`decreeColumns.test.ts`).
