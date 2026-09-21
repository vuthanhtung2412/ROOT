### Goal
- Add **Riverfolk Expansion** factions to portable Root engine in `/lib`: **Lizard Cult** + **Riverfolk Company**.
- Same architecture as base grand plan (`grand-plan-toward-base-game.md`): pure TS, lossless `GameSnapshot`, pending `Event` FIFO, signals/hooks, seat-owned pieces, CLI `auto` gate.
- Delivered in **2 grand phases** after base GP1–GP4 (or against marquise+eyrie min). Each GP = playable mix proving new faction:

| Grand phase | Example `factions` | Players | Proves |
|---|---|---|---|
| **GP5** | `['marquise','eyrie','lizard']` | 3 | Lost Souls, Outcast/Hated, gardens/Pilgrims, reveal rituals, Revenge acolytes, conspiracies |
| **GP6** | `['marquise','eyrie','lizard','riverfolk']` | 4 | Funds/Payments/Committed, public hand, Swimmers, trade posts, buy-services pending, Riverboats, Mercenaries |

### Recommended play mixes (Riverfolk Learning to Play scenarios)

Source: Riverfolk expansion **Scenarios** chart (torch = recommended). Seat order in `factions` arrays = join / setup A→D order (Marquise first when present).

**3 players — recommended torch mixes**

| Mix | `factions` | Reach | Notes |
|---|---|---|---|
| Eyrie + Cat + Woodland | `['marquise','eyrie','alliance']` | 20 | Base 3p; GP3 gate |
| Eyrie + Cat + Riverfolk | `['marquise','eyrie','riverfolk']` | 22 | First Riverfolk prove mix |
| Eyrie + Cat + Lizard | `['marquise','eyrie','lizard']` | 19 | GP5 default / gate |
| Cat + Lizard + Riverfolk | `['marquise','lizard','riverfolk']` | 17 | Expansion-only 3p (no Eyrie) |

**4 players — rule**

> Take any three-player mix and add any remaining one.

Examples from the four 3p mixes above (any leftover faction from {eyrie, alliance, lizard, riverfolk, vagabond} that is not already in the trio):

| From 3p mix | Add | Example `factions` |
|---|---|---|
| marquise, eyrie, alliance | riverfolk **or** lizard **or** vagabond | `['marquise','eyrie','alliance','riverfolk']` |
| marquise, eyrie, riverfolk | lizard **or** alliance **or** vagabond | `['marquise','eyrie','riverfolk','lizard']` |
| marquise, eyrie, lizard | riverfolk **or** alliance **or** vagabond | `['marquise','eyrie','lizard','riverfolk']` ← GP6 default |
| marquise, lizard, riverfolk | eyrie **or** alliance **or** vagabond | `['marquise','lizard','riverfolk','eyrie']` |

CLI / CI: every GP5–GP6 gate re-runs **all four** 3p torch mixes (where factions exist) plus at least one 4p derived from the GP under test.

- **Not in this plan:** Mechanical Marquise, second Vagabond, hirelings, landmarks, Winter/Lake/Mountain maps.
- Pieces still owned by **seat**. Funds on Riverfolk board are warriors tagged by **owner seat** (buyer supply → Payments).
- Setup stays deterministic where Law is flexible (fixed corner/outcast/prices — house rules below).

### Prerequisites (from base grand plan)
- **Hard:** GP1–GP2 (Marquise + Eyrie) — already in tree.
- **Strongly preferred before GP6 Mercenaries polish:** GP3 Alliance (Outrage + Guerrilla) + GP4 Vagabond (item pay for services; Hostile when merc dies vs VB).
- **GP5 alone** can ship vs `marquise,eyrie` without Alliance/Vagabond.
- If Alliance/Vagabond still stubs when starting GP5: keep regression `--factions marquise,eyrie`; wire lizard/riverfolk registry entries; leave alliance/vagabond stubs until base plan finishes.

### Rules source of truth

