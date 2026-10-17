## Bots: Mechanical Marquise 2.0 and Electric Eyrie

### Goal
- Play against the two Rootbotics bots (`resources/rules/Law_of_Rootbotics.md` ch. 1–5, Electric Eyrie errata board).
- A bot seat needs no human: it is seated by the engine, takes its whole turn on its own and answers its own prompts (battle hits, outrage…).
- Humans see the bot's pieces with the cat / bird art, its order card, Buildings tracks / Decree and Roosts track.

### Approach
1. New faction ids `mechanicalMarquise` and `electricEyrie`, own boards (`kind` = faction id) and own `Faction` classes. `baseFactionOf()` maps a bot to the art faction (`marquise` / `eyrie`). Lords of the Forest (5.2.1) and the keep (4.2.1) reuse the human rules.
2. Priority markers (2.1): Fall clearing id + 1 = printed clearing number = priority. Player target priority (2.2): setup order A…F.
3. Engine drives bots: a bot's steps are all automatic (`autoActions`), one unit of work per auto action (one battle, one move…), so a battle opened by a bot waits for the human's answers and the turn resumes after. A bot ends its steps with an automatic `endPhase`. Pending prompts whose actor is a bot are answered by a bot policy (decline ambush, no effects, removal per 1.2.1).
4. Bots join by themselves: at create and after each join, bot seats are seated with player id `bot-<faction>`.
5. Rule changes (ch. 1–2): bot crafts without pieces for 1 VP, never persistent cards (1.1); takes hits tokens → buildings, random building type (1.2.1); no hand: a card given to a bot is discarded for +1 VP, a card taken from a bot is drawn instead (2.8.1); no ambush against bots (2.8.2); bots draw no starting hand, dominance out with ≤ 2 humans (3.4); bots never buy Riverfolk services.
6. Backend: faction enum, AI-player faction tables, OpenAPI + client regen (`pnpm gen:api-client`).
7. React: bots in the hotseat menu (local party skips joining bot seats), art and colours via `baseFactionOf`, a bot board panel (order card, tracks / Decree columns / Roosts, crafted items) in Tailwind.

### Risks
- Expand (4.5.5) loops while no building is placed; with no open slot anywhere it never ends. House rule: at most `MAXIMUM_EXPAND_COUNT` expands per turn (documented in code).
- "Adjacent clearings with the most enemy pieces" (4.7.4) read as one destination per origin, like 4.5.4.
- Mechanical Marquise track VP: +0 … +5 on every track, read from the bot board art (Root Database).
- Decree columns left → right read fox, mouse, rabbit, bird from the errata board.
- Traits / difficulty (3.3) not in scope: default difficulty, no traits.

### Test plan
- lib unit tests (fixture factory) per rule bullet: setup, order card craft, Marquise battle/recruit/build/move/expand/escalated/score, Eyrie recruit/move/battle/build/turmoil/new roost/score, hits removal, poor manual dexterity, hates surprises.
- lib: seeded random games with each bot vs humans run to 30 VP / turn cap with no error.
- backend: create game with bot factions, bot seats auto-joined, bot turn resolved after human endPhase.
- React: menu party with a bot, bot board view model tests.
- Manual: hotseat Marquise (human) vs Electric Eyrie (bot) and Eyrie (human) vs Mechanical Marquise (bot) in the browser through chrome-devtools.

### Commit plan
- [x] `docs(plan): Rootbotics Marquise and Eyrie bots`
  - `PLAN.md`
- [x] `feat(lib): bot faction ids, boards and target priority`
  - `lib/src/pieces/types.ts`, `lib/src/state/boards.ts`, `lib/src/state/botBoards.ts` (new)
  - `lib/src/factions/bots/botFactions.ts` (new), `lib/src/factions/bots/priority.ts` (new) + tests
  - exhaustive switches over faction / board kind
- [x] `feat(lib): bot setup and auto-seated bots`
  - `lib/src/factions/bots/mechanicalMarquise/setup.ts`, `lib/src/factions/bots/electricEyrie/setup.ts` (new) + tests
  - `lib/src/game/factionSetup.ts`, `lib/src/game/setup.ts`, `lib/src/game/Game.ts`
