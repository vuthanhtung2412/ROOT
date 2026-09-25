### Goal
- Name frontend staging as **action under resolution**.
- Tray OFF while under resolution; cancel to idle → `session.refresh()`.

### Approach
- `isActionUnderResolution(drafts)` helper; tray flag rename.
- GameScene uses helper; cancel → refresh when leave under-resolution to idle.
- Docs use new name.

### Files to change
- `frontend/phaser/src/game/actionUnderResolution.ts` (+ test)
- `frontend/phaser/src/game/actionTrayDisable.ts` (+ test)
- `frontend/phaser/src/scenes/GameScene.ts`
- `resources/notes/frontend-vs-registered-actions.md`
- `REPORT.md`
- `PLAN.md`

### Test plan
- Unit: `isActionUnderResolution` idle / non-idle
- Unit: tray disable with `isActionUnderResolution: true`
- Manual: cancel march → board matches server; FH Decline still posts

### Commit plan
- `refactor(phaser): name action-under-resolution`
  - `actionUnderResolution.ts` + test
  - `actionTrayDisable.ts` + test
  - `GameScene.ts` (helper wire)
  - `PLAN.md` / notes / `REPORT.md`
- `feat(phaser): refresh on staging cancel`
  - `GameScene.ts` (cancel → `session.refresh()`)
  - notes cancel rule (already documents refresh)