SoT = `resources/rules/Law_of_Root.pdf` (+ `Law_of_Root.md`) §§10–11.  
Implementable summary (non-SoT) = extend `resources/notes/root-base-rules.md` (new Lizard + Riverfolk sections).  
Faction board art (track numbers) = `resources/reference/character-boards/lizard-cult-front.webp`, `riverfolk-company-front.webp`.  
Token art already on disk under `resources/reference/faction-tokens/{lizard-cult,riverfolk-company}/`.

Every rule-bearing commit names its section. Code cites `// Rule: Section > Subsection`. Tests named after rule lines.

**Rules → engine mapping (specifics this plan must honour)**

| Rule (section) | Engine |
|---|---|
| 10.2.1 Crafting — gardens match Outcast suit, Evening | Lizard evening step `craft`; `canCraft` uses gardens of Outcast suit as craft pieces |
| 10.2.2 Hatred of Birds — birds not wild for rituals | `matchesSuitForRitual(card, suit)` — bird ≠ wild; only Sacrifice uses bird |
| 10.2.3 Revenge — defending warrior removed → Acolytes | `removePieces` / battle removal: if victim lizard + defending → `board.acolytes++` instead of supply |
| 10.2.4 Pilgrims — any garden → rule; beats Lords of the Forest | `ruler()`: if clearing has lizard garden → lizard seat wins rule **before** Eyrie tie-break |
| 10.2.5 Fear of the Faithful — garden removed → random discard | `removePieces` on garden → random card from lizard hand → Lost Souls (via discard router); **noop if hand empty** |
| 10.2.6 Lost Souls — **all** spent/discarded cards (incl. dominance) | `GameState.lostSouls: Card[]` when lizard in roster; `Deck.discard` / spend paths route here instead of discard; birds ignored for Outcast count; pile **always public** (CLI/API inspect) |
| 10.3 Setup — 25 warriors; corner + garden + adj; Outcast; 14 gardens on tracks | `Lizard.setup`; house: corner = first free of `FALL.corners` prefer `opposite(marquise keep)`; Outcast = fox; acolytes start `0` |
| 10.4.1–2 Adjust Outcast → discard Lost Souls | Birdsong auto/steps: majority non-bird suit → Outcast; same suit → Hated; tie → stay + flip Hated if not; then Lost Souls → discard (dominance → `dominanceAvailable`) |
| 10.4.3 Conspiracies — Crusade / Convert / Sanctify; Hated −1 cost | Costs 2/2/3 (−1 if hated); Outcast clearings only. **Crusade XOR:** (a) battle in Outcast clearing **or** (b) move ≥1 warrior from Outcast then optional battle at dest. **Convert/Sanctify** go through `removePieces` (Outrage, Hostile, VP for building, etc.). Sanctify garden = **Outcast suit** (house; see below) |
| 10.5 Daylight — reveal → one ritual per card | **Rituals only** (no free move/battle). `revealed: Card[]`; rituals `buildGarden` / `recruit` / `score` / `sacrifice`; Score once/suit/turn; Score spends card → Lost Souls |
| 10.6 Evening — return revealed → craft → draw+discard | steps `['returnRevealed','craft','draw','discard']` |
| 11.2.1 Crafting — commit funds onto Trade Posts track spaces | Place fund warriors on **empty** track cells matching cost suits (not Committed box). Those cells **stay occupied until next Gather Funds** (11.4.3), then free again |
| 11.2.2 Swimmers — rivers as paths; ignore rule for river moves | `hooks.isAdjacent` always true for river edges for riverfolk; `canMove` skips rule check when edge is river |
| 11.2.3 Public Hand | API/CLI views: riverfolk `hand` always visible; random-take: shuffle face-down then restore public |
| 11.2.4 Funds — warriors in Funds box | `RiverfolkBoard.{payments,funds,committed}: FundPiece[]` where `FundPiece = { owner: Seat }` |
| 11.2.5 Trade Posts + Trade Disruption | Token `tradePost` + suit; place scores track VP; remove → ⌈half of **Funds box only**⌉ gone (not Payments/Committed) + post **out of game** (not supply) |
| 11.2.6 Buying Services — start of **other** Birdsong | `Event.buyServices { buyer }` pushed when advancing to that seat’s Birdsong if riverfolk in game; buyer may buy/skip until done or `endBuyServices` |
| 11.2.6 I–III Cost / count / Vagabond pay | Cost from services track; quota = 1 + clearings with trade post + buyer piece; VB exhausts items → riverfolk places **own** warriors into Payments |
| 11.2.7 Services — Hand Card / Riverboats / Mercenaries | Actions under buyServices; Riverboats → turn flag + `hooks.isAdjacent`; Mercenaries → buyer treats RF warriors as own for rule+battle Daylight/Evening (not vs RF; cannot move them). **Hit split (Law verbatim):** odd hits remove owned (not RF) warriors first; owned buildings/tokens only if clearing has **no** warriors including RF. VB cannot buy Mercenaries; Field Hospitals **not** on RF warriors; Hostile from merc death → **buyer** |
| 11.3 Setup — 15 warriors; 4 on river clearings; 9 posts on tracks; 3 in Payments; service markers | House: river clearings = lowest ids touching river; prices all start at 2 |
| 11.4 Birdsong — Protectionism → Dividends → Gather Funds | Auto/steps: empty Payments → place **2 RF warriors from supply** into Payments; if any post on map score ⌊funds/2⌋ VP (Funds box only); **all** warriors on faction board (Payments + Committed + craft-track) → Funds |
| 11.5 Daylight — commit/spend funds actions | `commitFund`/`spendFund` helpers; move/battle/draw commit 1; recruit spend 1 (river clearing); establish: clearing must have a ruler + ≥2 Funds of that ruler’s owner; Export craft option |
| 11.6 Evening — discard → set costs | steps `['discard','setCosts']` (no Evening draw); `setServiceCost { service, cost }` |
| Interpretation — ownership never changes | Mercenaries stay `owner: riverfolkSeat`; “treat as own” is query/hook only |
| Seat count — Reach up to 6p | Widen `Seat` to `0 \| 1 \| 2 \| 3 \| 4 \| 5` before 5p mixes (GP6 optional 5–6 later) |

