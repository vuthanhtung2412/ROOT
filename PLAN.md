### Goal
- Portable Root engine in `/lib` (pure TS, no HTTP, deterministic).
- `backend/web` (Hono) hosts games: **inspect state**, **list legal actions**, **submit actions**, **read log**, **undo**.
- `frontend/cli` = agent test tool. Talks **only** to web API (no `lib` import).
- Game starts in a **lobby** (`status: 'waiting'`). Players join one at a time; seat = join index; faction = `state.factions[seat]`. Last seat joins → setup runs → `status: 'playing'`. Player count = `factions.length`.
- Delivered in **4 grand phases**, each a fully playable game, each adding one faction:

| Grand phase | `DEFAULT_FACTIONS` | Players | Proves |
|---|---|---|---|
| **GP1** | `['marquise','marquise']` | 2 — cats at opposite corners | engine, lobby, battle, web, CLI, 2p dominance-removal rule |
| **GP2** | `['marquise','eyrie']` | 2 | Eyrie decree/turmoil, Lords of the Forest, Disdain, asymmetric battle |
| **GP3** | `['marquise','eyrie','alliance']` | 3 | Alliance, Outrage as cross-player pending event, Guerrilla War, 3p turn order |
| **GP4** | `['marquise','eyrie','alliance','vagabond']` | 4 | Vagabond/Thief, relationships, item damage, full rules setup A→D |

- Pieces owned by **seat**, not faction, so 2 cats in GP1 never collide; costs nothing later.
- Simplified setup: fixed corners (`FALL.corners`), fixed leader `builder`, fixed character Thief.

### Rules source of truth

`resources/rules/root-base-rules.md` (see `AGENTS.md`). Every rule-bearing commit below names its section. Code cites `// Rule: Section > Subsection`. Tests named after rule lines.

**Rules → engine mapping (specifics the plan must honour)**

| Rule (section) | Engine |
|---|---|
| Interpretation 2, 4 — `cannot` absolute; `move` ≠ `place` | `canPlace()` query separate from `canMove()`; Keep: only Marquise may *place* there |
| Game loop — clockwise; at-start / at-end ordering | seat order = join order; `phase.start` signal before step content, `phase.end` after |
| Victory — 30 VP immediate; tie → current turn player | `checkWin()` after every `apply`; tie-break by `currentSeat` |
| Victory — dominance never discarded → "available" | `state.dominanceAvailable: Card[]`; `Deck.discard()` routes dominance there. Activation/coalition **deferred** |
| Board — slots; ruins fill slots; ruins removable | map `Clearing.ruinSlot` (static) + `ClearingState.ruin?: { items }` (dynamic); `openSlots()` query counts ruin |
| Board — rivers ≠ paths | `GameMap.rivers: Path[]` (Fall has rivers); only Boat Builders hook reads them |
| Board — rule = warriors + buildings; tokens/pawn 0; tie → none; Eyrie wins ties | `ruler()` + `hooks.ruleWeight` |
| Pieces — limited supply; place max possible | `board.supply.{warriors,wood,…}`; `placeUpTo()` helper caps and logs shortfall |
| Cards — birds wild; forced discard must use birds; bird prompt needs bird | `matchesSuit(card, suit)`, `pickCardsForSuit()` in `cards/` |
| Cards — empty deck → shuffle discard | `Deck.draw()` |
| Craft — piece once/turn; suit = clearing; missing item → cannot; no duplicate persistent | `Building.used`; `itemSupply` check; play-area `defId` check |
| Move — >0 pieces; adjacent; rule origin or dest | `canMove()`; count ≥ 1 |
| Battle — ambush/foil; end if no attackers; higher/lower die; max hits = warriors; defenseless +1; victim orders removal, warriors first; +1 VP per building/token | `Event.battle.stage: 'ambush' \| 'foil' \| 'roll' \| 'effects' \| 'removeDefender' \| 'removeAttacker'`; removal = `resolveEvent { pieceIds }` by victim; `hooks.extraHits` |
| Setup — order: hands (3 each; **2p → remove 4 dominance first**) → 4 ruins → item supply → factions A→D | `Game.start()` fixed order; `if players === 2` strip dominance from deck (GP1/GP2); `ITEM_SUPPLY = {boot:2,bag:2,crossbow:1,hammer:1,sword:2,tea:2,coin:2}`; A→D = seat order |
| Marquise setup — keep in a corner; garrison all except opposite corner; 1+1+1 buildings keep/adjacent; tracks leftmost empty | keep = `FALL.corners[0]`; GP1 second cat = `FALL.opposite(corners[0])`. Garrison: **single cat** → all except opposite (rules-exact); **2 cats** → each garrisons keep + adjacent only (would otherwise stack 10 clearings). Buildings into keep then adjacent by id, `placeUpTo` on open slots. Rule: Marquise > Setup 1–5 |
| Marquise — The Keep: only *this* Marquise may place there | `canPlace(state, seat, clearing)` checks keep **owner seat** (GP1 has 2 keeps) |
| Marquise — Field Hospitals: warriors removed → spend matching card → to keep | `Event.fieldHospital` pushed by `removePieces` when victim has keep; resolver: pay card or decline. In GP1 every battle can trigger it |
| Marquise Daylight — craft step then 3 actions; +1 per bird **spent outside action**; recruit once | steps `['craft','actions']`; action `{type:'spendBird', cardId}`; `TurnLog` once-check |
| Marquise Build — rule clearing; leftmost building; wood from clearing + chain of ruled clearings | `woodReachable()` over `connectedRuled()` |
| Evening — draw 1 + bonuses; discard to 5 | steps `['draw','discard']`; action `{type:'discard', cardIds}`; supporters exempt |
| *(GP2)* Eyrie — setup roost + 6, Builder viziers; Birdsong 1–3; Daylight craft → Decree left→right; Turmoil 1–4; Evening roost VP; Disdain for Trade; Lords of the Forest | `EyrieBoard { leader, decree, roostTrack }`; `turnScratch.decree` cursor; turmoil = forced step change; craft VP hook |
| *(GP3)* Alliance — setup; supporters cap 5; Revolt; Spread Sympathy + Martial Law; Mobilize/Train; Military Ops ≤ officers; Guerrilla War; Outrage (2 triggers); base removal | `AllianceBoard { supporters, officers, bases, sympathyTrack }`; `Event.outrage`; battle hook swaps dice for defender |
| *(GP4)* Vagabond — pawn ≠ warrior, unremovable; Nimble; items exhaust/damage/repair/capacity; Refresh/Slip; 9 Daylight actions; Evening rest/draw/capacity; relationships Allied/Hostile/Infamy; full-clear → damage 3; **quests + coalition deferred** | `VagabondBoard { satchel, tracks, damaged, relationships }`; ruins seeded from `RUIN_ITEMS`; `Event.vagabondDamage`; battle takes hits as item damage |

