# QA plan — Lizard Cult + Riverfolk Company (one run)

**One snapshot. One continuous play sequence.** Each step lists **Hits** (`L#` / `R#`).

| | |
|---|---|
| Snapshot | `tmp/qa/snapshots/lizard-riverfolk-qa-run.json` |
| Regen | `cd lib && pnpm exec tsx ../.cursor/skills/QA/make-lizard-riverfolk-qa-run.ts` |
| Replay | `node .agents/skills/QA/replay-lizard-riverfolk-qa.mjs` — plays this plan in the UI, checks each step against `GET /game`, records `tmp/artifacts/lizard-riverfolk-qa/` |
| Rules | `resources/rules/Law_of_Root.md` (Law 10 Lizard Cult, Law 11 Riverfolk Company) |
| Dice | Fixed by the snapshot's rng seed (`BATTLE_DICE` in the regen script): the five battles of this plan always roll the same. Play the battles in plan order — an extra or skipped battle shifts every later roll. |

---

## Setup

1. Regen snapshot (optional).
2. `pnpm --filter @root/web dev` + `pnpm --filter @root/react dev`
3. `pnpm --filter @root/cli start -- load "$PWD/tmp/qa/snapshots/lizard-riverfolk-qa-run.json"` (absolute path — the CLI resolves from `frontend/cli/`)
4. React → **Continue loaded game** (not New Game)
5. After each step: board + `GET /game` / `/game/log`
6. Every **Field Hospitals** prompt the Marquise gets (steps 8, 16, 19, 37): **Decline**.
7. The UI ends a phase by itself when **End phase** is the only action: steps 1, 2 and 20 and the first **End phase** of steps 11 and 34 need no click.

**Where to look:** Cult board → **Lost Souls** frame (top card + suit tally, leading suit highlighted; click = whole pile) and the **Revealed** panel beside the board. Riverfolk board → count badge on the corner of Payments / Funds / Commitments.

**Seats:** `0` Marquise · `1` Riverfolk · `2` Lizard Cult (three players)

**Start:** Marquise Evening / `discard` — one **End phase** starts the Riverfolk turn for real.

### Board cheat-sheet

| Clearing | Suit | Pre-placed |
|----------|------|------------|
| **0** | fox | Cult garden + 3 Cult warriors — **crusade move from here** |
| **2** | rabbit | **Keep** + recruiter + 1 Cat warrior |
| **4** | rabbit, river | Cult garden + 2 Cult warriors + 3 Cat warriors — **Pilgrims**, trade post target |
| **5** | fox | Cat sawmill + 1 Cat warrior — **Sanctify**, later Fear of the Faithful |
| **6** | mouse, river | 2 Riverfolk + 1 Cat warrior — Riverfolk battle |
| **7** | fox | 2 Cult + 2 Cat + 2 Riverfolk warriors — Convert / Crusade with two enemies |
| **8** | mouse | 1 Cat warrior — crusade move destination |
| **9** | rabbit, river | empty — swim / riverboat destination (no path from 10) |
| **10** | mouse, river | Cat workshop + 3 Cat + 2 Riverfolk warriors |
| **11** | fox | Riverfolk **trade post** (no Riverfolk warrior) + 2 Cat warriors — Trade Disruption |

### Boards and hands

| | |
|---|---|
| Riverfolk | Payments empty · Funds 4 Cat + 2 Cult · Committed 3 own · all service costs 1 · supply 6 |
| Riverfolk hand | Anvil, A Visit To Friends, Birdy Bindle, Root Tea (mouse), Travel Gear (mouse), Protection Racket, Smuggler's Trail |
| Cult | Outcast **mouse** (not Hated) · 9 acolytes · gardens on map: fox 1, rabbit 1 |
| Cult hand | Bake Sale (rabbit), Mouse-in-a-sack (mouse), Root Tea (fox), Travel Gear (fox), Foxfolk Steel (fox) |
| Lost Souls | 3 fox + 1 mouse + bird Dominance |
| Marquise hand | 3 bird cards (no ambush) |

---

## Case index