**Gap in rules doc** — Law omits board numbers. From faction boards (verify in Phase 0 commits):

| Track | Values (from `character-boards/*-front.webp`) |
|---|---|
| Lizard Gardens score (rightmost empty column) | columns left→right **+0, +2, +3, +4**; draw-bonus icon on **+2** column (one per suit row) |
| Lizard gardens supply | **15** total (5/suit); setup places 1 → **14** on tracks |
| Riverfolk Trade Posts | **3×3** (fox/rabbit/mouse); each uncovered space **+2 VP** |
| Riverfolk Services costs | each service marker on **1 \| 2 \| 3 \| 4** |

**Sanctify garden suit (house):** `Law_of_Root.md` 10.4.3 III says “matching garden”; rootdatabase / latest PDF prefer **Outcast suit**. House = place garden of **Outcast** suit. On normal maps Outcast clearing ⇒ same suit as Outcast; **Lost City** landmark (deferred) can diverge — revisit then.

**Learned from base plan (reuse, don’t reinvent)**

| Pattern | Apply to |
|---|---|
| Pending Event FIFO (`outrage`, `fieldHospital`) | `buyServices` at foreign Birdsong; optional `chooseOutcast` if setup not house-fixed |
| `hooks.isAdjacent` (Boat Builders) | Swimmers (always) + Riverboats (buyer turn) |
| `hooks.ruleWeight` / ruler tie-break | Pilgrims short-circuit; Mercenaries “treat as own for rule” |
| Battle removal + `warriors.removed` | Revenge; Mercenaries hit split; Hostile attribution to buyer not RF |
| `placeUpTo` / supply caps | gardens, trade posts, acolytes return to supply on spend |
| Faction registry + `DEFAULT_FACTIONS` growth | Add `'lizard' \| 'riverfolk'`; GP5/GP6 bump defaults for playtest |
| ActionSpecs not full combo enum | ritual/conspiracy/service param domains |

