### Goal
- Remove Phaser; React owns map/pieces/shell as well as HUD

### Approach
- Done: BoardMap, pieces, GameScreen, ReactGameController, App shell
- Phaser package + scenes deleted

### Test plan
- typecheck + vitest
- Playwright: boot → menu → Continue → board
- `pnpm --filter @root/phaser build`

### Commit plan
- [x] `feat(ui): React BoardMap shell over map image`
- [x] `feat(ui): React piece stacks on BoardMap`
- [x] `feat(ui): React GameScreen wallpaper + board host`
- [x] `feat(ui): lift GameSession into React game controller`
- [x] `feat(ui): React shell replaces Phaser scenes`
- [ ] `ci: fix tests after Phaser removal`
