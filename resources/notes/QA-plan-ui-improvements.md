# QA plan — UI improvements (one run, one demo video)

**One snapshot. One continuous play sequence.** Each step lists the features it shows (`U#`).

| | |
|---|---|
| Snapshot | `tmp/qa/snapshots/ui-improvements-qa-run.json` |
| Regen | `cd lib && pnpm exec tsx ../.agents/skills/QA/make-ui-improvements-qa-run.ts` (add `simulate` to play the plan on the engine, no UI) |
| Replay | `node .agents/skills/QA/replay-ui-improvements-qa.mjs` — plays this plan in the UI, checks each step against `GET /game` and the page, records `tmp/artifacts/ui-improvements-qa/qa-ui-improvements-demo.mp4` |
| Dice | Fixed by the snapshot's rng seed (`BATTLE_DICE` in the regen script): the two battles roll 0 – 0, then 2 – 1. An extra or skipped battle shifts the rolls. |

## Features under test

| Id | Feature | Step |
|----|---------|------|
| **U1** | Outcast suit picked from suit icons, not text | 1 |
| **U2** | Icon before each Riverfolk service (Hand Card, Riverboats, Mercenaries) | 3, 5 |
| **U3** | Decline action of the service prompt reads **Skip Service** | 3 |
| **U4** | Vagabond pawn slides into / out of a forest like any move, no "+" pop | 4 |
| **U5** | A bought card flies Riverfolk rail tile → middle (1 s) → buyer's rail tile | 5 |
| **U6** | Wood appears at one sawmill after the other | 5 |
| **U7** | Craft: anvil, three hammer strikes, the card pops out | 6 |
| **U8** | A battle nobody had to answer (0 – 0) still shows its result | 7 |
| **U9** | Faction head portraits on the battle tiles and on the player rail | 7, 10 |
| **U10** | Attacker ⚔ defender badge on the battle clearing, from the ambush step until the result leaves, dimmed by the battle backdrop | 7 |
| **U11** | Discard: once enough cards are picked, the others dim and cannot be added | 9 |
| **U12** | Reveal: the card flies in face down (deck back), then flips | 10 |

## Setup

1. Regen snapshot (optional).
2. `pnpm --filter @root/web dev` + `pnpm --filter @root/react dev`.
   The snapshot **replaces the game** of the API it is loaded into. To leave a game in progress alone, run a spare pair and point the replay at it. `ROOT_GAME_STORE_FILE=off` is required: without it the spare backend loads and overwrites the same saved game file (`backend/web/.data/game-slot.json`) as the main one.
   ```bash
   ROOT_GAME_STORE_FILE=off PORT=3100 pnpm --filter @root/web dev
   ROOT_DEV_API=http://localhost:3100 pnpm --filter @root/react exec vite --port 5180 --strictPort
   ROOT_DEV_API=http://localhost:3100 ROOT_REACT_URL=http://localhost:5180 node .agents/skills/QA/replay-ui-improvements-qa.mjs
   ```
3. By hand: `pnpm --filter @root/cli start -- load "$PWD/tmp/qa/snapshots/ui-improvements-qa-run.json"`, then React → **QA: Continue loaded game**.
4. **One browser tab only.** Every QA tab plays the actor and ends empty phases by itself: a second tab on the same game ends phases the plan still needs (the slip step goes first).
5. The UI ends a phase by itself when **End phase** is the only action: steps 4 → 5, 5 → 6 and 8 → 9 need no click.

**Seats:** `0` Vagabond (thief) · `1` Marquise · `2` Lizard Cult · `3` Riverfolk (four players)

**Start:** setup, on the Cult's **Outcast** choice. The Riverfolk setup follows, then the Vagabond takes the first turn.

### Board cheat-sheet

