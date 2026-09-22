### Goal
- Inventory every E&P card with **persistent** craft effect (`type: 'persistent'` in `ep.generated.ts` / stone box).
- Backend QA unit-test each effect (fixture before-state → action → assert vs Law of Root).
- Implement any missing effect modules so tests can prove behavior; fix bugs found during QA.
- Out of scope: partisan cards (`ROOT-77/84/88`), item crafts, dominance, ambush.

### Approach
- Source list = all `CardDef` where `type === 'persistent'` (16 defs below).
- Pattern = existing `lib/src/effects/<card>.ts` + `*.test.ts` + register in `register.ts`.
- Flavour → engine:
  - **hooks** → `RuleHooks` (`isAdjacent` / `needsRuleToMove` / `ruleWeight` / …)
  - **listeners** → `onSignal` on phase/craft/remove/draw
  - **granted actions** → `grants` + `Action` variant + `Game.apply` branch (mirror Swap Meet)
- QA method (skill **Unit Testing**): craft fixture state with card in `playArea` → trigger legal action via `Game.apply` / query → assert state/log; CLI snapshot optional for repro dumps.
- Cite `// Rule: Cards > Craft` + card name; name tests after effect text.
- One card = one commit (impl + test together when missing; test-only when already wired).

### Inventory (persistent = permanent craft)

| defId | Name | Engine shape | Status |
|-------|------|--------------|--------|
| `ROOT-57` | Boat Builders | hook `isAdjacent` (rivers) | done + test |
| `ROOT-59` | Charm Offensive | listener `phase.start` Evening + choice action | missing |
| `ROOT-62` | Coffin Makers | listener `warriors.removed` + Birdsong score | missing |
| `ROOT-64` | Corvid Planners | hook `needsRuleToMove` | missing |
| `ROOT-71` | Eyrie Émigré | Birdsong-end forced move+battle; discard fail | missing |
| `ROOT-72` | False Orders | Birdsong discard-self → force enemy move | missing |
| `ROOT-79` | Informants | Evening draw replace → take ambush from discard | missing |
| `ROOT-81` | League of Adventurous Mice | Daylight grant: exhaust item → move/battle | missing |
| `ROOT-82` | Master Engravers | listener `craft.item` +1 VP | done + test |
| `ROOT-85` | Murine Broker | listener other `craft.item` → draw | done + test |
| `ROOT-86` | Propaganda Bureau | Daylight grant: spend card → replace warrior | missing |
| `ROOT-93` | Saboteurs | Birdsong grant: discard self → discard enemy craft | missing |
| `ROOT-97` | Soup Kitchens | hook `ruleWeight` tokens ×2 | done + test |
| `ROOT-103` | Swap Meet | Birdsong grant swap | done + test |
| `ROOT-108` | Tunnels | hook `isAdjacent` via crafting pieces | missing |

Copies note: False Orders ×2, Informants ×2, League ×2, Saboteurs ×3, Swap Meet ×2, Tunnels ×2 — effect keyed by `defId`, copies irrelevant to logic.

### Files to change
- `PLAN.md` — this plan (inventory + commits)
- `lib/src/effects/<camelName>.ts` + `*.test.ts` — one pair per missing card
- `lib/src/effects/register.ts` — register new effects
- `lib/src/actions/types.ts` — new Action variants when grant needed
- `lib/src/game/Game.ts` — apply/legal wiring for grants
- Existing done cards: only touch if QA finds bug

### Test plan
- For each row in inventory: vitest under `lib/src/effects/` proving Law line.
- Already-done five: re-run `pnpm --filter @root/lib test -- effects/` before new work; add edge case only if gap found.
- Missing ten: failing-repro fixture first, then implement until green.
- Gate: `pnpm --filter @root/lib test -- effects/` all pass; no type errors.

### Commit plan
- `docs: PLAN persistent card QA inventory`
  - `PLAN.md`
- `test(lib): reassert done persistent effects`
  - (no file change if green; else bugfix commits per card)
- `feat(lib): Corvid Planners ignore rule`
  - `lib/src/effects/corvidPlanners.ts`
  - `lib/src/effects/corvidPlanners.test.ts`
  - `lib/src/effects/register.ts`
- `feat(lib): Tunnels craft-piece adjacency`
  - `lib/src/effects/tunnels.ts`
  - `lib/src/effects/tunnels.test.ts`
  - `lib/src/effects/register.ts`
- `feat(lib): Charm Offensive evening draw`
  - `lib/src/effects/charmOffensive.ts`
  - `lib/src/effects/charmOffensive.test.ts`
  - `lib/src/effects/register.ts`
  - `lib/src/actions/types.ts` / `Game.ts` if choice action needed
- `feat(lib): Coffin Makers warrior score`
  - `lib/src/effects/coffinMakers.ts`
  - `lib/src/effects/coffinMakers.test.ts`
  - `lib/src/effects/register.ts`
  - state field on card play-area if warriors pile needed
- `feat(lib): Master Engravers QA edge` — skip if existing test enough
- `feat(lib): Informants ambush from discard`
  - `lib/src/effects/informants.ts`
  - `lib/src/effects/informants.test.ts`
  - `lib/src/effects/register.ts` + action wiring
- `feat(lib): League of Adventurous Mice`
  - `lib/src/effects/leagueOfAdventurousMice.ts`
  - `lib/src/effects/leagueOfAdventurousMice.test.ts`
  - `lib/src/effects/register.ts` + action wiring
- `feat(lib): Propaganda Bureau replace warrior`
  - `lib/src/effects/propagandaBureau.ts`
  - `lib/src/effects/propagandaBureau.test.ts`
  - `lib/src/effects/register.ts` + action wiring
- `feat(lib): Saboteurs discard enemy craft`
  - `lib/src/effects/saboteurs.ts`
  - `lib/src/effects/saboteurs.test.ts`
  - `lib/src/effects/register.ts` + action wiring
- `feat(lib): False Orders force move`
  - `lib/src/effects/falseOrders.ts`
  - `lib/src/effects/falseOrders.test.ts`
  - `lib/src/effects/register.ts` + action wiring
- `feat(lib): Eyrie Emigre forced move-battle`
  - `lib/src/effects/eyrieEmigre.ts`
  - `lib/src/effects/eyrieEmigre.test.ts`
  - `lib/src/effects/register.ts` + action wiring
- `ci: effects suite green`
  - fix only if merge-gate fails

Order note: hooks first (Corvid/Tunnels) = smallest surface; listeners next; grants last (need Action union). Emigre last = hardest (mandatory compound + discard).
