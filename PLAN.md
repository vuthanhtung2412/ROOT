### Goal
- Tailwind on `@root/react`; migrate UI CSS → utilities

### Approach
- Done: Tailwind v4 + `@tailwindcss/vite`, `@theme` tokens, `portrait` variant
- Migrated: menu/boot/game/HUD/board/pieces to className utilities
- Left as CSS (theme-tokenized): gallery / battle / card-detail / faction-board modals

### Test plan
- typecheck + test + build (green)

### Commit plan
- [ ] `build(ui): add Tailwind v4 Vite plugin`
- [ ] `refactor(ui): migrate shell/HUD to Tailwind`