| Clearing | Suit | Pre-placed |
|----------|------|------------|
| **0** | fox | Cult garden + 3 Cult warriors |
| **1** | mouse | empty — **slip target** |
| **2** | rabbit | **Keep** + sawmill + 1 Cat warrior |
| **5** | fox | Cat workshop + 1 Cat warrior — **crafts Anvil** |
| **6** | mouse | Cat sawmill + 1 Cat warrior |
| **8** | mouse | 1 Cult warrior — **ritual recruit** |
| **9** | rabbit | 3 Cat warriors + 2 Cult warriors — **both battles** |
| **10** | mouse | Cat recruiter + sawmill + 1 Cat warrior |
| forest 4 | — | Vagabond pawn (borders 1, 5, 9, 10) |

**Hands:** Marquise 7 cards (Anvil among them) · Riverfolk Birdy Bindle, Travel Gear, Crossbow (public) · Cult Mouse-in-a-sack, Root Tea ×2 · Vagabond 2 cards. No ambush cards.

## Steps

| # | Do | Expect | Shows | ✓ |
|---|----|--------|-------|---|
| 1 | Cult prompt "choose the Outcast suit": look, then click the **fox** tile | Three tiles with a suit icon each, no text. Outcast marker on fox | **U1** | ☐ |
| 2 | Riverfolk: click clearing **3**, **3**, **4**, **4**; costs modal → **OK** (1 / 1 / 1) | Setup ends; Vagabond Birdsong opens with the service prompt (**Buy Service** / **Skip Service**) | — | ☐ |
| 3 | **Buy Service** → look at the service buttons → **X** → **Skip Service** | Hand Card and Riverboats each carry an icon before the label. The decline action reads **Skip Service**. Nothing bought | **U2 U3** | ☐ |
| 4 | **Slip** → clearing **1** | The pawn slides from forest 4 to clearing 1 with the dashed move trail. No green "+" badge on clearing 1 | **U4** | ☐ |
| 5 | (Vagabond turn ends by itself.) Marquise: **Buy Service** → **Hand Card** → **Birdy Bindle** | All three services show icons. Birdy Bindle leaves the Riverfolk rail tile face up, rests in the middle about a second, flies into the Marquise rail tile. Wood pops on **2**, then **6**, then **10** — not all at once | **U2 U5 U6** | ☐ |
| 6 | **Craft** → **Anvil** | An anvil leaves the Marquise rail tile; the hammer strikes it three times with sparks; Anvil pops out, rests, fades. Crafted items: 1 | **U7** | ☐ |
| 7 | **Battle** → clearing **9** → look → **Skip ambush** → look → click to dismiss | Ambush step: cat ⚔ lizard head badge on clearing 9, no battle panel yet. Dice **0 – 0**: the result stays on screen ("No pieces removed") with head portraits on both tiles; the badge is still on 9, dimmed behind the panel. After dismissing, the badge is gone. 3 Cat / 2 Cult warriors still on 9 | **U8 U9 U10** | ☐ |
| 8 | **Battle** → clearing **9** → **Skip ambush**; remove one Cat warrior if asked; **Decline Field Hospitals** | Dice **2 – 1**: both Cult warriors → acolytes (Revenge), one Cat warrior removed | (ordinary battle) | ☐ |
| 9 | **End phase** → **Discard** → pick Travel Gear, Protection Racket, Foxfolk Steel → look → click Bake Sale → **OK** | With 3 of 3 picked the 5 other cards dim. The click on Bake Sale does nothing. Hand back to 5; Bake Sale kept | **U11** | ☐ |
| 10 | Cult: **Skip Service** → **End phase** (Birdsong) → **Recruit** → **Mouse-in-a-sack** → clearing **8** | The card leaves the Cult rail tile **face down** (deck back), lands in the middle, flips face up. +1 Cult warrior on 8. All four rail tiles show head portraits | **U9 U12** | ☐ |

## Not covered by this run

- Slip **into** a forest and forest → forest (unit tests: `pawnForestMoves.test.ts`).
- A battle that ends with no ambush step at all, read from the log alone (unit test: `battleOverlayController.test.ts`).
- Mercenaries / Riverboats purchases (no card flies; `cardFlights.test.ts`).
