### Goal
- Tighten `Building` so only craft pieces (`workshop` / `roost`) carry `used` (once-per-turn craft activation). Non-craft buildings (`sawmill` / `recruiter` / `base`) have no `used` field.

### Approach
- Discriminated union on `Building.type`.
- `place` only sets `used: false` for workshop/roost.
- Craft + `endTurn` reset only touch craft buildings (type-narrowed).
- Sweep fixtures/tests/QA snapshots that put `used` on sawmill/recruiter/base.

### Files to change
- `lib/src/pieces/types.ts` — union type + optional `isCraftingBuilding` guard
- `lib/src/rules/place.ts` — makePiece without `used` for non-craft
- `lib/src/rules/craft.ts`, `lib/src/queries/craft.ts` — narrow when setting/reading `used`
- `lib/src/factions/Marquise.ts`, `lib/src/factions/Eyrie.ts` — endTurn reset only craft buildings
- Tests / QA snapshot builders that construct buildings

### Test plan
- `pnpm --filter @root/lib test` (craft + Marquise/Eyrie endTurn craft-reset tests)
- Typecheck: no `used` on sawmill/recruiter/base literals

### Commit plan
- `refactor(pieces): Building.used only on craft pieces`
  - `lib/src/pieces/types.ts`
  - `lib/src/rules/place.ts`
  - `lib/src/rules/craft.ts`
  - `lib/src/queries/craft.ts`
  - `lib/src/factions/Marquise.ts`
  - `lib/src/factions/Eyrie.ts`
  - fixtures/tests/QA that construct buildings
