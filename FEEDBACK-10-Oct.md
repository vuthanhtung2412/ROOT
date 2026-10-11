# Feedback — playtest 10 Oct 2026

- Repro source: `logs/10-10-2026-22h03m/` (`game.md` + `game.json`, gitignored, local only).
- Order below = suggested implementation order.

## 0. Repro tooling (do first)

- [ ] **T1 — Replay from a saved game log.** Load a mocked / logged game state and replay the game, to check whether a reported problem still persists. Needed to reproduce B2.

## 1. Bugs (latest game, turn 13)

- [ ] **B1 — Show the item supply more explicitly**, so an exhausted item is obvious.
  - Context: Root Tea could not be crafted after buying from Riverfolk. Rule checked, behaviour is correct; only the UI is missing.
- [ ] **B2 — Eyrie UI does not show the skip ambush button.**

## 2. Unsupported cards

Audit of all 18 persistent / partisan cards (`lib/src/effects/register.ts`):

- Rules engine (`lib`) registers every card.
- Passive cards work with no UI: Boat Builders, Coffin Makers, Corvid Planners, Master Engravers, Murine Broker, Soup Kitchens, Tunnels, Fox / Mouse / Rabbit Partisans.
- The 8 cards below have a player action that the React frontend never wires. The card is crafted (spent) and then cannot be used. Latest game log confirms: Saboteurs and Propaganda Bureau crafted, never activated.

Shared approach (same as Lizard Cult / Riverfolk actions):

- `lib`: each card's `grants` lists every complete legal payload in `params.options`, and returns one spec per action (Swap Meet and Charm Offensive currently return one duplicate spec per other player).
- Frontend: one entry per action in `TURN_ACTION_FLOWS` (`frontend/react/src/game/resolution/optionActionFlows.ts`), plus a tray label (`ActionTray.ts`) and icon (`actionIcons.ts`).
- Unit tests: every `lib` change and every frontend flow.

Per card, in this order:

1. **Rule first.** Compare `lib` with the card text and Law of Root. Any mismatch: fix the code to the rule, in its own commit, before any UI work.
2. Wire the action in the frontend.
3. **Every pick is asked**, even when a step has a single possible value (no auto-pick), for all 8 cards.

After all cards: **one video for all of them**, `card-fe-support.qa`, recorded by replaying `resources/notes/QA-plan-card-fe-support.md` (C10).

Cards:

- [ ] **C1 — Propaganda Bureau** (`propagandaBureau`, Daylight, once). Tray button → clearing → enemy (one banner button per faction) → hand card to spend.
  - Card text: "Once in Daylight, you may spend a card to replace an enemy warrior in a matching clearing with a warrior of your faction."
  - Needs a label lookup: warrior piece id → owner faction name.
  - Rule, checked online: replace = remove then place (Law of Root G.1.21; Root Database glossary). Ruling: a replaced warrior triggers Field Hospitals, and does not go to Coffin Makers (Convert, Propaganda Bureau).
  - Rule mismatches in `lib`, fix first:
    - [ ] **C1.1 — Replace must be completable.** No clearing offered where the owner cannot place (e.g. the Keep); card not offered when the owner's warrior supply is empty. Today the card is spent and the enemy warrior removed before the action fails.
    - [ ] **C1.2 — Replace is a real remove.** Propaganda Bureau returns the warrior to supply by itself, so Field Hospitals is never offered. Use the shared remove.
    - [ ] **C1.3 — Coffin Makers skips replaced warriors.** Today it collects them, for Propaganda Bureau and for Lizard Cult Convert. One fix for both, since both go through the shared remove after C1.2.
  - [ ] **C1.4 — `lib` lists legal payloads**, then frontend flow, tray label, icon.
- [ ] **C2 — Saboteurs** (`saboteurs`, Birdsong). Pick enemy → pick one of their crafted cards to discard.
- [ ] **C3 — League of Adventurous Mice** (`leagueMove`, `leagueBattle`, Daylight, once). Pick crafted item to exhaust → move (origin → destination → count) or battle (clearing → defender).
  - Needs a label lookup: crafted item index → item name. Offer one index per item type.
- [ ] **C4 — Swap Meet** (`swapMeet`, Birdsong, once). Pick another player → pick hand card to give.
  - Rule mismatch: card says take a random card, *then* give a card (the taken card may be given back). `lib` asks for the given card before the taken card is known. Take first, then ask which card to give.
- [ ] **C5 — Charm Offensive** (`charmOffensive`, Evening, once). Pick another player to score 1 point.
- [ ] **C6 — Informants** (`informantsTakeAmbush`, Evening draw step). Pick an ambush card from the Discarded pile instead of drawing.
- [ ] **C7 — False Orders** (`falseOrders`, Birdsong). Pick enemy → origin clearing with their warriors → adjacent destination.
- [ ] **C8 — Eyrie Émigré** (`eyrieEmigre`, Birdsong). Pick origin → destination → count → defender.
  - Rule mismatch: card says the move is mandatory at end of Birdsong, then a battle in the destination, discard if both were not taken. `lib` only offers moves into a clearing that already holds an enemy, and lets the player skip the move. Force the move when any move is legal; battle if the destination holds an enemy; otherwise discard the card.
- [ ] **C9 — Update `resources/notes/frontend-vs-registered-actions.md`.** Remove these actions from "not wired in React composers yet".
- [ ] **C10 — QA run + video.** Snapshot builder and replay script for `resources/notes/QA-plan-card-fe-support.md`; record `tmp/artifacts/card-fe-support-qa/card-fe-support.qa.mp4`.

## 3. Game rules / flow

- [ ] **F1 — Do not auto-resolve craft when there is only 1 viable option.** Always let the player choose.
- [ ] **F2 — Undo.** Add undo; clear the undo history after any non-deterministic step.
- [ ] **F3 — Players choose which faction they want.**
- [ ] **F4 — Merge "start game" and "join game" into one flow.**
- [ ] **F5 — End game is too accessible.** Only the game host can end the game, behind a confirmation modal.

## 4. In-game UI

- [ ] **U1 — Game log visible to the player in the frontend.**
- [ ] **U2 — Show how many cards are in hand**, for the player's own hand and every opponent's hand.
- [ ] **U3 — Reduce verbosity of the action banner.**
- [ ] **U4 — Remove the number in the middle of a building.** A clearing holds at most 3 buildings so duplicate icon is still fine.
- [ ] **U5 — Pointy finger in clearing.** Pointer cursor only when hovering a clickable clearing.
- [ ] **U6 — Theme the cursor to the game.** Do together with U5.

## 5. Performance

- [ ] **P1 — Initial loading takes more than 10s.** Measure first, then cut.
- [ ] **P2 — Preload assets for the potential next game states.**
- [ ] **P3 — Mobile build: preload assets at compile time.** Native build only; mobile web is unchanged.

## 6. Backend

- [ ] **K1 — Log game end in the backend.**
