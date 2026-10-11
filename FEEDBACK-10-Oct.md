# Feedback — playtest 10 Oct 2026

- Repro source: `logs/10-10-2026-22h03m/` (`game.md` + `game.json`, gitignored, local only). Latest game, 22:03 → 23:31.
- Order below = suggested implementation order. One item = one commit.
- `❓` = open question, answer before implementing that item.

## 0. Repro tooling (do first)

- [ ] **T1 — Replay from a saved game log.** Load a mocked / logged game state and replay the game, to check whether a reported problem still persists. Needed to reproduce B2.

## 1. Bugs (seen in the latest game, turn 13)

- [ ] **B1 — Show the item supply more explicitly**, so an exhausted item is obvious.
  - Context: turn 13, Root Tea could not be crafted after buying from Riverfolk. Rule checked, behaviour is correct (supply empty); only the UI is missing.
- [ ] **B2 — Eyrie UI does not show the skip ambush button.** Turn 13.

## 2. Unsupported cards

- [ ] **C1 — Propaganda Bureau.** Card is spent but the action has no effect. Support the action.
- [ ] **C2 — Saboteurs.** Support the card action.
- [ ] **C3 — League of Adventurous Mice.** Not supported. Support it.

## 3. Game rules / flow

- [ ] **F1 — Do not auto-resolve craft when there is only 1 viable option.** Always let the player choose.
- [ ] **F2 — Undo.** Add undo; clear the undo history after any non-deterministic step.
- [ ] **F3 — Players choose which faction they want.**
- [ ] **F4 — Merge "start game" and "join game" into one flow.**
- [ ] **F5 — End game is too accessible.** ❓ Hide it, or add a confirmation? Only available for game host and add confirmation modal

## 4. In-game UI

- [ ] **U1 — Game log visible to the player in the frontend.**
- [ ] **U2 — Show how many cards are in hand.** ❓ Own hand, opponents' hands, or both? Both
- [ ] **U3 — Reduce verbosity of the action banner.**
- [ ] **U4 — Remove the number in the middle of a building.** A clearing holds at most 2 buildings, the count is not needed.
- [ ] **U5 — Pointy finger in clearing.** Pointer cursor ONLY when hovering a clickable clearing
- [ ] **U6 — Theme the cursor to the game.** Do together with U5.

## 5. Performance

- [ ] **P1 — Initial loading takes more than 10s.** Measure first, then cut.
- [ ] **P2 — Preload assets for the potential next game states.**
- [ ] **P3 — Mobile build: preload assets at compile time.** ❓ Bundle assets into the native build, or preload in mobile web?

## 6. Backend

- [ ] **K1 — Log game end in the backend.**
