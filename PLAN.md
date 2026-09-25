### Goal
- Migrate Phaser HUD/modals to React; keep map pieces in Phaser

### Approach
- Shared `hudStore` + `useSyncExternalStore`
- Migrate galleries → chrome → rail → tray → banner → battle → hand

### Test plan
- typecheck + test after each commit
- Manual: modals, rail, tray, banner, battle, hand, winner/leader, drawer

### Commit plan
- `feat(phaser): add React HUD store bridge`
- `feat(ui): React crafted + discard card galleries`
- `feat(ui): React card detail overlay`
- `feat(ui): React game drawer + winner + leader pick`
- `feat(ui): React player rail`
- `feat(ui): React action tray`
- `feat(ui): React turn banner`
- `feat(ui): React battle overlay`
- `feat(ui): React card hand`
- `chore(ui): drop dead Phaser HUD leftovers`
