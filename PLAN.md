### Goal
- Quests + coalitions in game (dominance take/activate/win included).

### Approach
- Quests shipped: 15-card deck, setup draw 3, Daylight `quest`, board UI pile.
- Dominance shipped: take available, activate (≥10 VP), Birdsong suit/bird win, Vagabond 4p+ coalition + `coWinners`.

### Remaining polish
- FE composers for `takeDominance` / `activateDominance` choice flows.
- Route all `.vp +=` through `addVictoryPoints`.
- Show available dominance + coalition marker in UI.

### Test plan
- `lib` vitest: quests + dominance (incl. Birdsong win + coWinners).
- FE: factionBoardViewModel + vagabond composer tests.

### Commit plan
- done: quest defs → state → setup → action → UI
- done: take/activate dominance → Birdsong win + coWinners
- next: `feat(ui): dominance / coalition action composers`
- next: `refactor(lib): score via addVictoryPoints`
- next: `docs(rules): finish un-defer notes`