### Approach
- Keep `GameState` JSON-serializable. No `Map`/`Set`/class in snapshot.
- **Lost Souls** lives on `GameState` (shared pile), not only on lizard board — any seat’s spend/discard routes there while `factions.includes('lizard')`. Always visible in snapshot/CLI (inspect anytime).
- **Buy services** = pending event whose `actor` is the **buyer** (non-current relative to riverfolk), same as Outrage/Field Hospital.
- **Funds** = array of `{ owner: Seat }` on riverfolk board boxes; spend returns warrior to `owner`’s supply (RF owner → RF supply). Trade Disruption halves **Funds box only**.
- **Craft-track occupancy** = fund warriors on empty Trade Posts track cells block those cells for further craft until Gather Funds clears them to Funds.
- **Revealed cards** = lizard Daylight: move hand → `board.revealed`; Evening returns unless Score spent them. Daylight = rituals only (move/battle only via Crusade).
- **Mercenaries / Riverboats** = `turnScratch` flags on **buyer** seat for that turn only; cleared at buyer turn end.
- **DEFAULT_FACTIONS**: after GP5 `['marquise','eyrie','lizard']` (torch 3p); after GP6 `['marquise','eyrie','lizard','riverfolk']` (that 3p + riverfolk). Other torch 3p / 4p-from-3p mixes via `--factions` (see Recommended play mixes). Alliance/Vagabond remain opt-in until base GP3–4 done.
- Fixed constants / house rules (document in rules doc):
  - Seat 0 starts (same as base).
  - Lizard start corner: prefer diagonally opposite Marquise keep; else first free `FALL.corners`.
  - Lizard setup Outcast = `fox`.
  - Riverfolk setup: 4 warriors on lowest-id river-touching clearings; all three service prices = `2`.
  - Sanctify places garden of **Outcast** suit (see Sanctify house note above).
  - Fear of the Faithful with empty hand = noop.
  - Dominance take/activate / coalitions / quests still deferred (base backlog).
  - Mechanical Marquise deferred.

### OOP design deltas (`lib/src`)

```
pieces/
  FactionId           += 'lizard' | 'riverfolk'
  Seat                = 0 | 1 | 2 | 3 | 4 | 5          // widen before 5p; 4p enough for GP5–GP6 default
  BuildingType        += 'garden'                        // garden carries suit: Building & { type:'garden', suit: Suit }
  TokenType           += 'tradePost'                     // Token & { type:'tradePost', suit: Suit }

state/
  GameState           += lostSouls: Card[]               // [] if no lizard; else active pile
  LizardBoard         {
                        kind: 'lizard'
                        supply: { warriors: 25 }
                        acolytes: number
                        outcast: { suit: Suit, hated: boolean }
                        gardensTrack: Record<Suit, { placed: number }>   // tokens still on board tracks
                        revealed: Card[]                                 // Daylight reveals
                        scoredSuitsThisTurn: Suit[]
                      }
  RiverfolkBoard      {
                        kind: 'riverfolk'
                        supply: { warriors: 15 }
                        payments: FundWarrior[]
                        funds: FundWarrior[]
                        committed: FundWarrior[]
                        tradePostsTrack: Record<Suit, { placed: number }>
                        services: { handCard: 1|2|3|4, riverboats: 1|2|3|4, mercenaries: 1|2|3|4 }
                        tradePostsRemovedFromGame: number                // optional audit
                      }
  FundWarrior         { owner: Seat }                    // physical warrior in a box
  turnScratch         += {
                        riverboatsBuyer?: Seat           // until end of that seat’s turn
                        mercenariesBuyer?: Seat
                        servicesBoughtThisBirdsong?: number
                      }

boards/ constants (Phase 0 from sheets)
  LIZARD_GARDEN_SCORE_VP     = [0, 2, 3, 4] as const     // by empty-column index left→right
  LIZARD_GARDEN_DRAW_COLUMN  = 1                         // +2 column index
  RIVERFOLK_TRADE_POST_VP    = 2                         // every space
  RIVERFOLK_SERVICE_COSTS    = [1, 2, 3, 4] as const

events/
  Event               += { type:'buyServices', buyer: Seat, bought: number, quota: number }
                      // optional setup: { type:'chooseOutcast', seat } if not house-fixed

actions/  (additions)
  // Lizard
  | { type:'crusade', mode: 'battle', clearing }
  | { type:'crusade', mode: 'move', from, to, count, battleAtDestination?: boolean }
  | { type:'convert', clearing, enemyPieceId }   // via removePieces + place
  | { type:'sanctify', clearing, enemyBuildingId } // via removePieces; garden suit = Outcast
  | { type:'revealRitual', cardId, ritual: 'build'|'recruit'|'score'|'sacrifice', clearing? }
  // Riverfolk daylight
  | { type:'rfMove', ... } | { type:'rfBattle', ... } | { type:'rfDraw' }
  | { type:'rfCraft', cardId, export?: boolean }
  | { type:'rfRecruit', clearing }
  | { type:'establishTradePost', clearing }
  | { type:'setServiceCost', service, cost }
  // buyServices resolutions
  | { type:'buyService', service: 'handCard'|'riverboats'|'mercenaries', cardId? }
  | { type:'endBuyServices' }

queries/
  ruler               // Pilgrims first; then mercenaries treat-as-own; then Eyrie Lords
  isRiverAdjacent(a,b)
  canMove             // Swimmers / Riverboats ignore rule on river edges
  tradePostAccess(buyer) → quota
  fundsOfOwner(board, owner) → indices in funds box

rules/
  discardOrSpend(card) → lostSouls if lizard present else discard/dominanceAvailable
  removePieces        // Revenge; Fear of Faithful; Trade Disruption; merc Hostile attribution

factions/
  Lizard | Riverfolk ; registry
  FACTIONS.lizard / .riverfolk

triggers/hooks/
  isAdjacent          // Swimmers + Riverboats
  // merc rule: warriors of RF count for buyer in ruler() when flag set
```

