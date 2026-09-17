### Goal
- Ship **GP1**: playable 2p game, `DEFAULT_FACTIONS = ['marquise','marquise']`, keeps at opposite Fall corners.
- Portable engine in `lib` (pure TS, deterministic). `backend/web` hosts **one game at a time** (no rooms). CLI talks **only** to web API.
- Entire live game dumpable to **one JSON file** lossless (`GameSnapshot` = state + history + log + rng).
- Gate: `cli auto --turns 50` → 30 VP winner or clean turn cap; zero 5xx; `replay` matches; no dominance in 2p deck.

### Approach
- Follow `resources/notes/grand-plan-toward-base-game.md` Phases 0–9 + OOP layout there.
- Rules SoT = `resources/rules/Law_of_Root.pdf` (md: `Law_of_Root.md`). Implementable summary = `resources/notes/root-base-rules.md`. Cite `// Rule: Section > Subsection`. Tests name after rule lines.
- Owner = **seat** (not faction) so 2 cats never collide.
- Lobby: `Game.create` → `waiting`; `join` → seat = join index, faction from sequence **marquise → eyrie → alliance → vagabond** (`DEFAULT_FACTIONS`; GP1 both marquise). **No auto-start.** Explicit `{ type:'start' }` / `POST /game/start` when `players.length > 1` and still waiting.
- **Single game**: `GameStore = { game: Game | null }`. Routes = `/game/...` (no `:id`). `POST /game` → 409 if slot full unless `?replace=1` (esp. while `playing`). Rooms later.
- **Lossless JSON**: `GameState` plain JSON only (no Map/Set/class). `Game.toJSON()` / `fromJSON(snapshot)`. Persist `{ state, history, log, rng: { seed, cursor } }` as one `.json` file.
- Pending `Event[]` FIFO for battle / field hospital. Signals + hooks for card effects (Phase 7b proves bus).
- House rules (document Phase 0): seat 0 starts; explicit lobby start when players > 1; 2-cat garrison = keep+adjacent only; buildings keep-then-adjacent-by-id; dominance deferred.
- Already done: pnpm workspace, `@root/lib` stub, `@root/web` hello Hono. `frontend/cli` empty. No vitest yet.
- Fall map image **already on disk**: `resources/reference/map/base/autumn-map.jpg` (3479×3189; see `SOURCES.md`). Layout/`toSvg` point at this path — **no add-asset commit**.
- Prefer scripts: vitest via create script; cards via `pnpm --filter @root/lib gen:cards`; CLI package via bootstrap (not hand-edit scaffold).

### Files to change
- `lib/src/**` — map, layout, cards, pieces, state, events, triggers, actions, log, queries, rules, factions, game
- `lib/scripts/gen-cards.ts`, `lib/vitest.config.ts`, `lib/package.json`
- `backend/web/src/store/**`, `routes/game.ts`, `routes/map.ts`, `middleware/**`, `index.ts`
- `frontend/cli/**` — API client + commands
- `resources/notes/root-base-rules.md` — board tracks + house rules (Phase 0)
- `resources/reference/ep-decks/cards.json` — add `vp` on item cards
- `resources/reference/map/base/autumn-map.jpg` — **exists**; layout reads it (no copy needed)
- `README.md` — usage for lib/web/cli

### Test plan
- Every commit: `pnpm -r typecheck`.
- Rule-named vitest in `lib` (map graph, deck counts, queries, lobby join sequence + **start needs >1 player**, Marquise actions, pending FIFO, signals, craft VP, Keep, replay/undo, 30 VP seat winner, **toJSON/fromJSON round-trip**).
- Silent-score guards: craft item → printed VP; Keep removed → `canPlace` true; pending head-first; 2-cat winner = seat.
- Web: create → join ×2 → **start** → actions → act → log → undo → 400 illegal; second create without replace → 409; start with <2 → 400; `GET /game/snapshot` file-ready.
- CLI gate: `auto --turns 50` vs live web; 2 cats; no dominance dealt.

### Commit plan

#### Phase 0 — scaffolding + rules gap
- `chore(lib): add vitest`
  - `lib/package.json`, `lib/vitest.config.ts`
- `chore(cli): bootstrap TypeScript package`
  - `frontend/cli/package.json`, `tsconfig.json`, `src/index.ts` (use bootstrap script)
- `docs(rules): add Marquise board tracks`
  - `resources/notes/root-base-rules.md` (cost / VP / draw bonus per column)
- `docs(rules): add Eyrie roost track VP`
  - same file
- `docs(rules): add Alliance sympathy track cost/VP`
  - same file
- `docs(rules): add Vagabond relationship track costs/VP`
  - same file