| ID | Case |
|----|------|
| L1 | Adjust Outcast — most common Lost Souls suit becomes Outcast |
| L2 | Lost Souls discarded; Dominance card becomes available |
| L3 | Crusade battle in Outcast clearing — pick defender |
| L4 | Crusade move, then battle / skip battle |
| L5 | Convert — enemy warrior → Cult warrior |
| L6 | Sanctify — enemy building → garden |
| L7 | Ritual Build (reveal matching card, must rule) |
| L8 | Ritual Recruit |
| L9 | Ritual Score — card spent, once per suit |
| L10 | Ritual Sacrifice — bird cards only fuel Sacrifice |
| L11 | Evening — revealed cards return; only Outcast-suit gardens craft |
| L12 | Evening draw 1 + uncovered draw bonuses |
| L13 | Revenge — defending Cult warriors → Acolytes |
| L14 | Pilgrims — garden rules the clearing |
| L15 | Fear of the Faithful — garden removed → random card lost |
| L16 | Hated Outcast — conspiracies cost 1 fewer |
| R1 | Protectionism (empty Payments → 2 warriors; not when paid) |
| R2 | Score Dividends |
| R3 | Gather Funds (Payments + Committed + craft spaces) |
| R4 | Move with Swimmers + fund owner pick |
| R5 | Battle (commit fund) |
| R6 | Craft on empty Trade Posts spaces |
| R7 | Export |
| R8 | Draw (commit fund) |
| R9 | Recruit — river clearing, spent fund returns to owner |
| R10 | Establish Trade Post with garrison (2 funds of the ruler) |
| R11 | Evening discard + Set Costs |
| R12 | Service: Hand Card (public hand) |
| R13 | Service: Riverboats |
| R14 | Service: Mercenaries |
| R15 | Services per turn = 1 + trade post clearings with buyer pieces |
| R16 | Trade Disruption |
| S1 | Setup: Cult corner + Outcast suit |
| S2 | Setup: Riverfolk warriors on river + starting costs |

---

## Sequence

Play top → bottom. Do **not** reload between steps (unless Fail → regen).

### Part 1 — Riverfolk turn

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 1 | As Marquise: **End phase** | Riverfolk Birdsong. Payments gets 2 own warriors (supply 6 → 4); **+3 VP** (6 funds, post on 11); Funds = **11** (4 Cat, 2 Cult, 5 own); Payments + Committed empty | **R1** **R2** **R3** | ☐ |
| 2 | **End phase** → Daylight | Tray: move, battle, craft, draw, recruit, trade post | | ☐ |
| 3 | **recruit** → clearing **9** → **Marquise fund** | Only 3/4/6/9/10 highlighted; +1 Riverfolk warrior on 9; Cat supply 7 → 8; Funds 10 | **R9** | ☐ |
| 4 | **trade post** → clearing **4** | 11 not offered (has a post). Post + 1 Riverfolk warrior on 4; both Cult funds spent (Cult supply 7 → 9); **+2 VP**; rabbit track 3 → 2 | **R10** **L14** | ☐ |
| 5 | **craft** → Anvil → **Craft** | Item gained, **+2 VP**; one fund sits on the fox Trade Posts space; card → Lost Souls | **R6** | ☐ |
| 6 | **craft** → A Visit To Friends → **Export** | No item, no VP; 1 own warrior supply → Payments; fund on rabbit space; card → Lost Souls | **R7** | ☐ |
| 7 | **move** 10 → **9**, 2 warriors → **Marquise fund** | Legal by river (no path), neither clearing ruled by Riverfolk; fund → Committed | **R4** | ☐ |
| 8 | **battle** on clearing **6** vs Marquise | Fund → Committed (auto: only own funds left); dice 1 / 0 → the Cat warrior on 6 is removed, Riverfolk loses none | **R5** | ☐ |
| 9 | **draw** | +1 card (6 in hand); fund → Committed; Funds left = **3** | **R8** | ☐ |
| 10 | **End phase** → Evening | Must discard 1 (hand limit 5) → Lost Souls | **R11** | ☐ |
| 11 | **End phase** → **set costs** → Hand Card **Cost 1 (current)** → Riverboats **Cost 1 (current)** → Mercenaries **Cost 2** | One action asks all three services; Mercenaries marker moves, other two stay 1 | **R11** | ☐ |
| 12 | **End phase** | Turn passes → **Cult** Birdsong, service prompt first | | ☐ |