**Web / CLI**
- No new routes required if `Action` / snapshot already generic.
- CLI `auto`: random over conspiracies/rituals; on `buyServices` pending, random buy/skip; riverfolk fund actions.
- Snapshot round-trip must include `lostSouls`, fund boxes, service prices, outcast.

### Files to change
- `lib/src/pieces/types.ts` — FactionId, Seat, BuildingType, TokenType (+ garden/tradePost suit fields)
- `lib/src/state/boards.ts`, `types.ts`, `constants.ts`
- `lib/src/cards/Deck.ts` — discard router → Lost Souls
- `lib/src/queries/ruler.ts`, `move.ts`, (+ river helpers)
- `lib/src/rules/remove.ts`, `move.ts`, discard helper
- `lib/src/events/types.ts`, `buyServices.ts`
- `lib/src/factions/Lizard.ts`, `Riverfolk.ts`, `index.ts`
- `lib/src/game/Game.ts` — birdsong enqueue buyServices; setup order
- `frontend/cli/src/commands/auto.ts`
- `resources/notes/root-base-rules.md` — Lizard + Riverfolk sections + house rules + track tables
- `AGENTS.md` — point SoT/build plan at this note alongside base grand plan

### Test plan
- Rule-named units for every bullet in mapping table (Lost Souls routing + public; Pilgrims vs Eyrie; Revenge only when defending; Fear empty-hand noop; Hatred of Birds; Crusade XOR modes; Hated cost −1; Score once/suit; Trade Disruption ⌈half Funds box⌉ only; craft-track occupied until Gather; buyServices quota; Mercenaries Law hit-split; establish needs ruler + 2 owner funds; VB cannot buy Mercenaries; Field Hospitals skip RF warriors).
- `toJSON`/`fromJSON` with lizard+riverfolk mid-turn (revealed cards, funds owners, pending buyServices).
- `pnpm -r typecheck` every commit.
- GP5 gate: torch 3p `marquise,eyrie,lizard` clean; GP1/GP2 regressions; when alliance exists also `marquise,eyrie,alliance`.
- GP6 gate: default 4p `marquise,eyrie,lizard,riverfolk` clean; all four torch 3p mixes that are buildable; at least one other 4p = (torch 3p + remaining); if Alliance/VB present, merc+item-pay cases.

### Commit plan

## Phase 0 — docs + types scaffolding