**Gap in rules doc** — faction board numbers are not in the Law: Marquise building costs/VP/draw-bonus per column, Eyrie roost track VP, Alliance sympathy cost/VP per token. Must be added to `root-base-rules.md` from reference sheets before Phase 4.

### Learned from reference repos (`resources/notes/useful-github-repos.md`)

| Source | Lesson | Applied here |
|---|---|---|
| athacker2 | `Faction` protocol + `Action` dataclasses + `Game.apply` | Same shape, keep |
| athacker2 | Enumerating every legal action explodes (March = 2 moves × clearings) → they fell back to string templates | `legalActions()` returns **ActionSpecs** (type + param domains), `validate()` checks a concrete action |
| athacker2 | Birdsong/Evening auto effects returned as **actions** and pushed through `apply` | `Faction.autoActions(phase)` → applied + logged, no hidden side-effect hooks |
| athacker2 | Per-turn "recruit once" derived from action log, buildings `used` flag reset at end of turn | `TurnLog` drives once-per-turn rules; `usedCraftPieces` reset in `endTurn` |
| mdfeinstein | **Pending Event** blocks normal actions until resolved (Battle → Ambush → FieldHospital → Outrage) | `state.pending?: Event`; `legalActions()` returns only event resolutions while pending; `actor` may be **another player** |
| mdfeinstein | Phase has **steps** (Daylight: `craft` → `actions`) | `state.step` per phase, faction-defined |
| mdfeinstein | Checkpoint JSON + action list → **replay / undo** | `Game.history: Action[]`; `Game.replay(seed, actions)`; API `POST /games/:id/undo` |
| mdfeinstein | Read-only **queries** shared by validators + API | `lib/src/queries/*` pure fns over `GameState` (ruler, wood reachable, etc.) |
| mdfeinstein | Typed **GameLog** entries for UI/agents | `LogEntry` union; API `GET /games/:id/log` |

### Approach
- `GameState` = plain JSON. All behaviour = pure functions or classes over state. `Game` wraps state + `Rng` + history.
- **Strategy**: one `Faction` class per faction, registry by `FactionId`.
- **Command**: `Action` union → `Game.apply(action)` → `{ state, log }` or throw `RuleError`.
- **Event interrupt**: any rule needing a decision from any player pushes `state.pending`. Only its resolutions are legal until cleared. Enables Battle/Ambush/Field Hospital/Outrage without special-casing.
- **Signals + hooks for card effects**: engine emits `GameSignal`s at rule boundaries (phase start/end, craft, warriors removed, battle stages, move, draw). Crafted persistent cards register `CardEffect` = listener (`Murine Broker`, `Master Engravers`, `Coffin Makers`, `Charm Offensive`) and/or pure `RuleHooks` (`Boat Builders`, `Tunnels`, `Soup Kitchens`, `Corvid Planners`) and/or granted `ActionSpec`s (`Swap Meet`, `Propaganda Bureau`, `Saboteurs`, `League of Adventurous Mice`). Effects never reach into faction code; factions never know card names. Deterministic: sync dispatch, seat order.
- **Determinism**: `SeededRng`; `Game.replay(seed, actions)` must reproduce state → free undo + test fixtures.
- **Lobby**: `Game.create({ seed, factions? })` → `waiting`, no players. `factions` defaults to `DEFAULT_FACTIONS` (bumped each grand phase). `Game.join(playerId)` assigns `factions[seat]`; join beyond `factions.length` → `RuleError('LOBBY_FULL')`. Last join runs all setups, deals hands, sets `playing`. Only `join` legal while `waiting`.
- **Owner = seat.** `Piece.owner: Seat` (0..3). `factionOf(state, seat)` for rule checks. Every "enemy" / "your" check compares seats. Lets 2 cats coexist in GP1 and costs nothing later.
- **Deck = Exiles & Partisans**, not base. Source of truth = `resources/reference/ep-decks/cards.json` → script generates `lib/src/cards/ep.generated.ts` (types + 46 defs). Never hand-copy card data. Regenerate via `pnpm --filter @root/lib gen:cards`.
- **Map = graph.** Rules only see clearing ids + paths + suits. "Top-left" is a UI notion → lives in `layout/` (fixed `x,y` per clearing on the board image), never in rules. Setup uses fixed ids (`FALL.corners[i]`, `FALL.opposite()`) that happen to match the printed board corners.
- Fixed constants: seat order = join order, seat 0 starts. `FALL.corners: [ClearingId ×4]`. Marquise → `corners[0]`; GP1 2nd cat → `opposite(corners[0])`; Eyrie (GP2+) → `opposite(corners[0])`, leader `builder`; Vagabond = **Thief only**, `FALL.vagabondForest`.
- **Vagabond scope**: single character, hardcoded. No `Character` type, no character registry, no character card in state. Thief starting items (boot, torch, tea, sword) + special `steal` live as constants inside `Vagabond.ts`. Other characters = later PR.
- Already done: workspace, `@root/lib`, web depends on `workspace:*`, tsx watch hot-reload. Remaining scaffolds via scripts (`pnpm create vitest`, `pnpm init`).

### OOP design (`lib/src`)

