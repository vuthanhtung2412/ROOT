### Goal
- Finish React migration of remaining Phaser **chrome** (not map)
- Keep map / pieces / clearing highlights in Phaser

### Approach
- Migrated: in-game status, boot loading, menu (banner / Play / QA / status / wallpaper)
- Keep Phaser: `BoardView`, `PieceView`, battle clearing highlights, game wallpaper, HiDPI canvas
- Drive via `hudStore.shell` = `boot` | `menu` | `game`

### Test plan
- typecheck + phaser vitest after each commit
- Manual / Playwright: boot → menu (DOM buttons) → Continue → status → End → menu

### Commit plan
- [x] `feat(ui): React in-game status message`
- [x] `feat(ui): React boot loading overlay`
- [x] `fix(ui): import patchHud for game shell`
- [x] `feat(ui): React menu chrome`