- `docs(rules): note house rules`
  - same file — Implementation deviations: seat 0 starts; explicit lobby start when players > 1; role sequence marquise→eyrie→alliance→vagabond (GP1 both marquise); 2-cat garrison; buildings keep-then-adjacent-by-id; Builder/Thief only; dominance/quests/coalition deferred
- `chore(resources): add vp to item cards`
  - `resources/reference/ep-decks/cards.json` (parse from description; generator reads field)

#### Phase 1 — map (graph)
- *(skip)* Fall board image — already at `resources/reference/map/base/autumn-map.jpg`
- `feat(lib): add Suit, Clearing, Path types`
  - `lib/src/map/types.ts`
- `feat(lib): add GameMap with adjacency`
  - `lib/src/map/GameMap.ts`
- `feat(lib): add Fall clearings and suits`
  - `lib/src/map/fall.ts`
- `feat(lib): add Fall paths and forests`
  - `lib/src/map/fall.ts`
- `feat(lib): add Fall rivers`
  - `lib/src/map/fall.ts` — Rule: Board > Rivers
- `feat(lib): add Fall corners and opposite`
  - `lib/src/map/fall.ts` — test: opposite involutive
- `feat(lib): add Fall vagabondForest id`
  - `lib/src/map/fall.ts`
- `test(lib): cover Fall graph`
  - `lib/src/map/fall.test.ts` — 12 clearings, adjacency symmetric, rivers ⊄ paths

#### Phase 1b — map layout (UI only)
- `feat(lib): add MapLayout types`
  - `lib/src/layout/types.ts`
- `feat(lib): add Fall layout coords`
  - `lib/src/layout/fall.ts` — `image` → `resources/reference/map/base/autumn-map.jpg`; hand-pick x,y,r from that board
- `feat(lib): add toSvg map renderer`
  - `lib/src/layout/render/svg.ts` + snapshot test
- `feat(lib): add toAscii map renderer`
  - `lib/src/layout/render/ascii.ts` + test

#### Phase 2 — core types
- `feat(lib): add FactionId, Seat, Piece types`
  - `lib/src/pieces/types.ts` — owner = seat
- `feat(lib): add Card and CardDef types`
  - `lib/src/cards/types.ts`
- `chore(lib): add gen:cards script from ep cards.json`
  - `lib/scripts/gen-cards.ts`, `lib/package.json`
- `feat(lib): add generated E&P card defs`
  - `lib/src/cards/ep.generated.ts` — test: 54 copies, suits 14/14/13/13, every item has `vp`
- `feat(lib): add EP_DECK expansion`
  - `lib/src/cards/epDeck.ts` + test
- `feat(lib): add Deck draw/discard`
  - `lib/src/cards/Deck.ts` + test — Rule: Cards reshuffle; dominance → `dominanceAvailable`
- `feat(lib): add matchesSuit and bird wildcard`
  - `lib/src/cards/suit.ts` + test — Rule: Cards > Birds are wild
- `feat(lib): add Phase, Step, GameState types`
  - `lib/src/state/types.ts` — `pending: Event[]`, `winner?: Seat`; plain JSON only
- `feat(lib): add GameSnapshot type`
  - `lib/src/state/snapshot.ts` — `{ state, history, log, rng }`
- `feat(lib): add setup constants`
  - `lib/src/state/constants.ts` — `DEFAULT_FACTIONS = ['marquise','marquise']` (sequence marquise→eyrie→alliance→vagabond), ITEM_SUPPLY, RUIN_ITEMS, HAND_LIMIT, STARTING_HAND
- `feat(lib): add MarquiseBoard type with supply`
  - `lib/src/state/boards.ts` — tracks from Phase 0 docs
- `feat(lib): add Event types`
  - `lib/src/events/types.ts`
- `feat(lib): add GameSignal types`
  - `lib/src/triggers/signals.ts`
- `feat(lib): add RuleHooks defaults`
  - `lib/src/triggers/hooks.ts`
- `feat(lib): add CardEffect type and empty registry`
  - `lib/src/triggers/effects.ts`
- `feat(lib): add SignalBus`
  - `lib/src/triggers/SignalBus.ts` + test
- `feat(lib): add Ctx type`
  - `lib/src/game/ctx.ts`
- `feat(lib): add Action and ActionSpec types`
  - `lib/src/actions/types.ts` — `ActionSpec.actor: Seat`
- `feat(lib): add LogEntry types`
  - `lib/src/log/types.ts`
- `feat(lib): add RuleError`
  - `lib/src/rules/RuleError.ts`
- `feat(lib): add Rng and SeededRng`
  - `lib/src/rules/Rng.ts` + test — serializable `{ seed, cursor }`

