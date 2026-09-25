### Goal
- Finish React migration of remaining Phaser **chrome** (not map)
- Keep map / pieces / clearing highlights in Phaser

### Approach
- Worth migrate: in-game status text, boot loading bar, menu (banner / Play / QA / status / wallpaper)
- Keep Phaser: `BoardView`, `PieceView`, battle clearing highlights, HiDPI canvas
- Drive via `hudStore.shell` = `boot` | `menu` | `game`

### Files to change
- `frontend/phaser/src/game/hudStore.ts` — shell + boot/menu/status slices + menu callbacks
- `frontend/phaser/src/react/StatusMessage.tsx` — in-game status
- `frontend/phaser/src/react/BootOverlay.tsx` — loading progress
- `frontend/phaser/src/react/MenuOverlay.tsx` — menu chrome
- `frontend/phaser/src/react/ReactHud.tsx` — mount new overlays
- `frontend/phaser/src/scenes/BootScene.ts` — progress → store only
- `frontend/phaser/src/scenes/MenuScene.ts` — session logic only
- `frontend/phaser/src/scenes/GameScene.ts` — drop statusText
- `frontend/phaser/src/game/gameSceneHudPaint.ts` — sync React status

### Test plan
- typecheck + phaser vitest after each commit
- Manual / Playwright: boot → menu (no Phaser buttons) → Continue → status/errors → End → menu

### Commit plan
- `feat(ui): React in-game status message`
  - `hudStore.ts`, `StatusMessage.tsx`, `ReactHud.tsx`, `gameSceneHudPaint.ts`, `GameScene.ts`
- `feat(ui): React boot loading overlay`
  - `hudStore.ts`, `BootOverlay.tsx`, `ReactHud.tsx`, `BootScene.ts`
- `feat(ui): React menu chrome`
  - `hudStore.ts`, `MenuOverlay.tsx` (+css), `ReactHud.tsx`, `MenuScene.ts`
- `chore(ui): drop Phaser menu/boot draw leftovers`
  - trim dead draw helpers if unused
