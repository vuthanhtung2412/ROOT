# Frontend action under resolution

Composer drafts + HUD outcomes for multi-step actions. Not backend `GameState`.

See also: [`resources/notes/frontend-vs-registered-actions.md`](../../../../resources/notes/frontend-vs-registered-actions.md).

## Procedural workflows (Temporal-like)

Readable `async/await` procedures. Pilot: **march**.

| File | Role |
|------|------|
| `ResolutionUi.ts` | `pickClearing` / `pickOption` / preview activities |
| `ResolutionController.ts` | Promise bridge — paint then await player input |
| `workflows/march.ts` | `resolveMarch` — top-to-bottom march procedure |
| `marchWorkflowHooks.ts` | Adapts workflow → existing `ActionComposerHooks` |

```typescript
// workflows/march.ts (shape)
const from = await ui.pickClearing({ message: '…origin', clearings })
const to = await ui.pickClearing({ message: '…destination', clearings })
const count = await ui.pickOption({ message: '…how many', options })
return { type: 'march', moves: [...] }
```

## Core (shared)

| File | Role |
|------|------|
| `ActionComposer.ts` | Outcome machine (`idle` / `incomplete` / `ready`) |
| `mergeComposerHooks.ts` | Merge faction/event hooks |
| `composerOutcomeApplier.ts` | Outcome → banner / board / hand / submit |
| `actionUnderResolution.ts` | Any draft ≠ idle → tray off |
| `autoPromptController.ts` | Auto-begin forced pending (FH, Ambush, setup) |
| `forcedAction.ts` | Forced-prompt helpers |

## Draft composers (still state-machine style)

| File | Actions |
|------|---------|
| `marquiseActionComposer.ts` | `build`, `battle`, `overwork`, `discard` (+ craft/spendBird via core) |
| `eyrieActionComposer.ts` | `addToDecree`, `newRoost`, `decree` |
| `eventActionComposer.ts` | `resolveEvent` UI (FH, ambush, keep, leader, battle picks) |
| `marchClearingsPreview.ts` | March UI-only warrior preview on board |
