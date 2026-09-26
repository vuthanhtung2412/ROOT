### Goal
- Ship Vagabond **quests** + **coalitions** (needs full dominance take/activate/win). Un-defer from GP4 backlog.

### Approach
- Quests = shared table deck (15 cards); setup draws 3 face-up; Daylight `quest` action.
- Dominance = `takeDominance` + `activateDominance`; Birdsong win for non-Vagabond; Vagabond 4p+ → coalition instead.
- UI: show 3 face-up quests (+ deck count); dominance/coalition via existing action tray.

### Files to change
- `lib/src/cards/quests.ts` — 15 quest defs
- `lib/src/state/types.ts` / `boards.ts` — quest piles, `activatedDominance`, `coalitionWith`
- `lib/src/factions/Vagabond.ts` + `vagabond/*` — setup + quest action
- `lib/src/factions/*` + `Game.ts` — dominance take/activate/win + coalition
- `frontend/react/src/**` — quest pile overlay + tray labels
- `resources/notes/*` — remove deferred flags

### Test plan
- Rule-named vitest: quest setup/complete/reward; take/activate dominance; Birdsong suit/bird win; Vagabond coalition eligibility + shared win.
- Fixture factories only; no live RNG in tests.

### Commit plan
- `feat(lib): add 15 quest card defs`
  - `lib/src/cards/quests.ts`
  - `lib/src/cards/quests.test.ts`
- `feat(lib): add quest piles to GameState`
  - `lib/src/state/types.ts`
  - `lib/src/state/boards.ts` (completed quests on VagabondBoard)
  - `lib/src/test/fixtures.ts`
  - `lib/src/game/setup.ts` (init empty piles)
- `feat(lib): Vagabond setup draws 3 quests`
  - `lib/src/factions/Vagabond.ts`
  - `lib/src/factions/Vagabond.test.ts`
- `feat(lib): Daylight quest action`
  - `lib/src/actions/types.ts`
  - `lib/src/factions/vagabond/legalActions.ts`
  - `lib/src/factions/vagabond/apply.ts` / `Vagabond.ts`
  - tests
- `feat(ui): show face-up quest pile`
  - view model + overlays + tray/composer
- `feat(lib): take and activate dominance`
  - PlayerState fields; shared daylight actions; hand-limit skip for activated
- `feat(lib): Birdsong dominance win check`
  - `Game.ts` / birdsong entry
- `feat(lib): Vagabond coalition on activate`
  - 4p+ coalition target; Hostile→Indifferent; shared win
- `docs(rules): un-defer quests and coalitions`
  - notes + PLAN backlog