- [x] `feat(lib): bots answer prompts, take hits and keep no hand`
  - `lib/src/factions/bots/botAnswers.ts` (new) + test, `lib/src/events/battle/*`, `lib/src/rules/remove.ts`, `lib/src/factions/Vagabond.ts`, `lib/src/events/buyServices.ts`, `lib/src/game/Game.ts`
- [x] `feat(lib): Mechanical Marquise turn`
  - `lib/src/factions/bots/MechanicalMarquise.ts`, `lib/src/factions/bots/mechanicalMarquise/*.ts` (new) + tests, `lib/src/factions/index.ts`
- [x] `feat(lib): Electric Eyrie turn`
  - `lib/src/factions/bots/ElectricEyrie.ts`, `lib/src/factions/bots/electricEyrie/*.ts` (new) + tests, `lib/src/factions/index.ts`
- [x] `test(lib): seeded games with bots play out`
  - `lib/src/factions/bots/botGames.test.ts` (new)
- [x] `feat(api): bot factions`
  - `backend/web/src/schemas/common.ts`, `backend/web/src/typeGuards.ts`, `backend/web/src/aiPlayer/*`, `backend/web/openapi.json`, `backend/web_client/src/schema.d.ts` (generated)
- [x] `feat(react): bots in the hotseat menu with cat and bird art`
  - `frontend/react/src/game/menuPartySetup.ts`, `GameSession.ts`, `theme.ts`, `assets/*`, `react/ActionTray.tsx`, `react/PieceStack.tsx`
- [x] `feat(react): bot faction board`
  - `frontend/react/src/ui/botBoardViewModel.ts` (new) + test, `frontend/react/src/react/BotFactionBoard.tsx` (new), `FactionBoardModal.tsx`


## Solo mode: one player against both bots, no backend

### Goal
- Menu "Solo vs bots": the player picks a faction and plays it against Mechanical Marquise and Electric Eyrie.
- Runs in the browser only: no API server, no WebSocket. Works in production builds.
- A page reload in the same tab goes back into the solo game.

### Approach
1. `frontend/react/src/api/localGameApi.ts` (new): the `GameApi` surface over an in-memory `lib` `Game` (create / join / start / getGame / legalActions / submitAction / gameLog / undo / undoTurnAction / delete / snapshot load), plus a `connectSocket` that pushes after each change. Errors come out as `ApiError` like the server's. Every change saves the snapshot to `localStorage`.
2. `GameSession.rebindApi` takes the socket factory too, so the session runs on the local api unchanged (hotseat flow: `startLocalParty`, follow the actor).
3. Menu: `MenuSoloSetup.tsx` (faction pick among the factions no bot replaces + start). `App.tsx` binds the session to the local api, starts the party, enters the game; back on the menu the session goes back to the server api.

### Risks
- Bot turns run inside `apply`: the whole bot turn lands in one push (no step-by-step animation beyond the log effects).
- Bundle grows by `lib` (already partly imported).

### Test plan
- `localGameApi.test.ts`: create + join + start a solo party, submit an action, illegal action → `ApiError`, delete → `NO_GAME`, push after change, snapshot restored from storage.
- `menuPartySetup.test.ts`: solo factions.
- Manual: chrome-devtools, backend stopped, solo game played for several turns; demo video.

### Commit plan
- [x] `feat(react): in-browser game api`
  - `frontend/react/src/api/localGameApi.ts` (new) + test, `frontend/react/vite.config.ts` (`#` imports resolved per package so `lib` bundles)
- [x] `feat(react): solo mode against both bots`
  - `frontend/react/src/game/menuPartySetup.ts` + test, `frontend/react/src/react/MenuSoloSetup.tsx` (new), `MenuOverlay.tsx`, `game/hudStore.ts`, `game/GameSession.ts`, `game/soloGame.ts` (new), `App.tsx`


## Bot difficulty and traits (Rootbotics 3.3)