- `docs(rules): add Lizard Cult section` — `resources/notes/root-base-rules.md` (Law 10 summary + gardens track VP/draw from board)
- `docs(rules): add Riverfolk Company section` — same (Law 11 + trade post VP + service costs 1–4)
- `docs(rules): note riverfolk-lizard house rules` — setup corner/outcast/prices; Sanctify = Outcast suit; Fear empty-hand noop; Seat widen; Mech Marquise deferred
- `docs(plan): link expansion grand plan` — `AGENTS.md`
- `feat(lib): widen Seat to 0..5` — `pieces/types.ts` (+ call-site type fixes)
- `feat(lib): add lizard and riverfolk FactionId` — `pieces/types.ts`, `factions/index.ts` stubs throwing `NOT_IMPLEMENTED` until later (or mirror alliance stub → Marquise temporarily **avoid** — prefer explicit missing registry error)
- `feat(lib): garden building and tradePost token types` — `pieces/types.ts` (suit on piece)

## GP5 — Lizard Cult (Phases 13–14)

### Phase 13 — Lizard board, Lost Souls, Pilgrims, Revenge

- `feat(lib): add LizardBoard and garden track constants` — `state/boards.ts`
- `feat(lib): add lostSouls to GameState` — `state/types.ts`, `constants.ts`
- `feat(lib): route discard and spend to Lost Souls` — `cards/Deck.ts` (+ shared spend helper), test (Rule: 10.2.6; dominance → available only after Lost Souls discard step)
- `feat(lib): Pilgrims ruler short-circuit` — `queries/ruler.ts`, test (Rule: 10.2.4 overrides Lords of the Forest)
- `feat(lib): Revenge warriors to acolytes` — `rules/remove.ts`, test (only defender in battle)
- `feat(lib): Fear of the Faithful random discard` — `rules/remove.ts`, test (garden removed; empty hand noop)
- `feat(lib): Lizard setup warriors garden adjacent` — `factions/Lizard.ts`, test (Rule: 10.3.1–2)
- `feat(lib): Lizard setup Outcast and garden tracks` — same, test (10.3.3–4; house Outcast fox)
- `feat(lib): register Lizard faction` — `factions/index.ts`

### Phase 14 — Lizard turn (Birdsong → Evening)

- `feat(lib): Lizard adjust Outcast and purge Lost Souls` — `Lizard.ts`, test (10.4.1–2; Hated flip; tie case)
- `feat(lib): Lizard Crusade conspiracy` — same, test (10.4.3 I; Hated cost; battle XOR move-then-optional-battle)
- `feat(lib): Lizard Convert conspiracy` — same, test (10.4.3 II; replace via removePieces + place)
- `feat(lib): Lizard Sanctify conspiracy` — same, test (10.4.3 III; Outcast-suit garden house)
- `feat(lib): Lizard reveal and Build ritual` — same, test (10.5.1; Hatred of Birds)
- `feat(lib): Lizard Recruit and Sacrifice rituals` — same, test (10.5.2, 10.5.4)
- `feat(lib): Lizard Score ritual once per suit` — same, test (10.5.3; VP from track; card → Lost Souls)
- `feat(lib): Lizard evening return craft draw discard` — same, test (10.6.1–3; craft via Outcast gardens; draw bonuses)
- `feat(lib): DEFAULT_FACTIONS adds lizard` — `state/constants.ts` (`['marquise','eyrie','lizard']`)
- `feat(cli): auto plays lizard actions` — `commands/auto.ts`
- `ci: fix test`

**GP5 gate:** `auto --turns 50 --factions marquise,eyrie,lizard` (torch) ends cleanly; marquise/eyrie regressions pass; Lost Souls empties each lizard Birdsong; Pilgrims beats Eyrie in garden clearing.

## GP6 — Riverfolk Company (Phases 15–17)

### Phase 15 — Riverfolk board, Swimmers, funds, trade posts

