### Goal
- Hide ActionTray whenever primary input leaves tray (board / hand / overlay / modal / waiting / finished), matching `REPORT.md`.
- Keep tray ON for Field Hospitals (pay/decline live there).

### Approach
- Extract pure `shouldDisableActionTray(input)` (testable).
- Replace march-only `marchActionTrayOptions()` with broader `actionTraySyncOptions()`.
- Disable when: composer staging (except Field Hospital), any modal open, not local actor, game finished.
- Re-sync tray after modal open/close (open paths today skip tray sync).
- Leader pick / battle pick / card drafts already covered by composer staging.

### Files to change
- `PLAN.md`: this plan
- `frontend/phaser/src/game/actionTrayDisable.ts`: pure disable predicate
- `frontend/phaser/src/game/actionTrayDisable.test.ts`: unit tests
- `frontend/phaser/src/game/gameSceneModals.ts`: `isAnyOpen()`
- `frontend/phaser/src/scenes/GameScene.ts`: wire options + modal re-sync
- `frontend/phaser/src/game/gameSceneHudPaint.ts`: rename dep to `actionTraySyncOptions`

### Test plan
- Unit: Field Hospital staging → not disabled
- Unit: any other composer staging → disabled
- Unit: modal / not-local / finished → disabled
- Unit: idle local actor → not disabled
- Manual: open faction board mid-turn → tray hides; close → tray back

### Commit plan
- `docs: plan ActionTray disable rules`
  - `PLAN.md`
- `feat(phaser): pure ActionTray disable predicate`
  - `frontend/phaser/src/game/actionTrayDisable.ts`
  - `frontend/phaser/src/game/actionTrayDisable.test.ts`
- `feat(phaser): wire ActionTray disable + modal sync`
  - `frontend/phaser/src/game/gameSceneModals.ts`
  - `frontend/phaser/src/scenes/GameScene.ts`
  - `frontend/phaser/src/game/gameSceneHudPaint.ts`
