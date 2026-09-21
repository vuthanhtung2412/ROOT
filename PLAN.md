### Goal
- Marquise **picks keep corner** at start (not hardcode `FALL.corners[0]`).
- Eyrie roost always **`opposite(keep)`** (no bird corner pick).
- Eyrie may pick **any of 4 leaders** at setup; each leader special works.
- Turmoil **depose**: current leader face-down (unavailable); pick next from face-up; **A New Clutch** if none face-up.

### Approach
- Reuse **pending `resolveEvent`** (same as Field Hospitals). No free-form mid-setup actions.
- Add `GameStatus = 'setup'` between lobby `start` and first Birdsong:
  1. Shared setup (deck / hands / ruins / items) on `start`
  2. Pending `chooseKeep` → Marquise seat
  3. On resolve: place keep + garrison + buildings + tracks at chosen corner
  4. Auto-place Eyrie roost + 6 at `FALL.opposite(keep)` (no leader yet)
  5. Pending `chooseLeader` → Eyrie seat (face-up pool)
  6. On resolve: set leader, tuck viziers per leader table → `playing` + seat 0 Birdsong
- `EyrieBoard` gains pools (Law 7.3.3 / 7.7.3):
  - `leader: EyrieLeader | null` (slot; null only during choose)
  - `leadersFaceUp: EyrieLeader[]` (choosable)
  - `leadersFaceDown: EyrieLeader[]` (deposed / aside)
- Shared `tuckViziersFor(leader)` table:
  - Builder → Recruit, Move
  - Charismatic → Recruit, Battle
  - Commander → Move, Battle
  - Despot → Move, Build
- Leader specials (Law 7.8):
  - **Builder** — already ignores Disdain (`craftVp`); keep
  - **Charismatic** — decree Recruit places **2** warriors
  - **Commander** — `extraHits` +1 when Eyrie is **attacker**
  - **Despot** — if battle removes ≥1 enemy building/token → **+1 extra VP** (on top of normal 3.2.1)
- Turmoil: Humiliate + Purge unchanged → Depose flips current into `leadersFaceDown`, clears slot → if `leadersFaceUp` empty, move all face-down → face-up (New Clutch) → pending `chooseLeader` → then Rest (Evening). Stop auto-retuck Builder-only.
- `keepCornerFor` / `eyrieStartClearing`: derive from **keep token** / `opposite(keep)`, not hardcoded `corners[0]`.
- Phaser: extend `eventActionComposer` + tray for keep clearing pick + leader pick; drop Builder-only UI copy.
- Drop Builder-only rows in `resources/notes/root-base-rules.md` house table when lib done.

### Files to change
- `lib/src/state/boards.ts` — leader pools; `leader` nullable
- `lib/src/state/types.ts` — `'setup'` status
- `lib/src/events/types.ts` — `chooseKeep` / `chooseLeader` events
- `lib/src/events/chooseKeep.ts` (+ test) — Marquise corner resolver
- `lib/src/events/chooseLeader.ts` (+ test) — setup + depose resolver
- `lib/src/events/resolvers.ts` — wire new resolvers
- `lib/src/factions/Marquise.ts` — setup split: apply chosen corner; `keepCornerFor` reads keep
- `lib/src/factions/Eyrie.ts` — roost opposite keep; vizier table; Charismatic recruit; turmoil → pending choose
- `lib/src/triggers/hooks.ts` / `buildHooks.ts` — Commander `extraHits`
- `lib/src/events/battle.ts` (or remove/score path) — Despot extra VP
- `lib/src/game/Game.ts` — `start` → `'setup'` + pending; finish setup → `'playing'`
- `lib/src/actions/types.ts` — `ActionChoiceParams` for `leaders?: EyrieLeader[]` if needed
- `lib/src/factions/*.test.ts`, `Game.test.ts` — rewrite fixed-corner / Builder-only setup asserts
- `frontend/phaser/src/game/eventActionComposer.ts` — keep + leader picks
- `frontend/phaser/src/ui/ActionTray.ts` / `TurnBanner.ts` / `EyrieBoard.ts` — setup prompts; drop house-rule copy
- `resources/notes/root-base-rules.md` — remove Builder-only / fixed-corner deviations