### Goal
- Each bot seat gets a difficulty (easy / default / challenging / nightmare) and any of its five traits, chosen in the menu (solo and hotseat) and shown on the bot board.
- Card text SoT: `resources/rules/Rootbotics_difficulty_and_traits.md` (scans in `resources/rules/rootbotics-cards/`).

### Approach
1. `lib`: `GameState.botSettings?: Partial<Record<BotFactionId, BotSettings>>` (`{ difficulty, traits }`), set by `Game.create({ …, botSettings })`, kept by undo. Absent = default difficulty, no trait (old snapshots unchanged). Ids, names and card text in `lib/src/public/botSettings.ts` (no runtime imports, shared with React).
2. Mechanical Marquise: Easy recruits 2; Challenging/Nightmare +2 warriors in the highest-priority ruled ordered clearing after recruiting; Nightmare +1 VP at end of Evening. Traits: Blitz (task after the move step), Fortified (battle removal: a building costs 2 hits, a lone hit on buildings does nothing), Hospitals (battle end as defender, ≥ 2 warriors lost → 2 warriors at the keep), Iron Will (Escalated recruit ×2), Overwhelming (+1 VP per 2 unplaced Recruit warriors, Expand at most once).
3. Electric Eyrie: Easy one vizier; Challenging/Nightmare a bird Ambush from the draw pile into the bird column; Nightmare +1 VP at end of Evening. Traits: Focused (extra hit on a tie for the longest column), Nobility (turmoil also when a Decree recruit cannot place all its warriors; turmoil scores +1 per bird card instead of losing), Relentless (after the Decree, remove defenseless enemy buildings/tokens where it has warriors), Swoop (end of Daylight, 2 warriors in the highest-priority clearing with no Eyrie piece), War Tax (each building/token it removes costs the owner 1 VP).
4. API: `botSettings` on `POST /game`; client regen (`pnpm gen:api-client`).
5. React: difficulty select + trait toggles per bot in the solo and hotseat menus; difficulty and traits listed on the bot board.

### Risks (readings of the card text)
- Easy Marquise in Escalated Daylight: half the warriors too (one per clearing, two if it rules one).
- "Matching the order card" on a bird order: every clearing matches.
- Blitz destination: the adjacent clearing with the most enemy pieces, like 4.5.4; it runs once after each move step (normal and Escalated).
- Fortified only changes battle hits.
- Nobility "unable to place a warrior": a Decree recruit placing fewer warriors than its column's cards (no clearing or empty supply). Turmoil then ends Daylight.
- War Tax: the owner's VP does not go below 0.

### Test plan
- lib unit tests per card (fixture factory): each difficulty, each trait, settings kept by undo and snapshot.
- lib seeded games: every trait on, nightmare, both bots, play out with no error.
- React: menu settings model tests; bot board view model shows settings.
- Manual: solo game with nightmare + all traits, hotseat with settings via backend; demo video.

### Commit plan
- [x] `feat(lib): bot difficulty and trait settings`
  - `resources/rules/Rootbotics_difficulty_and_traits.md`, `resources/rules/rootbotics-cards/*`, `lib/src/public/botSettings.ts` (new), `lib/src/state/types.ts`, `lib/src/game/Game.ts`, `lib/src/game/setup.ts`, `lib/src/factions/bots/botSettings.ts` (new) + test
- [x] `feat(lib): Mechanical Marquise difficulty and traits`
  - `lib/src/factions/bots/mechanicalMarquise/*`, `MechanicalMarquise.ts`, `lib/src/events/battle/removal.ts`, `lib/src/events/battle/stages.ts` + tests
- [x] `feat(lib): Electric Eyrie difficulty and traits`
  - `lib/src/factions/bots/electricEyrie/*`, `ElectricEyrie.ts`, `lib/src/rules/remove.ts` + tests, `botGames.test.ts`
- [x] `feat(api): bot settings on create game`
  - `backend/web/src/schemas/*`, `backend/web/src/routes/game.ts`, `backend/web/openapi.json`, `backend/web_client/src/*`