### Part 2 — Cult Birdsong (conspiracies)

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 13 | **buy service** → Hand Card → Birdy Bindle from the shown Riverfolk hand | Card → Cult hand; 1 Cult warrior → Payments; prompt **stays open** (2 services: post on 4 holds Cult pieces) | **R12** **R15** | ☐ |
| 14 | Before answering, open the Cult board: Lost Souls tally shows **fox** highlighted (4 fox). Then **no service** | Outcast adjusts automatically: marker → **fox**, Outcast side; Lost Souls emptied (printed art shows, tally all 0); bird Dominance available | **L1** **L2** | ☐ |
| 15 | **convert** → clearing **7** → Riverfolk | Only fox clearings offered. 7 = 3 Cult / 1 Riverfolk / 2 Cat; acolytes 9 → 7 | **L5** | ☐ |
| 16 | **crusade: battle** → clearing **7** → pick **Marquise** | Must choose Cat or Riverfolk; acolytes 7 → 5; dice 1 / 0 → Cat removes 1 warrior, Cult loses none (7 = 3 Cult / 1 Riverfolk / 1 Cat) | **L3** | ☐ |
| 17 | **sanctify** → clearing **5** | Sawmill gone, garden placed; **+1 VP**; acolytes 5 → 2; fox gardens on map = 2 | **L6** | ☐ |
| 18 | **crusade: move** 0 → **8**, 2 warriors | Acolytes 2 → 0; tray now only **crusade: battle** / **skip battle** | **L4** | ☐ |
| 19 | **crusade: battle** on 8 (do **not** skip — the dice order depends on it) | No extra acolyte cost; dice 1 / 0 → Cat warrior removed, 8 = 2 Cult | **L4** | ☐ |
| 20 | **End phase** → Daylight | | | ☐ |

### Part 3 — Cult Daylight + Evening

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 21 | **build garden** → Bake Sale → clearing **4** | Allowed though Cat has 3 warriors vs 2 (Pilgrims); 2nd rabbit garden; card shows in the **Revealed** side panel | **L7** **L14** | ☐ |
| 22 | **recruit** → Mouse-in-a-sack → clearing **8** | Only mouse clearings offered; +1 Cult warrior (8 = 3 Cult); 2 cards in the Revealed panel | **L8** | ☐ |
| 23 | **score** → Root Tea (fox) | **+2 VP** (2 fox gardens on map); card → Lost Souls (not revealed) | **L9** | ☐ |
| 24 | Open **score** again | Travel Gear (fox) not offered — fox already scored | **L9** | ☐ |
| 25 | **sacrifice** → Birdy Bindle | Acolytes +1; bird never offered for build / recruit / score | **L10** | ☐ |
| 26 | **End phase** → Evening | Revealed panel empties; the 3 cards are back in hand | **L11** | ☐ |
| 27 | **craft** → Foxfolk Steel | Crafted with the 2 fox gardens, **+2 VP**; Travel Gear (cost rabbit) **not** craftable despite 2 rabbit gardens | **L11** | ☐ |
| 28 | **End phase** → draw | Draws **3** (1 + rabbit bonus + fox bonus) | **L12** | ☐ |
| 29 | Discard to 5: **Travel Gear (fox)** + **Birdy Bindle** | Cards → Lost Souls (keeps fox in the lead for step 43) | | ☐ |
| 30 | **End phase** | Turn passes → **Marquise**, service prompt first | | ☐ |

### Part 4 — Marquise (services + Cult / Riverfolk reactions)

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 31 | **buy service** → Hand Card → any card | Card taken; 1 Cat warrior → Payments | **R12** | ☐ |
| 32 | **buy service** → Riverboats | 1 Cat warrior → Payments | **R13** | ☐ |
| 33 | **buy service** → Mercenaries | **2** Cat warriors → Payments (new cost); prompt closes after 3 (posts on 4 and 11 hold Cat pieces) | **R14** **R15** **R11** | ☐ |
| 34 | Birdsong → **End phase** twice (skip craft) to Daylight actions | No wood (sawmill sanctified) | | ☐ |
| 35 | **March** 10 → **9**, 1 warrior | Legal by river only | **R13** | ☐ |
| 36 | **Battle** on **11** vs Riverfolk | Dice 0 / 0, post still removed (defenseless extra hit), Cat +1 VP; Riverfolk Funds 3 → **1**, 2 warriors back to supply; fox track stays 2 (post out of the game) | **R16** | ☐ |
| 37 | **Battle** on **4** vs Cult | Dice 2 / 2. Both Cult warriors removed → **Acolytes 1 → 3**, Cult supply unchanged (Revenge). Cat takes 2 hits: 1 own warrior + the Riverfolk warrior on 4 (mercenary split). 4 = 2 Cat / 2 gardens / post | **L13** **R14** | ☐ |
| 38 | **spend bird** (any bird card) → **Battle** on **5** vs Cult | Garden removed (defenseless) → back on fox track (2 → 1 on map); Cult loses 1 random card → Lost Souls (hand 5 → 4); Cat +1 VP | **L15** | ☐ |
| 39 | Finish Cat turn | Turn passes → **Riverfolk** Birdsong | | ☐ |

