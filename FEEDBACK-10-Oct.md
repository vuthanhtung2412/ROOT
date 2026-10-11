# Feedback — playtest 10 Oct 2026

- Repro source: `logs/10-10-2026-22h03m/` (`game.md` + `game.json`, gitignored, local only).
- Order below = suggested implementation order.

## 0. Repro tooling (do first)

- [x] **T1 — Replay from a saved game log.** `pnpm --filter @root/lib replay:log <game.json> [seq]`, then `pnpm --filter @root/cli start -- load <printed path>`. Replay the event list of a `game.json` up to a chosen event, to check whether a reported problem still persists. Dice must come out the same as in the logged game. Needed to reproduce B2.

## 1. Bugs (latest game, turn 13)

- [x] **B1 — Show the item supply more explicitly**, so an exhausted item is obvious. Add a supply button that works like the Discarded pile button.
  - Context: Root Tea could not be crafted after buying from Riverfolk. Rule checked, behaviour is correct; only the UI is missing.
- [x] **B2 — Eyrie UI does not show the skip ambush button.** It should be below the banner at the top; in that game it was not shown.
  - Cause: a click on the map while the prompt was up wiped it (same for Field Hospitals and battle removal). Reproduced from event 156 of the log.

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

- [x] **C1 — Propaganda Bureau** (`propagandaBureau`, Daylight, once). Tray button → clearing → enemy (one banner button per faction) → hand card to spend.
  - Card text: "Once in Daylight, you may spend a card to replace an enemy warrior in a matching clearing with a warrior of your faction."
  - Needs a label lookup: warrior piece id → owner faction name.
  - Rule, checked online: replace = remove then place (Law of Root G.1.21; Root Database glossary). Ruling: a replaced warrior triggers Field Hospitals, and does not go to Coffin Makers (Convert, Propaganda Bureau).
  - Rule mismatches in `lib`, fix first:
    - [x] **C1.1 — Replace must be completable.** No clearing offered where the owner cannot place (e.g. the Keep); card not offered when the owner's warrior supply is empty. Today the card is spent and the enemy warrior removed before the action fails.
    - [x] **C1.2 — Replace is a real remove.** Propaganda Bureau returns the warrior to supply by itself, so Field Hospitals is never offered. Use the shared remove.
    - [x] **C1.3 — Coffin Makers skips replaced warriors.** Today it collects them, for Propaganda Bureau and for Lizard Cult Convert. One fix for both, since both go through the shared remove after C1.2.
  - [x] **C1.4 — `lib` lists legal payloads**, then frontend flow, tray label, icon.
  - [x] **C1.5 — "Once in Daylight" survives the craft → actions step.** The turn scratch was rebuilt there, so the card (and League of Adventurous Mice) could be used twice.
- [x] **C2 — Saboteurs** (`saboteurs`, Birdsong). Pick enemy → pick one of their crafted cards to discard.
  - [x] **C2.1 — Rule fix: "At the start of Birdsong".** `lib` allowed it at any point of Birdsong. Now only before the owner takes another action in that phase (answers to pending events do not count).
  - [x] **C2.2 — `lib` lists legal payloads**, then frontend flow, tray label, icon.
- [x] **C3 — League of Adventurous Mice** (`leagueMove`, `leagueBattle`, Daylight, once). Pick crafted item to exhaust → move (origin → destination → count) or battle (clearing → defender).
  - Needs a label lookup: crafted item index → item name. Offer one index per item type.
  - [x] **C3.1 — Rule fix: an illegal move or battle must not cost the item.** `lib` exhausted the item and marked the card used before checking the move; a battle target was not checked at all. The whole payload is now checked first.
  - [x] **C3.2 — `lib` lists legal payloads**, then frontend flows (move, battle), tray labels, icons.
- [x] **C4 — Swap Meet** (`swapMeet`, Birdsong, once). Pick another player → pick hand card to give.
  - Rule mismatch: card says take a random card, *then* give a card (the taken card may be given back). `lib` asks for the given card before the taken card is known. Take first, then ask which card to give.
  - [x] **C4.1 — Rule fix.** `swapMeet` takes the random card and opens a pending `swapMeetGive` event; any hand card can be given, the taken one included. Works with an empty hand.
  - [x] **C4.2 — Frontend:** tray button → pick player; then a forced "pick a card to give" prompt.
