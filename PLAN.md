# Strengthen Game Architecture

## Objective

Strengthen game-engine and application boundaries while reducing duplicated code.
Preserve Law behavior, deterministic replay, snapshots, and public wire behavior.

## Baseline

- `lib/src` production: approximately 8,252 lines.
- `lib/src` tests: approximately 4,898 lines.
- Oversized production files:
  - `lib/src/factions/Eyrie.ts`
  - `lib/src/factions/Marquise.ts`
  - `lib/src/game/Game.ts`
  - `lib/src/events/battle.ts`
- CLI and Phaser duplicate approximately 250–320 lines of REST client plumbing.
- `turnScratch` defaults are repeated five times.
- Card action dispatch is repeated in `Game`.
- Craft source assignment is implemented twice.
- Alliance and Vagabond currently resolve to Marquise behavior.
- Test modules are emitted into `lib/dist`; production code imports a test fixture.

## Commit plan

1. `docs(plan): record architecture refactor`
2. `refactor(lib): isolate craft test context`
3. `build(lib): exclude tests from emit`
4. `refactor(lib): centralize state defaults`
5. `fix(lib): reject unsupported factions`
6. `refactor(lib): dispatch card actions by registry`
7. `refactor(lib): unify signal dispatch`
8. `refactor(lib): share crafting assignment`
9. `refactor(lib): share faction turn rules`
10. `refactor(web-client): add shared game API`
11. `refactor(frontend): use shared game API`
12. `refactor(phaser): reuse pure Fall metadata`
13. `refactor(cli): trust legal action domains`
14. `test(lib): centralize playable game fixtures`
15. `test(web): share game state fixtures`
16. Split remaining oversized rule modules, one module per refactor commit.
17. `test(web): cover game route lifecycle`
18. `chore: remove proven dead architecture`

## Gates

- Every commit: `pnpm -r typecheck` and focused package tests or build.
- API boundary changes: regenerate OpenAPI client with existing scripts.
- Final: lint, all tests, all builds, GP1 and GP2 CLI auto smoke, snapshot,
  replay, and undo verification.
- Completion: compare line counts, oversized files, dependency edges, shipped
  `lib/dist`, faction rejection, Fall metadata copies, and REST wrappers.
