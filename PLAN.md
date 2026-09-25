### Goal
- Colocate frontend action-under-resolution flows in one folder.

### Approach
- Move composers + helpers into `frontend/phaser/src/game/resolution/`.
- Fix `#game/resolution/...` imports; add README index.

### Files to change
- `frontend/phaser/src/game/resolution/**` (moved cluster + README)
- Importers: `GameScene.ts`, `ActionTray.ts`, `gameSceneHudPaint.ts`, `battleRemovalStepper.ts`
- Notes / `REPORT.md` / `PLAN.md` paths

### Test plan
- `npm test` + `npm run typecheck` in `frontend/phaser`

### Commit plan
- `refactor(phaser): colocate resolution flows`
  - move into `game/resolution/`
  - fix imports + README + docs
