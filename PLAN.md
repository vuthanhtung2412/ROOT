### Goal
- Temporal-style async resolution for multi-step actions that benefit (like march).

### Approach
- Keep `resolveMarch` as reference.
- Skip thin-wrapper migrations (decree tried — not worth it).

### Next candidates (only if clear win)
- Marquise `battle` / `build` — clearing→option; skip if same thin-wrapper smell.
- Card flows (`overwork`, `addToDecree`) — need `pickCard` first; bigger win.

### Commit plan
- ~~`feat(phaser): add ResolutionController bridge`~~
- ~~`feat(phaser): march async workflow`~~
- ~~`refactor(phaser): wire march workflow, drop draft`~~