- [x] `feat(react): pick bot difficulty and traits`
  - `frontend/react/src/react/MenuBotSettings.tsx` (new), `MenuSoloSetup.tsx`, `MenuHotseatSetup.tsx`, `game/*`, `api/localGameApi.ts`, `ui/botBoardViewModel.ts`, `react/BotFactionBoard.tsx` + tests


## Solo run lobby: player vs bots

### Goal
- Start menu button "Solo run" opens a lobby-style screen: player tile, "VS", bot tiles, a shared faction track, Back / Play solo.
- One or more bots (today: up to both Rootbotics bots); ＋ tile adds a bot, × removes one (at least one stays).
- Any faction for the player; a bot and the faction it replaces never sit together (Rootbotics 3.2): Marquise / Eyrie are open when their bot is not seated.
- ⚙ on a bot tile opens its difficulty and trait cards (`MenuBotSettings`).

### Approach
1. `game/soloTableSetup.ts` (new, pure): `SoloTable` (player faction, seated bots, selected slot: player / bot / new bot) + transitions (select slot, pick faction, remove bot, can add bot) + `soloTrackChoices` (the track as `MenuFactionChoice[]`: picked / blocked / free for the selected slot) + party factions.
2. `menuPartySetup.ts`: drop `SOLO_FACTION_IDS` / `soloPartyFactions`; `onStartSolo` takes the party factions (`hudStore`, `App.tsx`, `soloGame.ts`).
3. React: `MenuSoloSetup.tsx` rewritten as the lobby screen; solo seat tiles in `MenuSoloSeats.tsx` (new) follow the lobby seat look; lobby title / cancel / footer classes move to `MenuParts.tsx`; the track is `LobbyFactionDock` with a tab label and column override. `MenuOverlay.tsx`: "Solo run" button toggles the screen.

### Risks
- 2-seat solo (one human, one bot): lib already seats it (`setup.test.ts`), dominance cards out.

### Test plan
- `soloTableSetup.test.ts`: default table, clash blocking both ways, add / replace / remove bot, minimum one bot, party factions valid by `validatePartyFactions`.
- Manual: chrome-devtools, solo run with Marquise vs Electric Eyrie only; QA solo demo script still records.

### Commit plan
- [x] `feat(react): solo run lobby`
  - `frontend/react/src/game/soloTableSetup.ts` (new) + test, `game/menuPartySetup.ts` + test, `game/hudStore.ts`, `game/soloGame.ts`, `App.tsx`, `react/MenuSoloSetup.tsx`, `react/MenuSoloSeats.tsx` (new), `react/MenuLobbyFactionDock.tsx`, `react/MenuLobbyPanel.tsx`, `react/MenuParts.tsx`, `react/MenuOverlay.tsx`, `react/MenuBotSettings.tsx`, `react/MenuHotseatSetup.tsx`
- [x] `dx(skills): solo demo through the solo run lobby`
  - `.agents/skills/QA/record-solo-vs-bots.mjs`


## Follow-up: deprecate `GET /game/actions`

### Goal
- No legal action specs (`params`) on the wire. Today they are bloated (march, riverfolkMove, build, setServiceCosts reach 60–100 options, 3–4 KB each) and still miss march's second move.
- The client works out its own legal actions from its (redacted) state with `lib` rules. The server keeps validating every action.
- AI and CLI read `GET /game/actions/explained` (kind, rules, schema) and `preview` instead of `params`.
- Removed: `GET /game/actions`, `legalActions` in the WS push and in the `act` tool result. Kept: `POST /game/actions` (apply).

