# QA plan — crafted card actions in the frontend (one run, one demo video)

**One snapshot. One continuous play sequence. One video.** Each step lists **Hits** (`C#`, matching `FEEDBACK-10-Oct.md` section 2).

Status: **passes.** `simulate` plays the plan on the engine; the replay plays it in the UI (9 recorded steps, each covering one card).

| | |
|---|---|
| Snapshot | `tmp/qa/snapshots/card-fe-support-qa-run.json` |
| Regen | `cd lib && pnpm exec tsx ../.agents/skills/QA/make-card-fe-support-qa-run.ts` (add `simulate` to play and check the plan on the engine, no UI) |
| Replay | `node .agents/skills/QA/replay-card-fe-support-qa.mjs` — plays this plan in the UI, checks each step against `GET /game`, records `tmp/artifacts/card-fe-support-qa/card-fe-support.qa.mp4` |
| Rules | Card text (`lib/src/cards/ep.generated.ts`), `resources/rules/Law_of_Root.md` G.1.21 Replace, 6.2.2 The Keep, 6.2.3 Field Hospitals |
| Dice | Fixed by the snapshot's rng seed: the single battle of this plan (step 9) rolls 1 / 0. An extra battle shifts the roll. |

---

## Setup

1. Regen snapshot (optional).
2. `pnpm --filter @root/web dev` + `pnpm --filter @root/react dev`.
   The snapshot **replaces the game** of the API it is loaded into. To leave a game in progress alone, run a spare pair (`ROOT_GAME_STORE_FILE=off` is required, see `QA-plan-ui-improvements.md`).
3. `pnpm --filter @root/cli start -- load "$PWD/tmp/qa/snapshots/card-fe-support-qa-run.json"` (absolute path).
4. React → **Continue loaded game** (not New Game). **One browser tab only.**
5. After each step: board + `GET /game` / `/game/log`.
6. Every **Field Hospitals** prompt the Marquise gets (steps 9, 14): **Decline**.
7. No step is skipped when it has a single possible value: every pick below is asked, even "Marquise" as the only enemy.
8. The UI ends a phase by itself when **End phase** is the only action: steps 1, 8 and 17 need no click, and Birdsong / Evening end alone after steps 9 and 18.

**Seats:** `0` Marquise · `1` Woodland Alliance (two players). The Alliance is the actor: every step of its turn is optional, so the turn shows the card actions only.

**Start:** Marquise Evening / `discard` — one **End phase** starts the Alliance turn.

### Board cheat-sheet

| Clearing | Suit | Pre-placed |
|----------|------|------------|
| **1** | mouse | 3 Cat warriors — **False Orders** origin, then **Eyrie Émigré** battle |
| **2** | rabbit | **Keep** + 2 Cat warriors — never offered to Propaganda Bureau |
| **4** | rabbit | empty — **League** move destination |
| **5** | fox | empty — **False Orders** destination |
| **6** | mouse | 2 Cat warriors — **Propaganda Bureau** target |
| **9** | rabbit | 4 Alliance warriors — **Eyrie Émigré** origin |

Paths used: 1–5, 1–9, 1–4.

### Boards, hands, piles

| | |
|---|---|
| Alliance play area | Saboteurs, Swap Meet, False Orders, Eyrie Émigré, League of Adventurous Mice, Propaganda Bureau, Charm Offensive, Informants, Coffin Makers (0 warriors on it) |
| Alliance Crafted Items | Travel Gear (boot), Root Tea (tea), both ready |
| Alliance hand | Travel Gear (mouse), Mouse-in-a-sack (mouse), A Visit To Friends (rabbit) |
| Alliance board | no supporters, no officers, no sympathy, no base (nothing else to do in the turn) |
| Marquise play area | Boat Builders, Tunnels |
| Marquise hand | Sword (mouse) — no ambush |
| Discarded pile | Ambush! (fox), Anvil |

---

## Case index

| ID | Case |
|----|------|
| C1 | Propaganda Bureau — clearing → enemy → card to spend; enemy warrior replaced |
| C1a | Replace must be completable: Keep clearing not offered |
| C1b | Replace = remove then place: Field Hospitals is offered to the Marquise |
| C1c | A replaced warrior does not go to Coffin Makers |
| C2 | Saboteurs — enemy → one of their crafted cards; both cards discarded |
| C3 | League of Adventurous Mice — crafted item → move; once per Daylight |
| C4 | Swap Meet — pick another player |
| C4a | Random card is taken first, then the card to give is picked (the taken card can be given back) |
| C5 | Charm Offensive — draw 1, another player scores 1 |
| C6 | Informants — ambush card from the Discarded pile instead of drawing |
| C7 | False Orders — enemy → origin → destination; half the warriors (round up) move, ignoring rule |
| C8 | Eyrie Émigré — origin → destination → count → defender; move then battle |
| C8a | The move is forced at the end of Birdsong |

---

## Sequence

Play top → bottom. Do **not** reload between steps (unless Fail → regen).

