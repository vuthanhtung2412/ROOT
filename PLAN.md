### Goal
- Ambush prompt first; damage/dice overlay only after ambush resolved
- Field Hospitals: spend bird (wild) works; no accidental decline via X
- Ambush + FH: non-skippable → Decline/Skip only (no corner X)

### Approach
- `buildBattleOverlayViewModel`: return null for `ambush` / `foil` (banner owns that step)
- `beginAmbush` / `beginFieldHospital`: `canCancel: false`; keep Decline/Skip option
- Prove bird in FH `legalActions` + composer enables bird cardId

### Test plan
- Unit: battle overlay null on ambush/foil; shows on removeDefender
- Unit: FH/ambush prompt `canCancel === false`
- Unit: FH legalActions includes bird; chooseCard bird → resolveEvent

### Commit plan
- `fix(phaser): hide battle overlay during ambush`
  - `frontend/phaser/src/game/battleOverlayModel.ts`
  - `frontend/phaser/src/game/battleOverlayModel.test.ts`
- `fix(phaser): drop X on ambush and Field Hospitals`
  - `frontend/phaser/src/game/resolution/eventActionComposer.ts`
  - `frontend/phaser/src/game/resolution/eventActionComposer.test.ts`
- `test(lib): Field Hospitals legalActions include bird`
  - `lib/src/events/fieldHospital.test.ts`