### Approach
1. `lib`: pull the body of `Game.legalActions()` into a pure `legalActionsOf(state)`: builds the same ctx (Fall map, rule hooks, card grants) with an rng that throws if used, since listing actions must never roll. `Game.legalActions()` calls it; the lobby branch stays in `Game`.
2. Parity guard: in random-play fixture games, at every step, for the acting seat, `legalActionsOf(redactStateForViewer(state, actor))` equals `redactLegalActionsForViewer(game.legalActions(), …)`. This proves hidden info (other hands, deck) never decides your own legal actions. Any mismatch → stop and ask before fixing.
3. React: `GameSession.refresh()` and the WS handler compute `legalActions` with `legalActionsOf(state)` instead of reading them from the server. The composers keep reading the same `ActionSpec` shape, so `ActionComposer` / `ActionTray` / flows stay untouched.
4. AI: the `actions` tool returns the explained list; the `act` result returns it too (replaces `legalActions`). Prompt: drop the "pick a value from each param" paragraph; build the action from `schema` + `rules` + `show` / `clearing` / `card`, check with `preview`, the engine rejects illegal ones. Internal uses of `listPlayerLegalActions` (driver, card/clearing detail, seat guard) stay server side.
5. CLI: `actions` prints the explained list. `auto` gets `@root/lib` and runs `legalActionsOf` on the fetched state.
6. API: remove `GET /game/actions` and `legalActions` from the WS push. Regenerate the client with `pnpm gen:api-client`; remove `legalActions()` from `gameApi.ts`.

### Risks
- Hidden info: if a seat's own legal actions depend on another seat's hidden info (hand, deck, face-down cards), a redacted client cannot compute them. The parity test (step 2) is the gate; a mismatch stops the plan.
- Scope: "UI computes clickables" is read as running `lib`'s legal-action code on the client. Composers keep the `ActionSpec` shape; no rewrite of the composer layer.
- AI play quality: the AI loses the list of exact legal values. It relies on rules + board, `preview`, and the server's rejection errors. Watch for retry loops in `ai-stream`.
- Bloat moves, not gone: march / riverfolkMove / build `params` stay large, now only in the client's memory. No wire or token cost; compact later if UI speed suffers.
- Hidden randomness: listing actions must never roll. The throwing rng in `legalActionsOf` makes any roll a loud failure instead of a client/server desync.

### Test plan
- `lib`: `legalActionsOf` equals `Game.legalActions()` on fixture games (Marquise daylight, Eyrie decree, pending event). Throwing rng never fires.
- Backend parity test (step 2) over all six factions, fixed seeds.
- React: `GameSession.test.ts` and `gameSocket.test.ts` publish locally computed legal actions; the push has no `legalActions` field.
- AI: tool tests: `actions` returns kind/rules/schema with no `params`; `act` result carries the explained list.
- Backend route test: `GET /game/actions` → 404; `POST /game/actions` unchanged.
- Manual: React game of Marquise vs Eyrie, one full turn each (march two moves, build, recruit, decree); `pnpm --filter @root/cli start -- auto --turns 20`; one AI turn via `ai-stream`.

### Commit plan
- `refactor(lib): legal actions as a pure function of state`
  - `lib/src/game/legalActionsOf.ts` (new)
  - `lib/src/game/legalActionsOf.test.ts` (new)
  - `lib/src/game/Game.ts`
  - `lib/src/index.ts`
- `test(web): client legal actions match server on redacted state`
  - `backend/web/src/view/viewerLegalActionsParity.test.ts` (new)
- `feat(react): compute legal actions locally`
  - `frontend/react/src/game/GameSession.ts`
  - `frontend/react/src/game/GameSession.test.ts`
  - `frontend/react/src/api/gameSocket.ts`
  - `frontend/react/src/api/gameSocket.test.ts`
- `feat(ai): actions tool lists explained actions, no params`
  - `backend/web/src/aiPlayer/aiPlayerTools.ts`
  - `backend/web/src/aiPlayer/aiPlayerTools.test.ts`
  - `backend/web/src/aiPlayer/aiPlayerPrompt.ts`
- `feat(cli): actions and auto without GET /game/actions`
  - `frontend/cli/package.json`, `pnpm-lock.yaml`
  - `frontend/cli/src/commands/actions.ts`
  - `frontend/cli/src/commands/auto.ts`
- `feat(api)!: remove GET /game/actions and pushed legal actions`
  - `backend/web/src/routes/game.ts`
  - `backend/web/src/routes/game.test.ts`
  - `backend/web/src/schemas/game.ts`
  - `backend/web/src/ws/GameHub.ts`
  - `backend/web/openapi.json`
  - `backend/web_client/src/schema.d.ts` (generated)
  - `backend/web_client/src/gameApi.ts`
  - `README.md` (endpoint table)