```
map/                                                                      // pure graph — no "corner" concept in rules
  Suit                 = 'fox' | 'rabbit' | 'mouse'
  ClearingId           = number                                           // 0..11
  Clearing             { id, suit, slots, ruinSlot: boolean }            // ruinSlot = printed "R"; live ruin lives in state
  Path                 = [ClearingId, ClearingId]
  GameMap              { clearings: Clearing[], paths: Path[], rivers: Path[], forests: ClearingId[][]
                         adjacent(id): ClearingId[], isAdjacent(a,b), shortestPath(a,b) }
  FALL: GameMap        + fixed ids: corners: [ClearingId ×4], opposite(corner), vagabondForest
                       (setup rules reference ids, never geometry; "corner" here = named start id, not x/y)

layout/                                                                   // UI-only, same ids as map; never read by rules
  Point                { x: number, y: number }                           // normalised 0..1 of board image
  MapLayout            { image: string, clearings: Record<ClearingId, Point & { r: number }> }
  FALL_LAYOUT          hand-picked from resources/assets/fall-map.jpg
  render/
    toSvg(map, layout, state?): string                                    // circles + path lines + pieces; CLI/web preview
    toAscii(map, layout, state?): string                                  // grid projection for terminal

cards/                                                                    // Exiles & Partisans deck ONLY (no base deck)
  CardSuit             = Suit | 'bird'
  CostSuit             = Suit | 'wild'
  CardType             = 'item' | 'persistent' | 'partisan' | 'ambush' | 'dominance'   // = cards.json `type`
  CardDef              { defId, name, suit, type, cost: CostSuit[], item?: ItemType, description, image }
  Card                 { id: string, defId }                              // one per physical copy; id = `${defId}#${n}`
  EP_CARD_DEFS         generated from resources/reference/ep-decks/cards.json (46 defs)
  EP_DECK              expand `copies` → 54 Card
  Deck                 { draw(state, n), discard(state, card) }          // Rule: Cards — empty → shuffle discard; dominance → state.dominanceAvailable
  matchesSuit(card, suit), pickCardsForSuit(hand, suit, n, { forced })   // Rule: Cards > Birds are wild
  card effects         `effects/<cardName>.ts` — one file per E&P persistent/partisan, registered by defId (Phase 7b)

pieces/
  FactionId            = 'marquise' | 'eyrie' | 'alliance' | 'vagabond'
  Seat                 = 0 | 1 | 2 | 3
  Piece                = Warrior | Building | Token | Pawn                // all carry owner: Seat (not faction — GP1 has 2 cats)
  Warrior              { kind:'warrior', owner }
  Pawn                 { kind:'pawn', owner }                             // one pawn; Thief is the only character for now
  Building             { kind:'building', owner, type, used: boolean }   // used = crafted this turn
  Token                { kind:'token', owner, type: 'wood'|'keep'|'sympathy' }
  factionOf(state, seat): FactionId

state/
  Phase                = 'birdsong' | 'daylight' | 'evening'
  Step                 = string                                          // faction-defined, e.g. 'craft' | 'actions'
  GameStatus           = 'waiting' | 'playing' | 'finished'
  ClearingState        { pieces: Piece[], ruin?: { items: ItemType[] } }
  PlayerState          { playerId, seat, faction, vp, hand: Card[], playArea: Card[], craftedItems: ItemType[], board: FactionBoard }
                       board discriminated by faction: MarquiseBoard | EyrieBoard | AllianceBoard | VagabondBoard
  GameState            { id, seed, map:'fall', status: GameStatus,
                         turn, currentSeat, phase, step,
                         factions: FactionId[],                                 // 2..4, frozen at create
                         players: PlayerState[],                                // length 0..factions.length while waiting
                         clearings, deck, discard, dominanceAvailable: Card[],
                         itemSupply: Record<ItemType, number>,
                         pending?: Event, winner?: FactionId,
                         turnScratch: { actionsLeft, extraActions } }
  DEFAULT_FACTIONS     : FactionId[]    // GP1 ['marquise','marquise'] → GP2 ['marquise','eyrie'] → GP3 +'alliance' → GP4 +'vagabond' (= setup letters A→D)
  ITEM_SUPPLY          = { boot:2, bag:2, crossbow:1, hammer:1, sword:2, tea:2, coin:2 }   // Rule: Setup 5
  RUIN_ITEMS           = ['bag','boot','hammer','sword']                       // Rule: Vagabond > Setup 4
  HAND_LIMIT = 5, STARTING_HAND = 3

boards/                                                                   // per-faction; supply counts live here (Rule: Pieces — limited)
  MarquiseBoard        { supply: { warriors: 25, wood: 8 }, tracks: { sawmill, workshop, recruiter }: { placed: n } }
                       track columns (cost, vp, drawBonus) = constants from rules doc (must be added — see gap)
  EyrieBoard           { supply: { warriors: 20 }, leader: 'builder', decree: Record<'recruit'|'move'|'battle'|'build', Card[]>, roostTrack: { placed } }
  AllianceBoard        { supply: { warriors: 10 }, supporters: Card[], officers: number, bases: Suit[], sympathyTrack: { placed } }
  VagabondBoard        { satchel: Item[], tracks: { tea, coin, bag }: Item[], damaged: Item[], relationships: Record<FactionId, number | 'hostile'> }
  Item                 { type: ItemType, exhausted: boolean }

events/                                                                   // pending decisions (blocking)
  Event                = { type:'battle', clearing, attacker, defender,
                           stage: 'ambush'|'foil'|'roll'|'effects'|'removeDefender'|'removeAttacker',
                           rolls?: [number, number], hits: { attacker: number, defender: number } }   // Rule: Battle steps 1–4
                       | { type:'fieldHospital', victim: Seat, clearing, count }   // Phase 7 — GP1 needs it (cat vs cat)
                       | { type:'outrage', offender: Seat, clearing }              // GP3
                       | { type:'vagabondDamage', count }                          // GP4 — full-clear → damage 3
                       each stage has one `actor: Seat` (may be the non-current player); victim picks removal order, warriors first
                       queue: `state.pending: Event[]` (FIFO) — battle removal may push fieldHospital + outrage at once
  EventResolver        { legalActions(state, ev): ActionSpec[]; apply(state, ev, action, ctx): void }
  RESOLVERS: Record<Event['type'], EventResolver>

