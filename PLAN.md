### Goal
- Treat Field Hospitals as forced **prompt** (banner + hand), like Ambush — not proactive ActionTray choice.
- Drop FH tray-keep exception from disable rules.

### Approach
- `beginFieldHospital`: banner message + Decline button (mirror `beginAmbush`).
- `composerOutcomeApplier`: always sync composer banner; only skip battle-overlay for FH.
- `TurnBanner` pending prompt: show FH copy when not yet staged.
- `shouldDisableActionTray`: staging alone hides tray (no FH exception).
- Docs: `REPORT.md` / this plan.

### Files to change
- `frontend/phaser/src/game/eventActionComposer.ts`
- `frontend/phaser/src/game/eventActionComposer.test.ts`
- `frontend/phaser/src/game/composerOutcomeApplier.ts`
- `frontend/phaser/src/ui/TurnBanner.ts`
- `frontend/phaser/src/ui/TurnBanner.test.ts`
- `frontend/phaser/src/game/actionTrayDisable.ts`
- `frontend/phaser/src/game/actionTrayDisable.test.ts`
- `frontend/phaser/src/scenes/GameScene.ts`
- `REPORT.md`
- `PLAN.md`

### Test plan
- Unit: beginFieldHospital has message + Decline option; card pay still works
- Unit: disable predicate — staging disables (incl. former FH case)
- Unit: TurnBanner pending FH shows prompt
- Manual: FH → banner Decline + hand pay; tray hidden

### Commit plan
- `feat(phaser): Field Hospitals as banner prompt`
  - `eventActionComposer.ts` (+ test)
  - `composerOutcomeApplier.ts`
  - `TurnBanner.ts` (+ test)
- `refactor(phaser): drop FH ActionTray exception`
  - `actionTrayDisable.ts` (+ test)
  - `GameScene.ts`
- `docs: FH is prompt not tray action`
  - `REPORT.md`
  - `PLAN.md`
