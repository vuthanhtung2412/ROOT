# Frontend action under resolution

Composer drafts + HUD outcomes for multi-step actions. Not backend `GameState`.

See also: [`resources/notes/frontend-vs-registered-actions.md`](../../../../resources/notes/frontend-vs-registered-actions.md).

## Core

| File | Role |
|------|------|
| `ActionComposer.ts` | Outcome machine (`idle` / `incomplete` / `ready`) |
| `mergeComposerHooks.ts` | Merge faction/event hooks |
| `composerOutcomeApplier.ts` | Outcome → banner / board / hand / submit |
| `actionUnderResolution.ts` | Any draft ≠ idle → tray off |
| `autoPromptController.ts` | Auto-begin forced pending (FH, Ambush, setup) |
| `forcedAction.ts` | Forced-prompt helpers |

## Faction / event flows

| File | Actions |
|------|---------|
| `marquiseActionComposer.ts` | `march`, `build`, `battle`, `overwork`, `discard` (+ craft/spendBird via core) |
| `eyrieActionComposer.ts` | `addToDecree`, `newRoost`, `decree` |
| `eventActionComposer.ts` | `resolveEvent` UI (FH, ambush, keep, leader, battle picks) |
| `marchClearingsPreview.ts` | March UI-only warrior preview on board |
