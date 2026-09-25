### Goal
- Remove Phaser; React owns map/pieces/shell as well as HUD
- Keep game rules wiring: `GameSession`, composers, `boardLayout`, `hudStore`

### Approach
- React DOM board: autumn map `<img>` + absolute clearing hits + piece stacks
- Lift `GameSession` into React game controller; Boot/Menu/Game = React screens
- Letterbox logical view 1280×720

### Test plan
- typecheck + vitest after each commit
- Playwright: boot → menu → Continue → clearing click; pieces; End → menu
- Build without Phaser

### Commit plan
- `feat(ui): React BoardMap shell over map image`
- `feat(ui): React piece stacks on BoardMap`
- `feat(ui): React GameScreen wallpaper + board host`
- `feat(ui): lift GameSession into React game controller`
- `feat(ui): React shell replaces Phaser scenes`
- `chore(ui): remove Phaser dependency and dead canvas code`
- `ci: fix tests after Phaser removal`