- `feat(lib): add RiverfolkBoard and track constants` — `state/boards.ts`
- `feat(lib): Riverfolk setup river warriors and posts` — `factions/Riverfolk.ts`, test (11.3.1–5; house prices 2)
- `feat(lib): Swimmers river adjacency and move` — `queries/move.ts` + hooks, test (11.2.2; ignore rule on rivers)
- `feat(lib): Riverfolk birdsong Protectionism Dividends Gather` — `Riverfolk.ts`, test (11.4.1–3; Protectionism from supply; Gather clears craft-track)
- `feat(lib): fund commit and spend helpers` — `factions/riverfolk/funds.ts`, test (owner returns to correct supply)
- `feat(lib): Riverfolk move battle draw recruit` — `Riverfolk.ts`, test (11.5.1–2, 4–5)
- `feat(lib): Riverfolk craft onto trade post tracks` — same, test (11.5.3; Export → Payments; cells occupied until Gather)
- `feat(lib): Establish Trade Post with Garrison` — same, test (11.5.6; spend ruler’s funds; fail if no ruler / <2; +2 VP; matching suit post)
- `feat(lib): Trade Disruption on post removal` — `rules/remove.ts`, test (11.2.5 I; ⌈half Funds box⌉ only; post gone forever)
- `feat(lib): Riverfolk evening discard and setCosts` — `Riverfolk.ts`, test (11.6)
- `feat(lib): register Riverfolk faction` — `factions/index.ts`

### Phase 16 — Buying services (cross-player pending)

- `feat(lib): add buyServices event type` — `events/types.ts`
- `feat(lib): enqueue buyServices at foreign Birdsong` — `game/Game.ts`, test (11.2.6; not on riverfolk’s own Birdsong)
- `feat(lib): buyServices quota and payment` — `events/buyServices.ts`, test (1 + trade-post clearings with buyer pieces; warriors → Payments)
- `feat(lib): Hand Card service` — same, test (11.2.7 I; public hand pick)
- `feat(lib): Riverboats service` — same, test (11.2.7 II; buyer rivers-as-paths until turn end)
- `feat(lib): Public Hand random-take shuffle` — helper + test (11.2.3)
- `feat(cli): auto resolves buyServices` — `commands/auto.ts`

### Phase 17 — Mercenaries + DEFAULT + gates

- `feat(lib): Mercenaries treat as own for rule` — `queries/ruler.ts`, test (11.2.7 III; Daylight/Evening only; not vs Riverfolk)
- `feat(lib): Mercenaries battle hit split` — `events/battle.ts`, test (11.2.7 III.a Law: odd → owned warriors; bld/token only if no warriors incl. RF)
- `feat(lib): Mercenaries skip Field Hospitals` — `events/fieldHospital.ts` / remove, test (ownership unchanged)
- `feat(lib): Vagabond cannot buy Mercenaries` — `buyServices.ts`, test (11.2.7 III.b) — skip/xfail until GP4 VB exists
- `feat(lib): Vagabond pays services with items` — same, test (11.2.6 III) — skip until GP4
- `feat(lib): Hostile from merc death attributes to buyer` — relations hook when VB present
- `feat(lib): DEFAULT_FACTIONS adds riverfolk` — `state/constants.ts` (`['marquise','eyrie','lizard','riverfolk']`)
- `feat(cli): auto plays riverfolk fund actions` — `commands/auto.ts`
- `docs(plan): post-GP6 backlog` — Mech Marquise; 5–6p Reach mixes with Alliance/VB; hand-public API view flag; remaining E&P interactions
- `ci: fix test` · `chore: prettier`

**GP6 gate:** `auto --turns 50` 4p default `marquise,eyrie,lizard,riverfolk` clean (= torch 3p + riverfolk). Re-run torch 3p mixes: `marquise,eyrie,alliance` (if GP3), `marquise,eyrie,riverfolk`, `marquise,eyrie,lizard`, `marquise,lizard,riverfolk`. One more 4p from rule “3p + any remaining” (e.g. `marquise,eyrie,riverfolk,alliance`). When base GP3–4 present, optional 5p smoke after Seat widen.

### Backlog (explicitly out of GP5–GP6 gates)
- Mechanical Marquise (+ spy cards / cooperative)
- Second Vagabond character rules that touch Riverfolk
- Dominance take/activate + coalitions (base backlog)
- Hirelings / landmarks / Lilypad / Lost City (craft suit edge cases for gardens)
- UI: Phaser faction boards for lizard/riverfolk (engine-first)