#### Phase 3 — queries + shared rules
- `feat(lib): add ruler query with Eyrie tie-break`
  - `lib/src/queries/ruler.ts` + test — Rule: Board > Rule
- `feat(lib): add warriors and pieces queries`
  - `lib/src/queries/pieces.ts`
- `feat(lib): add openSlots query`
  - `lib/src/queries/slots.ts` + test — Rule: Board > Slots
- `feat(lib): add factionOf and seat helpers`
  - `lib/src/queries/seat.ts`
- `feat(lib): add canPlace query with Keep by owner`
  - `lib/src/queries/place.ts` + test — Rule: Marquise > The Keep; move-in OK, place blocked; no token → open
- `feat(lib): add canMove query`
  - `lib/src/queries/move.ts` + test — Rule: Move 1–3
- `feat(lib): add connectedRuled query`
  - `lib/src/queries/connected.ts` + test
- `feat(lib): add woodReachable query`
  - `lib/src/queries/wood.ts` + test — Rule: Marquise > Build 3
- `feat(lib): add canCraft query`
  - `lib/src/queries/craft.ts` + test — Rule: Craft 1–4
- `feat(lib): add placeUpTo helper`
  - `lib/src/rules/place.ts` + test — Rule: Pieces — max possible
- `feat(lib): add removePieces with VP`
  - `lib/src/rules/remove.ts` + test — Rule: Victory — +1 per building/token

#### Phase 4 — Marquise setup (1 or 2 seats)
- `feat(lib): add abstract Faction and registry`
  - `lib/src/factions/Faction.ts`, `index.ts`
- `feat(lib): Marquise setup keep at corner`
  - `lib/src/factions/Marquise.ts` + test — 1st `corners[0]`, 2nd `opposite`
- `feat(lib): Marquise setup garrison all except opposite`
  - same + test — Setup 3 single-cat path
- `feat(lib): Marquise 2-cat garrison keep+adjacent`
  - same + test — GP1 variant
- `feat(lib): Marquise setup buildings and tracks`
  - same + test — Setup 4–5 via `placeUpTo`; leftmost empty

#### Phase 5 — Game core
- `feat(lib): add TurnLog`
  - `lib/src/log/TurnLog.ts`
- `feat(lib): Game.create in waiting status`
  - `lib/src/game/Game.ts` + test
- `feat(lib): Game.join assigns factions[seat]`
  - same + test — seat0=marquise, seat1=marquise (GP1)
- `feat(lib): Game.join rejects when full`
  - same + test
- `feat(lib): Game.join does not auto-start`
  - same + test — 2 joined → still waiting
- `feat(lib): Game.start requires players greater than 1`
  - same + test — 0/1 → error; ≥2 → ok
- `feat(lib): Game.start strips dominance for 2p`
  - same + test — Rule: Setup 3
- `feat(lib): Game.start deals hands, ruins, item supply`
  - same + test — Rule: Setup 2–5 order
- `feat(lib): Game.start runs faction setups by seat`
  - same + test
- `feat(lib): Game.legalActions delegates`
  - same — waiting: join (+ start if ≥2)
- `feat(lib): Game.apply endPhase with steps`
  - same + test
- `feat(lib): Game.apply runs autoActions`
  - same + test
- `feat(lib): Game.apply gates on pending queue head`
  - same + test — FIFO
- `feat(lib): Game emits phase.start/end signals`
  - same + test
- `feat(lib): Game merges granted actions into legalActions`
  - same + test
- `feat(lib): Game win check 30 VP with tie-break`
  - same + test — `winner: Seat`
- `feat(lib): Game.replay and undo`
  - same + test
- `feat(lib): Game.toJSON / fromJSON snapshot`
  - same + test — one JSON object = full restore; state + rng cursor
- `feat(lib): export public API`
  - `lib/src/index.ts`

#### Phase 6 — Marquise turn
- `feat(lib): Marquise birdsong wood autoAction`
  - `Marquise.ts` + test — capped by wood supply
- `feat(lib): Marquise daylight steps craft/actions`
  - same
- `feat(lib): Marquise action budget`
  - same + test — 3 actions
- `feat(lib): Marquise spendBird extra action`
  - same + test
- `feat(lib): Marquise recruit once per turn`
  - same + test
- `feat(lib): add shared move rule`
  - `lib/src/rules/move.ts` + test
- `feat(lib): Marquise march`
  - `Marquise.ts` + test — up to 2 moves
- `feat(lib): Marquise build with wood payment`
  - same + test — Rule: Marquise > Build 1–4
- `feat(lib): Marquise overwork`
  - same + test
