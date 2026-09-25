### Goal
- Rename `frontend/phaser` → `frontend/react`; package `@root/react`
- Deprecate Phaser script/API names with thin aliases

### Approach
- Done: `git mv`, package rename, serve/static/process-compose/docs/QA
- `createFrontendApi`; identity `root.react.*` + legacy migrate
- Deprecated: `dev:phaser`, `build:phaser`, `serve:phaser`, `createPhaserApi`, `mountPhaserStatic`

### Test plan
- `pnpm install`
- `pnpm --filter @root/react typecheck` + `test`
- `pnpm --filter @root/web typecheck`

### Commit plan
- [ ] `refactor(frontend): move package to frontend/react`
- [ ] `refactor(frontend): rename Phaser API helpers` (folded into same if small)