- [x] **C5 — Charm Offensive** (`charmOffensive`, Evening, once). Pick another player to score 1 point.
  - [x] **C5.1 — Rule fix: "At start of Evening".** `lib` allowed it at any point of Evening, also after the draw. Now the Evening draw waits while the card can be used; drawing (or any other Evening action) ends the offer; using the card lets the draw go on by itself.
  - [x] **C5.2 — `lib` lists legal payloads**, then frontend flow, tray label, icon.
- [x] **C6 — Informants** (`informantsTakeAmbush`, Evening draw step). Pick an ambush card from the Discarded pile instead of drawing.
  - Rule check: the Evening draw already waits while an ambush card is in the Discarded pile; taking it replaces the whole draw.
  - [x] **C6.1 — Rule fix: "you may instead".** Found by the QA dry-run: for every faction but the Marquise the held draw was not offered as an action, so the owner could only take the ambush card or skip the draw. A step a card holds back is now offered by hand (also the draw behind Charm Offensive).
- [x] **C7 — False Orders** (`falseOrders`, Birdsong). Pick enemy → origin clearing with their warriors → adjacent destination.
  - [x] **C7.1 — Rule fix: Use of Force (1.5.5).** The forced move is resolved as if the enemy chose it: `lib` only allowed paths, so an enemy with Boat Builders could not be sent along a river. A move the enemy cannot make no longer discards the card.
  - [x] **C7.2 — `lib` lists legal payloads**, then frontend flow, tray label, icon.
- [x] **C8 — Eyrie Émigré** (`eyrieEmigre`, Birdsong). Pick origin → destination → count → defender.
  - Rule mismatch: card says the move is mandatory at end of Birdsong, then a battle in the destination, discard if both were not taken. `lib` only offers moves into a clearing that already holds an enemy, and lets the player skip the move. Force the move when any move is legal; battle if the destination holds an enemy; otherwise discard the card.
  - [x] **C8.1 — Rule fix.** The card is no longer usable during Birdsong. Ending Birdsong holds the phase and leaves the forced move as the only action; a destination with an enemy comes with its battle, one without discards the card; then only "end phase" is left. No possible move → Birdsong ends and the card is discarded. The CLI auto player now plays any action that lists its payloads, so it is not stuck on the forced move.
  - [x] **C8.2 — Frontend:** the forced move opens by itself when Birdsong ends: origin → destination → count → defender.
- [x] **C9 — Update `resources/notes/frontend-vs-registered-actions.md`.** Remove these actions from "not wired in React composers yet".
- [x] **C10 — QA run + video.** 9 of 9 UI steps pass; video is 94 s. The run also found C6.1 and that a held draw could be skipped with "end phase" (fixed: the phase cannot end before a held step).
  - Snapshot builder and replay script for `resources/notes/QA-plan-card-fe-support.md`; record `tmp/artifacts/card-fe-support-qa/card-fe-support.qa.mp4`.

## 3. Game rules / flow

- [x] **F1 — Do not auto-resolve craft when there is only 1 viable option.** Always let the player choose.
  - Only the Riverfolk craft did it (one craftable card was picked, and "Craft" chosen, without a click). Marquise, Eyrie, Lizard Cult and Vagabond craft already asked for the card.
