# When to disable ActionTray

Status: `shouldDisableActionTray` + `GameScene.actionTraySyncOptions()` hide tray when action under resolution / modal / not-local / finished.

## Strong candidates

Same rationale as march: another UI owns input; tray buttons steal focus or restart the action.

1. **Action under resolution** — `isActionUnderResolution()` true (march / board build / card draft / eyrie / event including Field Hospitals + Ambush). Board + TurnBanner + hand do the work.
2. **Battle overlay pick** — attacker/defender/clearing/removal mid-flow; overlay + highlight own the UX.
3. **Leader pick** — LeaderPick UI live; tray “choose leader” is redundant/conflicting.
4. **Card-hand primary flows** — discard / craft / multi-card select; hand + Confirm own the UX.
5. **Modal open** — faction board / crafted cards / discard pile; avoid click-through and visual noise under the modal.

## Soft candidates

Already half-handled; full disable makes the empty state clearer.

6. **Not local actor** — today syncs empty `[]` but title may still show; disable = full hide while “Waiting for other player…”.
7. **Winner / game over** — WinnerOverlay up; no legal play left.
8. **No snapshot / loading / leave-to-menu** — nothing to act on.

## Keep tray ON

9. **Idle legal-action menu** — tray is the chooser (battle start, build, recruit, etc. before under-resolution).
10. **Tray-only binary choices** — only if a decision has no banner/hand surface yet.

## Forced prompts (not tray)

11. **Field Hospitals / Ambush** — pending events; auto-prompt → TurnBanner + hand. Tray stays disabled while under resolution.

## Maybe lock, not disable

12. **Mid-action but cancel must stay** — prefer `lockToActionTypes` (or Cancel on ConfirmBar) over full hide, if the player must abort without Cancel elsewhere.

## Rule of thumb

- **Tray ON** = idle start menu for voluntary registered / startable actions.
- **Tray OFF** = action under resolution (`isActionUnderResolution`), forced pending (Ambush / FH / keep / leader), modal, not-local, finished.
- Disable when primary input leaves the tray (board / hand / overlay / modal / confirm). Keep when the tray *is* the decision surface.

See also: `resources/notes/frontend-vs-registered-actions.md`.