### Part 5 — Second round (negative Protectionism + Hated)

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 40 | Riverfolk Birdsong | **No** Protectionism (Payments held 1 own + 1 Cult + 4 Cat); 0 VP (1 fund); Funds = **12** (1 + 6 Payments + 3 Committed + 2 craft spaces) | **R1** **R2** **R3** | ☐ |
| 41 | **End phase** through to Cult | Discard nothing | | ☐ |
| 42 | Cult board first: Lost Souls tally highlights **fox** (3 fox). Then **no service** | Fox leads and is already Outcast → marker flips to **Hated** | **L16** | ☐ |
| 43 | **convert** any offered warrior | Acolytes **3 → 2** — cost 1, not 2 (Hated discount) | **L16** | ☐ |

### Part 0 — Setup smoke (separate **New Game**, any time)

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| A | Menu: Marquise + Riverfolk + Lizard Cult → start; keep on a corner, 3 buildings | | | ☐ |
| B | Cult: choose starting corner | Only the corner opposite the keep highlighted; 4 warriors + garden there, 1 warrior in each adjacent clearing | **S1** | ☐ |
| C | Cult: choose Outcast suit | Marker on that suit, Outcast side | **S1** | ☐ |
| D | Riverfolk: place 4 warriors | Only river clearings (3/4/6/9/10), never the keep clearing; Payments starts with 3 | **S2** | ☐ |
| E | Riverfolk: starting cost ×3 (Hand Card, Riverboats, Mercenaries) | Cost 1–4 each; Marquise then gets the service prompt | **S2** | ☐ |

---

## Coverage matrix

| Case | Steps | ☐ |
|------|-------|---|
| L1 / L2 | 14 | ☐ |
| L3 | 16 | ☐ |
| L4 | 18–19 | ☐ |
| L5 | 15 | ☐ |
| L6 | 17 | ☐ |
| L7 | 21 | ☐ |
| L8 | 22 | ☐ |
| L9 | 23–24 | ☐ |
| L10 | 25 | ☐ |
| L11 | 26–27 | ☐ |
| L12 | 28 | ☐ |
| L13 | 37 | ☐ |
| L14 | 4, 21 | ☐ |
| L15 | 38 | ☐ |
| L16 | 42–43 | ☐ |
| R1 | 1, 40 | ☐ |
| R2 | 1, 40 | ☐ |
| R3 | 1, 40 | ☐ |
| R4 | 7 | ☐ |
| R5 | 8 | ☐ |
| R6 | 5 | ☐ |
| R7 | 6 | ☐ |
| R8 | 9 | ☐ |
| R9 | 3 | ☐ |
| R10 | 4 | ☐ |
| R11 | 10–11, 33 | ☐ |
| R12 | 13, 31 | ☐ |
| R13 | 32, 35 | ☐ |
| R14 | 33, 37 | ☐ |
| R15 | 13, 33 | ☐ |
| R16 | 36 | ☐ |
| S1 / S2 | A–E | ☐ |

**No luck needed:** dice are fixed by the snapshot seed. Unit tests cover the same rules without dice: Revenge and Fear of the Faithful (`lib/src/factions/Lizard.test.ts`), mercenary hit split (`lib/src/events/buyServices.test.ts`), Trade Disruption (`lib/src/factions/Riverfolk.test.ts`).

**Do not:** start any battle that is not in the plan, or skip one (shifts the dice); let the Riverfolk battle on 7 or move onto 11 (breaks Convert targets / defenseless post); score a rabbit card as Cult or discard non-fox cards in step 29 (breaks Hated in step 42).

**Not covered:** Vagabond paying for services with items (no Vagabond seat); Riverfolk public hand in online mode (hotseat run).

---

## Fail notes

| Step | Symptom | Likely cause |
|------|---------|--------------|
| 1 | VP not +3 / Funds not 11 | Wrong snapshot, or Dividends scored after Gather |
| 4 | Clearing 4 not offered | Pilgrims not applied (Cat counted as ruler) |
| 6 | No Export choice | No free rabbit space — step 4 skipped |
| 7 | 9 not offered | Swimmers not applied |
| 13 | Prompt closes after 1 purchase | Trade post on 4 missing (step 4) |
| 14 | Outcast stays mouse / Hated | Lost Souls tally wrong (birds counted?) |
| 23 | Score gives 0 | Sanctify (step 17) skipped — only 1 fox garden |
| 28 | Draws < 3 | Step 17 or 21 skipped |
| 33 | Prompt closes early | Cat supply short, or post on 11 already gone |
| 36 | Post survives | Riverfolk warrior on 11 |
| 37 | Dice not 2 / 2 | A battle was added or skipped earlier, or the snapshot was not regenerated |
| 42 | Not Hated | Non-fox cards reached Lost Souls (steps 23, 29, 38 random card) |