- `feat(lib): Marquise craft via workshops`
  - same + test
- `feat(lib): score printed craft VP`
  - `lib/src/rules/craft.ts` + test — via `hooks.craftVp` **before** signal
- `feat(lib): craft emits craft.item / craft.persistent`
  - same + test
- `feat(lib): Marquise evening draw`
  - same + test — 1 + draw bonus
- `feat(lib): Marquise evening discard to hand limit`
  - same + test
- `feat(lib): Marquise endTurn resets used flags`
  - same + test

#### Phase 7 — Battle event (cat vs cat)
- `feat(lib): add battle event resolver skeleton`
  - `lib/src/events/battle.ts`
- `feat(lib): battle ambush and foil stages`
  - same + test — ambush suit = clearing; bird ok; end if no attackers
- `feat(lib): battle roll stage`
  - same + test — max hits = warriors
- `feat(lib): battle effects stage with defenseless`
  - same + test — `hooks.extraHits`
- `feat(lib): battle effectsOrder stage`
  - same + test — attacker picks when both have effects
- `feat(lib): battle removal stages by victim`
  - same + test — warriors first; VP
- `feat(lib): Marquise battle action opens event`
  - `Marquise.ts` + test
- `feat(lib): battle emits battle.start/hits/end signals`
  - `events/battle.ts` + test
- `feat(lib): add fieldHospital event resolver`
  - `lib/src/events/fieldHospital.ts` + test — pay matching card or decline
- `feat(lib): removePieces enqueues fieldHospital`
  - `rules/remove.ts` + test — only if victim still has keep
- `feat(lib): keep removal is permanent`
  - same + test — token never returns; `canPlace` opens

#### Phase 7b — first card effects (prove bus)
- `feat(lib): Master Engravers listener`
  - `lib/src/effects/masterEngravers.ts` + test
- `feat(lib): Murine Broker listener`
  - `lib/src/effects/murineBroker.ts` + test
- `feat(lib): Boat Builders hook`
  - `lib/src/effects/boatBuilders.ts` + test
- `feat(lib): Soup Kitchens hook`
  - `lib/src/effects/soupKitchens.ts` + test
- `feat(lib): Fox Partisans battle hook`
  - `lib/src/effects/partisans.ts` + test
- `feat(lib): Swap Meet granted action`
  - `lib/src/effects/swapMeet.ts` + test — once per Birdsong

#### Phase 8 — web API (single game, no rooms)
- `feat(web): add single-slot GameStore`
  - `backend/web/src/store/GameStore.ts` — `game: Game | null`
- `feat(web): add RuleError middleware`
  - `middleware/errors.ts`, `index.ts` — 404 no game; 409 exists
- `feat(web): POST /game creates lobby`
  - `routes/game.ts` — body `{ factions? }`; 400 unknown faction; 409 if slot full unless `?replace=1` (esp. while playing)
- `feat(web): POST /game/join`
  - same
- `feat(web): POST /game/start`
  - same — 400 unless waiting && players > 1
- `feat(web): GET /game`
  - same
- `feat(web): GET /game/snapshot`
  - same — `GameSnapshot` JSON, file-ready
- `feat(web): GET /game/actions`
  - same
- `feat(web): POST /game/actions`
  - same
- `feat(web): GET /game/log`
  - same
- `feat(web): POST /game/undo`
  - same
- `feat(web): GET /game/map.svg`
  - same
- `feat(web): DELETE /game clears slot`
  - same
- `feat(web): GET /map/fall and layout`
  - `routes/map.ts`

#### Phase 9 — CLI
- `feat(cli): add API client`
  - `frontend/cli/src/api/client.ts` — create/join/start/get/snapshot/actions/act/log/undo/delete; no game id
- `feat(cli): new command with --factions`
  - `commands/new.ts`, `index.ts` — uses `?replace=1`
- `feat(cli): join command`
  - `commands/join.ts`
- `feat(cli): start command`
  - `commands/start.ts`
- `feat(cli): show command`
  - `commands/show.ts`
- `feat(cli): map ascii command`
  - `commands/map.ts`
- `feat(cli): actions command`
  - `commands/actions.ts`
- `feat(cli): act command`
  - `commands/act.ts`
- `feat(cli): log and undo commands`
  - `commands/log.ts`, `commands/undo.ts`
- `feat(cli): auto random-agent command`
  - `commands/auto.ts` — create → join ×N → start → loop
- `docs: usage for lib/web/cli`
  - `README.md`

**GP1 gate (after Phase 9):** `auto --turns 50` with 2 cats → 30 VP or clean turn cap; zero 5xx; `replay` matches; no dominance in deck.