- [x] **F2 — Undo.** Only the player whose turn it is can undo. The undo history is cleared after a battle and when the player ends their turn.
  - **Undo** button next to "End game", shown only while something can be taken back. Works online (server checks the seat) and in hotseat.
  - Also cleared when another player answers a prompt (their choice is not the turn player's to rewind).
  - Also cleared when an action reveals hidden information: dice rolled, a draw from the deck, a card taken from another player (Swap Meet). Such an action cannot be taken back.
  - A phase the UI ends by itself (only "end phase" on offer) is not a decision: Undo goes back to the last real choice.
  - Limit: undo replays the game from its seed, so it does not work on a QA snapshot whose state was edited by hand.
- [x] **F3 + F4 — One start flow, players choose their faction.**
  - Done: an "open lobby" (game created with no factions). The first player to pick a faction takes seat 1 and hosts. A pick can be changed until the game starts. Up to 4 players; the host starts with 2 or more.
  - The button reads **Join game** whenever a live online game is on the server (lobby, or a game in progress to rejoin), else **Create game**.
  - Hotseat (all seats on one device) and the QA shortcut stay below the button in dev builds only, as before.
  - Start screen has a single button: **Create** when no game is in the lobby state, **Join** when one is.
  - One player creates the game; for every other player the button becomes **Join**.
  - No faction set is chosen in advance. After joining, each player picks a faction; a faction already taken cannot be picked.
  - Assumed, not confirmed: all 6 factions can be picked; the creator starts the game once at least 2 players have picked; hotseat stays, with the creator picking every faction.
- [x] **F5 — End game is too accessible.** Only the game host can end the game, behind a confirmation modal.
  - A guest sees **Leave game** instead (same modal): only that browser goes back to the menu, and "Join game" returns it to its seat.
  - Checked with `.agents/skills/QA/replay-online-two-players.mjs` (updated to the new lobby): 11 of 11 steps pass.

## 4. In-game UI

- [x] **U1 — Game log visible to the player in the frontend.** Full log, actions only, no game state.
  - **Log** button in the drawer opens a panel beside the map (the map stays visible for the clearing highlight). One heading per turn; "end phase" is left out.
  - A card of another player the viewer may not see reads "a card".
  - Server log: `CRAFT Root Tea [mouse] item:tea +2vp (ROOT-222#1)`.
  - An action that concerns a card shows the card name not ID show card name (card ID) in server log too.
  - An action that concerns a clearing shows it as a "clearing highlight" component: clicking e.g. "C7" highlights clearing 7 on the map.
- [x] **U2 — Show how many cards are in hand**, for the player's own hand and every opponent's hand.
  - Card-back badge on the top right of every seat of the player rail.
  - Online, the server sent opponents' hands as empty, so their size was hidden too. It now sends face-down cards: the size is open, the cards are not.
- [ ] **U3 — Reduce verbosity of the action banner.** Deferred.
- [x] **U4 — Remove the number in the middle of a building.** One icon per building, no count badge: a clearing holds at most 3 buildings, so repeated icons are fine.
- [x] **U5 — Pointy finger in clearing.** Pointer cursor only when hovering a clickable clearing.
- [x] **U6 — Theme the cursor to the game.** Create the cursor art that fits the game best. Do together with U5.
  - Asset: `frontend/react/public/assets/cursors/clearing-point.png` (parchment hand, gold tip). Utility `cursor-clearing-point` in `style.css`.

## 5. Performance

- [x] **P1 — Initial loading takes more than 10s.** Measure on the prod build first, then cut.
  - Prod measure: JS ~547 KiB; blocking boot was 58 images / 7.44 MiB (~12.8 s @ 5 Mbps).
  - Cut: menu boot = banner + wallpaper + faction heads only (~0.8 MiB / ~1.2 s); warm boards/tokens/map after menu; `enterGame` waits on warm. Autumn map → 2048w webp (3.3 MiB → 0.95 MiB).
- [ ] **P2 — Preload assets for the potential next game states.** Deferred.
- [x] **P3 — Mobile build: preload assets at compile time.** Native build only; mobile web is unchanged.
  - `build:ios` sets `ROOT_NATIVE_ASSET_PRELOAD=1`; Vite injects `<link rel="preload" as="image">` for menu+warm paths into `index.html`. Plain `pnpm build` (web) injects none.

## 6. Backend

- [x] **K1 — Log game end in the backend:** winner, VP of every player, number of turns, duration.
  - On `status === 'finished'`, console + `game.md` get a `GAME END` block (winner, VP per seat, turns, duration from START). Once per log folder.