### Test plan
- Unit: `chooseKeep` — only 4 corners legal; place keep/garrison/buildings; illegal non-corner rejects
- Unit: after keep, Eyrie roost at `opposite(keep)` for each of 4 corners
- Unit: setup `chooseLeader` — all 4 face-up; viziers match leader columns
- Unit: Builder craft ignores Disdain; non-Builder item craft = 1 VP
- Unit: Charismatic decree Recruit places 2 (supply −2); 1 warrior if supply 1? → must place 2 or turmoil (Law: must place two)
- Unit: Commander attacker gets +1 hit via `extraHits`; defender path unchanged
- Unit: Despot +1 VP when ≥1 enemy building/token removed in that battle; warriors-only remove → no bonus
- Unit: turmoil depose — old leader face-down; choose only from face-up; New Clutch when face-up empty
- Unit: `Game.start` → status `setup` + pending keep; after both choices → `playing` + birdsong seat 0
- Unit: fixtures / `keepCornerFor` / Field Hospitals still find keep after chosen corner
- Manual Phaser: Host+Join start → cat picks corner → bird picks leader → first turn; force turmoil → pick new leader (deposed greyed out)

### Commit plan
- `feat(lib): EyrieBoard leader face pools`
  - `lib/src/state/boards.ts`
  - `lib/src/game/Game.ts` (`createBoard`)
  - `lib/src/test/fixtures.ts`
  - `lib/src/factions/Eyrie.test.ts` (fixture shape only)
- `feat(lib): tuck viziers by leader table`
  - `lib/src/factions/Eyrie.ts` (`tuckViziersFor`; setup + turmoil retuck use table; still defaults Builder until choose commits)
  - `lib/src/factions/Eyrie.test.ts`
- `feat(lib): Charismatic recruit places two`
  - `lib/src/factions/Eyrie.ts`
  - `lib/src/factions/Eyrie.test.ts`
- `feat(lib): Commander attacker extra hit`
  - `lib/src/triggers/hooks.ts`
  - `lib/src/triggers/buildHooks.ts` (if needed)
  - `lib/src/factions/Eyrie.test.ts` (or battle test)
- `feat(lib): Despot bonus VP on building/token`
  - `lib/src/events/battle.ts` (or remove/score hook)
  - `lib/src/factions/Eyrie.test.ts`
- `feat(lib): setup status and chooseKeep`
  - `lib/src/state/types.ts`
  - `lib/src/events/types.ts`
  - `lib/src/events/chooseKeep.ts`
  - `lib/src/events/chooseKeep.test.ts`
  - `lib/src/events/resolvers.ts`
  - `lib/src/factions/Marquise.ts`
  - `lib/src/factions/Eyrie.ts` (`eyrieStartClearing` from keep token)
  - `lib/src/game/Game.ts`
  - `lib/src/game/Game.test.ts`
  - `lib/src/factions/Marquise.test.ts`
  - (Eyrie roost auto after keep; leader still forced Builder this commit)
- `feat(lib): setup chooseLeader pending`
  - `lib/src/events/chooseLeader.ts`
  - `lib/src/events/chooseLeader.test.ts`
  - `lib/src/events/resolvers.ts`
  - `lib/src/factions/Eyrie.ts` (no auto `leader = 'builder'`)
  - `lib/src/game/Game.ts` (after roost → pending chooseLeader → then `playing`)
  - `lib/src/factions/Eyrie.test.ts`
  - `lib/src/game/Game.test.ts`
- `feat(lib): turmoil depose chooseLeader`
  - `lib/src/factions/Eyrie.ts` (turmoil stops at Depose → pending; Rest after choose)
  - `lib/src/events/chooseLeader.ts` (depose path + New Clutch)
  - `lib/src/game/Game.ts` (if Rest/auto after resolve needs wire)
  - `lib/src/factions/Eyrie.test.ts`
- `feat(phaser): setup keep and leader picks`
  - `frontend/phaser/src/game/eventActionComposer.ts`
  - `frontend/phaser/src/ui/ActionTray.ts`
  - `frontend/phaser/src/ui/TurnBanner.ts`
  - `frontend/phaser/src/ui/EyrieBoard.ts`
  - matching `*.test.ts`
- `docs(rules): drop Builder-only setup house rules`
  - `resources/notes/root-base-rules.md`
