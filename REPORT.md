# When to disable ActionTray

Status today: only **march draft** sets `disabled: true` (hide tray + clear buttons). See `ActionTraySyncOptions.disabled` and `GameScene.marchActionTrayOptions()`.

## Strong candidates

Same rationale as march: another UI owns input; tray buttons steal focus or restart the action.

1. **Any composer staging** — `isComposerStaging()` true (march / board build / card draft / eyrie / event). Board + ConfirmBar + hand do the work.
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

9. **Field Hospital** — pay/decline live in the tray (`composerOutcomeApplier` / TurnBanner).
10. **Idle legal-action menu** — tray is the chooser (battle start, build, recruit, etc. before staging).
11. **Tray-only binary choices** — same pattern as Field Hospital if more land there.

## Maybe lock, not disable

12. **Mid-action but cancel must stay** — prefer `lockToActionTypes` (or Cancel on ConfirmBar) over full hide, if the player must abort without Cancel elsewhere.

## Rule of thumb

Disable when primary input leaves the tray (board / hand / overlay / modal / confirm). Keep when the tray *is* the decision surface.
