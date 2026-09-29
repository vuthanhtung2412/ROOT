### Goal
- Vagabond picks starting forest (Law 9.3.2), not hardcoded `FALL.vagabondForest`.

### Approach
- Pending `chooseForest` like `chooseKeep` / `chooseLeader`.
- Setup leaves `board.forest = null`; resolver places pawn.
- Queue after Marquise buildings (+ Eyrie leader if present).
- FE: map forest click + prompt; CLI auto picks forest.

### Test plan
- Lib: chooseForest legal domain = all forests; apply sets forest; finishSetup drains it.
- FE composer: forests → click/submit `resolveEvent.forest`.

### Commit plan
- done: `feat(lib): chooseForest pending + setup queue`
- done: `feat(ui): pick starting forest on map`
- done: `docs(rules): note interactive vagabond forest`