### Part 1 — Alliance Birdsong

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 1 | As Marquise: **End phase** | Alliance Birdsong. Tray: **saboteurs**, **swap meet**, **false orders**, **end phase**. No league / propaganda / charm / informants button | | ☐ |
| 2 | **saboteurs** → **Marquise** | The Marquise crafted cards are shown: Boat Builders, Tunnels | **C2** | ☐ |
| 3 | Pick **Boat Builders** | Boat Builders and Saboteurs → Discarded pile (4 cards). Marquise keeps Tunnels. **saboteurs** button gone | **C2** | ☐ |
| 4 | **swap meet** → **Marquise** | Sword moves to the Alliance hand (4 cards); Marquise hand empty. Banner asks for the card to give; **all 4** cards can be picked, Sword included | **C4** **C4a** | ☐ |
| 5 | Give **Travel Gear (mouse)** | Alliance hand: Sword, Mouse-in-a-sack, A Visit To Friends. Marquise hand: Travel Gear. **swap meet** button gone | **C4a** | ☐ |
| 6 | **false orders** → **Marquise** | Clearings 1, 2, 6 highlighted (every clearing with Cat warriors) | **C7** | ☐ |
| 7 | Origin **1** → destination **5** | Only 4, 5, 9 offered as destination. 2 of the 3 Cat warriors (half, rounded up) move to 5: 1 = 1 Cat, 5 = 2 Cat. False Orders → Discarded pile (5 cards). Button gone | **C7** | ☐ |
| 8 | Nothing to click: only **End phase** is left, the UI ends Birdsong | Birdsong does not end: the Eyrie Émigré prompt opens by itself and cannot be cancelled. Only clearing **9** is an origin | **C8a** | ☐ |
| 9 | Origin **9** → destination **1** → **3 warriors** → **Marquise** | Destinations 0, 1, 11 offered. 3 Alliance warriors move to 1, battle starts there. Dice 1 / 0 → Field Hospitals prompt (Marquise holds a mouse card) → **Decline** → the Cat warrior leaves 1. **Coffin Makers holds 1 warrior** (Cat supply unchanged). Eyrie Émigré stays in play. Daylight begins | **C8** | ☐ |

### Part 2 — Alliance Daylight

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 10 | Look at the tray | **league: move**, **propaganda bureau**, mobilize / end phase. No **league: battle** (no enemy shares a clearing with Alliance warriors) | | ☐ |
| 11 | **league: move** → item **Travel Gear** | Both ready items offered (Travel Gear, Root Tea). Origins 1 and 9 highlighted | **C3** | ☐ |
| 12 | Origin **1** → destination **4** → **1 warrior** | 1 = 2 Alliance, 4 = 1 Alliance. Travel Gear shows exhausted in Crafted Items. Both league buttons gone for the turn | **C3** | ☐ |
| 13 | **propaganda bureau** | Only clearing **6** highlighted. Not **2** (Keep: the Alliance cannot place there, though it holds a rabbit card). Not **5** (no fox or bird card in hand) | **C1** **C1a** | ☐ |
| 14 | Clearing **6** → **Marquise** → spend **Mouse-in-a-sack** | Card pick: Mouse-in-a-sack and Sword enabled, A Visit To Friends dimmed. Field Hospitals prompt → **Decline**. 6 = 1 Cat + 1 Alliance warrior. Card → Discarded pile (6 cards). Alliance supply −1. **Coffin Makers still holds 1**. Button gone for the turn | **C1** **C1b** **C1c** | ☐ |
| 15 | **End phase** → Evening | | | ☐ |

### Part 3 — Alliance Evening

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 16 | **charm offensive** → **Marquise** | Alliance draws 1 card (hand 3); Marquise **+1 VP**. Button gone | **C5** | ☐ |
| 17 | Nothing to click: the UI goes on to the draw step | Tray offers **draw** and **informants**, and no **end phase**: the draw does not happen by itself and cannot be skipped | **C6** | ☐ |
| 18 | **informants** → pick **Ambush! (fox)** from the shown pile | Only ambush cards are shown. Ambush → Alliance hand (4 cards); no card drawn from the deck; Discarded pile 5 cards | **C6** | ☐ |
| 19 | **End phase** | Turn passes → Marquise. Eyrie Émigré still in the Alliance play area | | ☐ |

---

## Coverage matrix

| Case | Steps | ☐ |
|------|-------|---|
| C1 | 13–14 | ☐ |
| C1a | 13 | ☐ |
| C1b / C1c | 14 | ☐ |
| C2 | 2–3 | ☐ |
| C3 | 11–12 | ☐ |
| C4 / C4a | 4–5 | ☐ |
| C5 | 16 | ☐ |
| C6 | 17–18 | ☐ |
| C7 | 6–7 | ☐ |
| C8 / C8a | 8–9 | ☐ |

**Do not:** give Mouse-in-a-sack away in step 5 (step 14 spends it); send the Cat warriors to 9 or 4 in step 7 (changes the Émigré battle and the League move); move fewer than 3 warriors in step 9 (Alliance may then lose the battle count); start a League battle.

**Not covered (unit tests instead):** League **battle** (one League use per Daylight); Eyrie Émigré discarded when the move ends in a clearing with no enemy; Propaganda Bureau with no warrior left in supply; Swap Meet giving the taken card back; Lizard Cult Convert and Coffin Makers.

---

## Fail notes

| Step | Symptom | Likely cause |
|------|---------|--------------|
| 1 | A card button is missing | `grants` returns no `params.options`, or no flow entry for that action |
| 4 | Asked for the card to give before Sword arrives | Swap Meet rule fix (C4) missing |
| 8 | Birdsong ends without a prompt, card discarded | Eyrie Émigré forced move (C8) missing |
| 9 | No Field Hospitals prompt | Step 5 gave a non-mouse card to the Marquise |
| 13 | Clearing 2 highlighted | Replace completability (C1a) missing |
| 14 | No Field Hospitals prompt | Propaganda Bureau does not use the shared remove (C1b) |
| 14 | Coffin Makers holds 2 | Replaced warrior counted as a plain removal (C1c) |
| 17 | Card drawn automatically | Informants does not block the auto draw |