triggers/                                                                 // fire-and-forget signals (non-blocking) — for card effects
  GameSignal           = { s:'phase.start', actor, phase } | { s:'phase.end', actor, phase }
                       | { s:'craft.item', actor, cardId, item } | { s:'craft.persistent', actor, cardId }
                       | { s:'warriors.removed', faction, clearing, count, toSupply: boolean }
                       | { s:'battle.start', ev } | { s:'battle.hits', ev, side } | { s:'battle.end', ev }
                       | { s:'move', actor, from, to, count } | { s:'draw', actor, count } | { s:'vp', actor, delta }
  Listener             (state, signal, ctx) => void                       // may mutate state, emit LogEntry, push pending Event
  SignalBus            { emit(state, signal, ctx): void }                 // sync; iterates active listeners in seat order
                       active listeners = every crafted persistent card in every player's play area
  RuleHooks                                                               // pure modifiers, queried not fired
    isAdjacent(state, a, b, faction)   → Boat Builders / Tunnels override map.isAdjacent
    ruleWeight(state, piece, faction)  → Soup Kitchens: tokens count ×2
    needsRuleToMove(state, faction)    → Corvid Planners
    extraHits(state, ev, side)         → Partisans / Commander
  CardEffect           { defId, onSignal?: Listener, hooks?: Partial<RuleHooks>, grants?: (state) => ActionSpec[] }
  EFFECTS: Record<defId, CardEffect>                                      // one file per card in effects/
  engine wiring:       Game.apply → faction.apply emits signals via ctx.emit → SignalBus dispatches to EFFECTS of crafted cards
                       queries/* call RuleHooks.* (fold over active effects) instead of raw map/piece checks

actions/
  Action               = { type:'join', playerId }                              // lobby only
                       | { type:'endPhase' }
                       | { type:'spendBird', cardId }                            // Rule: Marquise Daylight — +1 action, outside actions
                       | { type:'recruit' } | { type:'march', moves } | { type:'build', clearing, building }
                       | { type:'overwork', clearing, cardId } | { type:'craft', cardId }
                       | { type:'battle', clearing, defender }
                       | { type:'discard', cardIds }                             // Rule: Evening — hand > 5
                       | { type:'resolveEvent', ... }                    // event stage answers (ambush yes/no, pieceIds to remove…)
                       // GP2 Eyrie:    addToDecree { cards: [{cardId, column}] } | decree { column, cardId, ...params } | newRoost { clearing }
                       // GP3 Alliance: revolt { clearing } | spreadSympathy { clearing } | mobilize { cardId } | train { cardId }
                       //               | militaryOp { op:'move'|'battle'|'recruit'|'organize', ...params }
                       // GP4 Vagabond: slip { to } | vbMove { to } | vbBattle { defender } | explore | aid { seat, cardId, takeItem? }
                       //               | strike { defender } | repair { item } | vbCraft { cardId } | steal { seat } | moveTrackItem { item, to }
  ActionSpec.actor     : Seat
  ActionSpec           { type, actor: FactionId, params?: Record<string, unknown[]> }  // domains, not combos
  ActionResult         { state: GameState, log: LogEntry[] }

log/
  LogEntry             = { t:'join', playerId, faction } | { t:'start' }
                       | { t:'action', actor, action } | { t:'vp', actor, delta, reason }
                       | { t:'pieces', clearing, placed?, removed? } | { t:'phase', actor, phase, step }
                       | { t:'event', event } | { t:'win', winner }
  TurnLog              { entries: LogEntry[]; actionsThisTurn(state): Action[] }

queries/                                                                  // pure reads, reused by validators + API
  ruler(state, clearing, hooks): FactionId | null                         // Rule: Board > Rule; Eyrie tie-break; hooks.ruleWeight
  warriors(state, clearing, faction): number
  openSlots(state, clearing): number                                      // Rule: Board > Slots; ruin occupies one
  canPlace(state, faction, clearing): boolean                             // Rule: Marquise > The Keep (place ≠ move)
  adjacent(state, a, b, faction, hooks): boolean                          // hooks.isAdjacent (rivers/tunnels)
  connectedRuled(state, faction, from, hooks): Set<clearingId>
  woodReachable(state, faction, from, hooks): number                      // Rule: Marquise > Build 3
  canMove(state, faction, from, to, hooks): boolean                       // Rule: Move; hooks.needsRuleToMove
  canCraft(state, faction, card): boolean                                 // Rule: Craft — unused pieces, suit, item in supply, no dup persistent

rules/
  Rng                  { roll(): 1..6 }  SeededRng
  RuleError            extends Error { code, detail }
  move(state, faction, from, to, count): void                             // shared verb
  placeUpTo(state, faction, clearing, piece, n): number                   // Rule: Pieces — place max possible; caps at supply
  removePieces(state, clearing, pieceIds): LogEntry[]                    // Rule: Battle 4 — +1 VP per enemy building/token; emits warriors.removed

factions/
  Ctx                  { map, rng, emit(signal), hooks: RuleHooks }     // passed to every apply; emit = SignalBus
  abstract Faction {
    readonly id: FactionId
    setup(state, ctx): void
    steps: Record<Phase, Step[]>                                          // Marquise: birdsong ['wood'], daylight ['craft','actions'], evening ['draw','discard']
    autoActions(state, phase, step): Action[]                            // e.g. Marquise birdsong wood
    legalActions(state, ctx): ActionSpec[]                               // + ctx.grantedActions() from cards
    validate(state, action, ctx): void                                   // throws RuleError
    apply(state, action, ctx): LogEntry[]                                // emits signals, uses ctx.hooks
    endTurn(state): void                                                 // reset used flags, scratch
  }
  Marquise | Eyrie | Alliance | Vagabond ; FACTIONS registry
  Vagabond             THIEF_START_ITEMS = ['boot','torch','tea','sword']; VagabondBoard has satchel/tracks only — no `character` field
  registry             GP1 only Marquise; Eyrie GP2, Alliance GP3, Vagabond GP4. Faction instances are stateless — one class serves any number of seats.

game/
  class Game {
    static create({ seed }): Game                                        // status 'waiting', no players
    static replay(seed, actions): Game                                   // deterministic rebuild (joins included)
    state; history: Action[]; log: LogEntry[]
    join(playerId): ActionResult                                         // seat = players.length; faction = state.factions[seat]; 4th → start()
    private start(): void                                                // Rule: Setup 1–7 in order: vp=0 → hands(3) → ruins → itemSupply → factions A→D → 'playing'
    legalActions(): ActionSpec[]                                         // waiting → [join]; pending → resolver; else faction
    apply(action): ActionResult                                          // validate → apply → checkWin (30 VP, tie → currentSeat) → advance/auto
    undo(): void                                                         // replay(history[:-1])
  }
```

**Web (`backend/web/src`)**
```
store/GameStore        Map<id, Game>
routes/games.ts        POST /games (lobby) · POST /games/:id/join { playerId } · GET /games · GET /games/:id
                       GET /games/:id/actions · POST /games/:id/actions
                       GET /games/:id/log · POST /games/:id/undo
                       GET /games/:id/map.svg                                  // toSvg(state) for quick eyeballing
routes/map.ts          GET /map/fall · GET /map/fall/layout                    // static graph + coords for frontend
middleware/errors.ts   RuleError → 400 { code, detail }; 404 unknown id
```

**CLI (`frontend/cli/src`)**
```
api/client.ts          createGame, join, getGame, getActions, act, getLog, undo
commands/new|join|show|actions|act|log|undo
commands/map.ts        print toAscii(state) — pieces per clearing at fixed positions
commands/auto.ts       create → join ×N (N = factions.length) → random legal action loop until winner/N turns; fails on 5xx or invalid state
```

### Files to change
- `lib/src/**`
- `backend/web/src/store/**`, `routes/**`, `middleware/**`, `index.ts`
- `frontend/cli/**`
- `resources/rules/root-base-rules.md` — source of truth; only change = fill board-track gap (Phase 0)
- `AGENTS.md` — rule-citation convention (done)

### Test plan
- Test names quote the rule line they cover (e.g. `it('Rule: Battle 4 — victim removes warriors before buildings')`).
- `lib` vitest: map graph (12 clearings, adjacency symmetric, rivers ⊄ paths, every id has layout coord), svg/ascii render snapshot, E&P deck (54 copies, 14 bird/14 fox/13 mouse/13 rabbit, 5 ambush, 4 dominance), Deck, ruler tie-break, queries, lobby (join order → faction, join beyond factions.length rejected, last join starts), each Marquise action happy+error, phase/step advance, pending-event gating, signal bus (dispatch order, listener mutates state, hooks fold), each Phase 7b card effect, `replay` reproduces state, undo, 30 VP win.
- `web`: build; curl create → join ×N → actions → act → log → undo → 400 illegal.
- `cli`: `auto --turns 50` against live web. Gate per grand phase; every later GP re-runs earlier GP factions via `--factions` (regression).
- lobby: join beyond `factions.length` rejected; 2p strips dominance, 3p+ keeps.
- GP2–4: each faction action happy+error path per rules bullet; Eyrie turmoil; Alliance outrage both triggers + base removal; Vagabond item damage/capacity, Hostile/Infamy.
- Every commit: `pnpm -r typecheck`.

### Commit plan

## GP1 — 2× Marquise, opposite corners (Phases 0–9)

**Phase 0 — scaffolding + rules gap**
- `chore(lib): add vitest` — `lib/package.json`, `lib/vitest.config.ts`
- `chore(cli): bootstrap TypeScript package` — `frontend/cli/package.json`, `tsconfig.json`, `src/index.ts`
- `docs(rules): add Marquise board tracks` — `resources/rules/root-base-rules.md` (cost / VP / draw bonus per column, from reference sheets)
- `docs(rules): add Eyrie roost track VP` — same
- `docs(rules): add Alliance sympathy track cost/VP` — same

**Phase 1 — map (graph)**
- `chore(resources): add Fall board image` — `resources/assets/fall-map.jpg` (official Leder asset)
- `feat(lib): add Suit, Clearing, Path types` — `lib/src/map/types.ts`
- `feat(lib): add GameMap with adjacency` — `lib/src/map/GameMap.ts`
- `feat(lib): add Fall clearings and suits` — `lib/src/map/fall.ts`
- `feat(lib): add Fall paths and forests` — `lib/src/map/fall.ts`
- `feat(lib): add Fall rivers` — `lib/src/map/fall.ts` (Rule: Board > Rivers)
- `feat(lib): add Fall corners and opposite` — `lib/src/map/fall.ts` (corners[4], opposite(); test: opposite is involutive)
- `feat(lib): add Fall vagabondForest id` — `lib/src/map/fall.ts`
- `test(lib): cover Fall graph` — `lib/src/map/fall.test.ts`

**Phase 1b — map layout (UI only)**
- `feat(lib): add MapLayout types` — `lib/src/layout/types.ts`
- `feat(lib): add Fall layout coords` — `lib/src/layout/fall.ts` (x,y,r per clearing from image)
- `feat(lib): add toSvg map renderer` — `lib/src/layout/render/svg.ts`, test snapshot
- `feat(lib): add toAscii map renderer` — `lib/src/layout/render/ascii.ts`, test

**Phase 2 — core types**
- `feat(lib): add FactionId, Seat, Piece types` — `lib/src/pieces/types.ts` (owner = seat)
- `feat(lib): add Card and CardDef types` — `lib/src/cards/types.ts`
- `chore(lib): add gen:cards script from ep cards.json` — `lib/scripts/gen-cards.ts`, `lib/package.json`
- `feat(lib): add generated E&P card defs` — `lib/src/cards/ep.generated.ts` (46 defs; test: 54 copies, suit totals 14/14/13/13)
- `feat(lib): add EP_DECK expansion` — `lib/src/cards/epDeck.ts`, test
- `feat(lib): add Deck draw/discard` — `lib/src/cards/Deck.ts`, test (Rule: Cards — reshuffle; dominance → available)
- `feat(lib): add matchesSuit and bird wildcard` — `lib/src/cards/suit.ts`, test (Rule: Cards > Birds are wild, 3 bullets)
- `feat(lib): add Phase, Step, GameState types` — `lib/src/state/types.ts`
- `feat(lib): add setup constants` — `lib/src/state/constants.ts` (ITEM_SUPPLY, RUIN_ITEMS, HAND_LIMIT, STARTING_HAND, `DEFAULT_FACTIONS = ['marquise','marquise']`; Rule: Setup)
- `feat(lib): add MarquiseBoard type with supply` — `lib/src/state/boards.ts` (Rule: Pieces — limited; other boards in GP2–4)
- `feat(lib): add Event types` — `lib/src/events/types.ts`
- `feat(lib): add GameSignal types` — `lib/src/triggers/signals.ts`
- `feat(lib): add RuleHooks defaults` — `lib/src/triggers/hooks.ts`
- `feat(lib): add CardEffect type and empty registry` — `lib/src/triggers/effects.ts`
- `feat(lib): add SignalBus` — `lib/src/triggers/SignalBus.ts`, test (seat-order dispatch, no-op when no cards)
- `feat(lib): add Ctx type` — `lib/src/game/ctx.ts`
- `feat(lib): add Action and ActionSpec types` — `lib/src/actions/types.ts`
- `feat(lib): add LogEntry types` — `lib/src/log/types.ts`
- `feat(lib): add RuleError` — `lib/src/rules/RuleError.ts`
- `feat(lib): add Rng and SeededRng` — `lib/src/rules/Rng.ts`, test

**Phase 3 — queries + shared rules**
- `feat(lib): add ruler query with Eyrie tie-break` — `lib/src/queries/ruler.ts`, test (Rule: Board > Rule)
- `feat(lib): add warriors and pieces queries` — `lib/src/queries/pieces.ts`
- `feat(lib): add openSlots query` — `lib/src/queries/slots.ts`, test (Rule: Board > Slots; ruin counts)
- `feat(lib): add factionOf and seat helpers` — `lib/src/queries/seat.ts`
- `feat(lib): add canPlace query with Keep by owner` — `lib/src/queries/place.ts`, test (Rule: Marquise > The Keep; 4 keeps → 4 owners)
- `feat(lib): add canMove query` — `lib/src/queries/move.ts`, test (Rule: Move 1–3)
- `feat(lib): add connectedRuled query` — `lib/src/queries/connected.ts`, test
- `feat(lib): add woodReachable query` — `lib/src/queries/wood.ts`, test (Rule: Marquise > Build 3)
- `feat(lib): add canCraft query` — `lib/src/queries/craft.ts`, test (Rule: Craft 1–4 + no dup persistent)
- `feat(lib): add placeUpTo helper` — `lib/src/rules/place.ts`, test (Rule: Pieces — max possible)
- `feat(lib): add removePieces with VP` — `lib/src/rules/remove.ts`, test (Rule: Victory — +1 per building/token)

**Phase 4 — Marquise setup (1 or 2 seats)**
- `feat(lib): add abstract Faction and registry` — `lib/src/factions/Faction.ts`, `index.ts`
- `feat(lib): Marquise setup keep at corner` — `lib/src/factions/Marquise.ts`, test (Rule: Marquise > Setup 1–2; 1st cat `corners[0]`, 2nd cat `opposite`)
- `feat(lib): Marquise setup garrison all except opposite` — same, test (Setup 3 — rules-exact single-cat path)
- `feat(lib): Marquise 2-cat garrison keep+adjacent` — same, test (variant when 2 marquise seats; GP1 only)
- `feat(lib): Marquise setup buildings and tracks` — same, test (Setup 4–5: keep then adjacent by id via placeUpTo; leftmost empty)

**Phase 5 — Game core**
- `feat(lib): add TurnLog` — `lib/src/log/TurnLog.ts`
- `feat(lib): Game.create in waiting status` — `lib/src/game/Game.ts`, test (`factions` defaults DEFAULT_FACTIONS)
- `feat(lib): Game.join assigns factions[seat]` — same, test
- `feat(lib): Game.join rejects when full` — same, test (full = `factions.length`)
- `feat(lib): Game.start strips dominance for 2p` — same, test (Rule: Setup 3 — 2p removes 4 dominance)
- `feat(lib): Game.start deals hands, ruins, item supply` — same, test (Rule: Setup 2–5, in order)
- `feat(lib): Game.start runs faction setups by seat` — same, test (Rule: Setup 7; GP1 = 2 cats)
- `feat(lib): Game.legalActions delegates` — same
- `feat(lib): Game.apply endPhase with steps` — same, test
- `feat(lib): Game.apply runs autoActions` — same, test
- `feat(lib): Game.apply gates on pending event` — same, test
- `feat(lib): Game emits phase.start/end signals` — same, test (spy listener)
- `feat(lib): Game merges granted actions into legalActions` — same, test
- `feat(lib): Game win check 30 VP with tie-break` — same, test (Rule: Victory — immediate; tie → current turn)
- `feat(lib): Game.replay and undo` — same, test
- `feat(lib): export public API` — `lib/src/index.ts`

**Phase 6 — Marquise turn**
- `feat(lib): Marquise birdsong wood autoAction` — `Marquise.ts`, test (Rule: Marquise > Birdsong; capped by wood supply)
- `feat(lib): Marquise daylight steps craft/actions` — same (Rule: Marquise > Daylight 1–2)
- `feat(lib): Marquise action budget` — same, test (3 actions)
- `feat(lib): Marquise spendBird extra action` — same, test (Daylight 2: +1 per bird, outside an action)
- `feat(lib): Marquise recruit once per turn` — same, test (placeUpTo per recruiter)
- `feat(lib): add shared move rule` — `lib/src/rules/move.ts`, test (Rule: Move)
- `feat(lib): Marquise march` — `Marquise.ts`, test (up to 2 moves)
- `feat(lib): Marquise build with wood payment` — same, test (Rule: Marquise > Build 1–4)
- `feat(lib): Marquise overwork` — same, test (card matches sawmill clearing, bird ok)
- `feat(lib): Marquise craft via workshops` — same, test (Rule: Craft; emits craft.item / craft.persistent)
- `feat(lib): Marquise evening draw` — same, test (Rule: Evening — 1 + draw bonus)
- `feat(lib): Marquise evening discard to hand limit` — same, test (discard action while hand > 5)
- `feat(lib): Marquise endTurn resets used flags` — same, test

**Phase 7 — Battle event (cat vs cat)**
- `feat(lib): add battle event resolver skeleton` — `lib/src/events/battle.ts`
- `feat(lib): battle ambush and foil stages` — same, test (Rule: Battle 1; end if no attackers)
- `feat(lib): battle roll stage` — same, test (Rule: Battle 2; max hits = warriors)
- `feat(lib): battle effects stage with defenseless` — same, test (Rule: Battle 3; hooks.extraHits)
- `feat(lib): battle removal stages by victim` — same, test (Rule: Battle 4; warriors first; VP)
- `feat(lib): Marquise battle action opens event` — `Marquise.ts`, test
- `feat(lib): battle emits battle.start/hits/end signals` — `events/battle.ts`, test
- `feat(lib): pending as FIFO queue` — `Game.ts`, test (removal may enqueue several events)
- `feat(lib): add fieldHospital event resolver` — `lib/src/events/fieldHospital.ts`, test (Rule: Marquise > Field Hospitals; pay matching card or decline; bird ok)
- `feat(lib): removePieces enqueues fieldHospital` — `rules/remove.ts`, test (only if victim still has keep)

**Phase 7b — first card effects (one per flavour, proves the bus)**
- `feat(lib): Master Engravers listener` — `lib/src/effects/masterEngravers.ts`, test (+1 VP on craft.item)
- `feat(lib): Murine Broker listener` — `lib/src/effects/murineBroker.ts`, test (other player crafts → draw)
- `feat(lib): Boat Builders hook` — `lib/src/effects/boatBuilders.ts`, test (rivers adjacent for owner)
- `feat(lib): Soup Kitchens hook` — `lib/src/effects/soupKitchens.ts`, test (tokens ×2 for rule)
- `feat(lib): Fox Partisans battle hook` — `lib/src/effects/partisans.ts`, test (extra hit + discard)
- `feat(lib): Swap Meet granted action` — `lib/src/effects/swapMeet.ts`, test (once per Birdsong)
- remaining E&P persistents = follow-up PRs, same pattern

**Phase 8 — web API**
- `feat(web): add GameStore` — `backend/web/src/store/GameStore.ts`
- `feat(web): add RuleError middleware` — `middleware/errors.ts`, `index.ts`
- `feat(web): POST /games creates lobby` — `routes/games.ts` (body `{ factions? }` → `Game.create`; 400 on unknown faction)
- `feat(web): POST /games/:id/join` — same
- `feat(web): GET /games, GET /games/:id` — same
- `feat(web): GET /games/:id/actions` — same
- `feat(web): POST /games/:id/actions` — same
- `feat(web): GET /games/:id/log` — same
- `feat(web): POST /games/:id/undo` — same
- `feat(web): GET /games/:id/map.svg` — same
- `feat(web): GET /map/fall and layout` — `routes/map.ts`

**Phase 9 — CLI**
- `feat(cli): add API client` — `frontend/cli/src/api/client.ts`
- `feat(cli): new command with --factions` — `commands/new.ts`, `index.ts`
- `feat(cli): join command` — `commands/join.ts`
- `feat(cli): show command` — `commands/show.ts`
- `feat(cli): map ascii command` — `commands/map.ts`
- `feat(cli): actions command` — `commands/actions.ts`
- `feat(cli): act command` — `commands/act.ts`
- `feat(cli): log and undo commands` — `commands/log.ts`, `commands/undo.ts`
- `feat(cli): auto random-agent command` — `commands/auto.ts`
- `docs: usage for lib/web/cli` — `README.md`

**GP1 gate**: `auto --turns 50` with 2 cats reaches a 30 VP winner or clean turn cap, zero 5xx, `replay` matches, no dominance in deck.

## GP2 — Marquise vs Eyrie (Phase 10)

**Phase 10 — Eyrie**
- `feat(lib): add EyrieBoard type` — `state/boards.ts` (leader, decree columns, roostTrack, supply 20)
- `feat(lib): Eyrie setup roost opposite Marquise` — `factions/Eyrie.ts`, test (Rule: Eyrie > Setup 1–2, 5: roost + 6 warriors at `opposite(corners[0])`, 6 on track)
- `feat(lib): Eyrie setup Builder viziers` — same, test (Setup 3–4: Recruit + Move columns)
- `feat(lib): Eyrie birdsong Emergency Orders` — same, test (Birdsong 1: empty hand → draw 1)
- `feat(lib): Eyrie addToDecree action` — same, test (Birdsong 2: 1–2 cards, ≤1 bird, any column)
- `feat(lib): Eyrie A New Roost` — same, test (Birdsong 3: no roosts → fewest-warriors clearing + 3)
- `feat(lib): Eyrie craft via roosts before decree` — same, test (Daylight 1; Disdain for Trade → 1 VP; Builder ignores)
- `feat(lib): Eyrie decree cursor state` — same (Daylight 2: column left→right, card any order within column; `turnScratch.decree { column, remaining }`)
- `feat(lib): Eyrie decree recruit` — same, test (roost clearing of suit; bird = any)
- `feat(lib): Eyrie decree move` — same, test (from clearing of suit with ≥1 warrior)
- `feat(lib): Eyrie decree battle` — same, test (clearing of suit; reuses battle event)
- `feat(lib): Eyrie decree build` — same, test (ruled, of suit, no roost, open slot)
- `feat(lib): Eyrie turmoil on impossible decree` — same, test (Turmoil 1–4: −1 VP per bird incl. viziers; purge; depose → flip leader, all face-up if none; rest → Evening)
- `feat(lib): Eyrie evening roost VP and draw` — same, test (Evening 1–2; rightmost empty roost space)
- `feat(lib): Lords of the Forest tie-break by seat faction` — `queries/ruler.ts`, test (already designed; now real)
- `feat(lib): DEFAULT_FACTIONS = marquise, eyrie` — `state/constants.ts`, test (2p, dominance still stripped)
- `feat(cli): auto plays decree actions` — `commands/auto.ts` (random over addToDecree/decree params)

**GP2 gate**: `auto --turns 50` default ends cleanly; `--factions marquise,marquise` still passes.

## GP3 — Marquise, Eyrie, Alliance (Phase 11)

**Phase 11 — Woodland Alliance**
- `feat(lib): add AllianceBoard type` — `state/boards.ts` (supporters, officers, bases, sympathyTrack, supply 10)
- `feat(lib): Alliance setup` — `factions/Alliance.ts`, test (Rule: Alliance > Setup 1–4; supporters drawn after hands)
- `feat(lib): supporters capacity` — same, test (Abilities: no base → max 5, overflow discarded)
- `feat(lib): Alliance revolt action` — same, test (Birdsong Revolt 1–3: 2 matching supporters; remove all enemies +VP; base; warriors = # sympathetic of suit; +1 officer)
- `feat(lib): Alliance spreadSympathy action` — same, test (Birdsong Spread 1–3: adjacent or any if none; cost from track)
- `feat(lib): Martial Law surcharge` — same, test (+1 if ≥3 enemy warriors of one player)
- `feat(lib): Alliance craft via sympathy` — same, test
- `feat(lib): Alliance mobilize and train` — same, test (Daylight; train needs base on map of card suit)
- `feat(lib): Alliance military ops budget` — same, test (Evening 1: ≤ officers)
- `feat(lib): Alliance ops move/battle/recruit` — same, test
- `feat(lib): Alliance op organize` — same, test (remove warrior → sympathy → VP)
- `feat(lib): Guerrilla War battle hook` — `events/battle.ts`, test (Abilities: defender takes higher die)
- `feat(lib): add outrage event resolver` — `events/outrage.ts`, test (Outrage 1–2: give matching card or reveal hand → Alliance draws)
- `feat(lib): enqueue outrage on sympathy removal` — `rules/remove.ts`, test
- `feat(lib): enqueue outrage on move into sympathetic` — `rules/move.ts`, test
- `feat(lib): base removal cleanup` — `rules/remove.ts`, test (Abilities: discard matching supporters incl. birds; half officers up; cap 5)
- `feat(lib): DEFAULT_FACTIONS adds alliance` — `state/constants.ts`, test (3p → dominance kept in deck; seat order clockwise ×3)
- `feat(cli): auto plays alliance actions` — `commands/auto.ts`

**GP3 gate**: `auto --turns 50` 3p default ends cleanly; GP1 + GP2 `--factions` regressions pass; dominance present in 3p deck.

## GP4 — all four factions (Phase 12)

**Phase 12 — Vagabond (Thief)**
- `feat(lib): add VagabondBoard and Item types` — `state/boards.ts` (satchel, tracks tea/coin/bag, damaged, relationships)
- `feat(lib): Vagabond setup pawn and Thief items` — `factions/Vagabond.ts`, test (Rule: Vagabond > Setup 2, 5, 6; quests deferred)
- `feat(lib): seed ruin items at start` — `Game.ts`, test (Setup 4: shuffle RUIN_ITEMS under ruins)
- `feat(lib): pawn excluded from rule and removal` — `queries/ruler.ts`, `rules/remove.ts`, test (pawn ≠ warrior; cannot be removed)
- `feat(lib): item exhaust/refresh helpers` — `factions/vagabond/items.ts`, test (Items: exhaust; track → satchel on exhaust)
- `feat(lib): Vagabond birdsong refresh` — `Vagabond.ts`, test (Birdsong 1: 2×face-up tea + 3)
- `feat(lib): Vagabond slip` — same, test (Birdsong 2: free, forest ok, ignores rule)
- `feat(lib): Vagabond move with boots` — same, test (Daylight Move: Nimble; +1 boot if Hostile present; no move into forest)
- `feat(lib): Vagabond takes hits as item damage` — `events/battle.ts`, test (Items: damage 1 per hit; max hits = undamaged swords; defenseless if none)
- `feat(lib): Vagabond battle action` — `Vagabond.ts`, test (1 sword)
- `feat(lib): Vagabond explore` — same, test (1 torch; take ruin item; +1 VP; last item removes ruin)
- `feat(lib): Vagabond aid` — same, test (any item; give matching card; may take crafted item)
- `feat(lib): Vagabond strike` — same, test (1 crossbow; warrior else other piece)
- `feat(lib): Vagabond repair` — same, test (1 hammer)
- `feat(lib): Vagabond craft with hammers` — same, test (all hammers = clearing suit; item → satchel/track)
- `feat(lib): Thief steal special` — same, test (1 torch; random card from player in clearing; uses rng)
- `feat(lib): Vagabond evening rest/draw/discard/capacity` — same, test (Evening 1–4; 6 + 2×bags; excess removed from game)
- `feat(lib): relationships Allied track` — `factions/vagabond/relations.ts`, test (Improve: aids per turn; VP on advance; Allied bonuses)
- `feat(lib): relationships Hostile and Infamy` — same, test (remove their warrior → Hostile; +1 VP per Hostile piece removed in battle on own turn, except the flipping warrior)
- `feat(lib): vagabondDamage event on full clear` — `events/vagabondDamage.ts`, test (Rule: Vagabond — full removal → damage 3; e.g. Revolt)
- `feat(lib): Vagabond ignores dominance win` — `Game.ts` (Dominance/coalitions: cannot activate; coalition deferred)
- `feat(lib): DEFAULT_FACTIONS = marquise, eyrie, alliance, vagabond` — `state/constants.ts`, test (setup letters A→D; 4p)
- `feat(cli): auto plays vagabond actions` — `commands/auto.ts` (item choices, aid targets)
- `ci: fix test` · `chore: prettier`

**GP4 gate**: `auto --turns 50` 4p default ends cleanly; GP1–GP3 `--factions` regressions pass.
