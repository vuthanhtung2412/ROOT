### Goal
- Resolve all reports in `BUG.md`, one concern per commit, from rule/data-risk bugs to cosmetic work.
- Preserve Law of Root behavior and keep each commit buildable.

### Approach
- **P0 — correctness/blocking**
  - Allow battle against an enemy with buildings/tokens but no warriors from every battle source. The attacker still needs a warrior/pawn; only the defender is defenseless.
  - Add a winner action that clears the finished slot and returns to the menu; the full-screen overlay currently traps the player.
- **P1 — action integrity and required information**
  - Auto-open Field Hospitals with explicit pay/decline choices. The engine already queues the event; the current UI hides and mislabels it.
  - Remove the unsafe multiplayer Undo control. Keep backend undo for QA/replay tooling.
  - Make the discard pile searchable, as required public information.
  - Raise selected discard cards so multi-card selection is visible.
- **P2 — flow and board readability**
  - Auto-open the Ambush/foil prompt at battle start. The engine already rejects Ambush after this window.
  - Auto-advance when `endPhase` is the only legal action.
  - Auto-submit warrior-only hit removal; still prompt when buildings/tokens require a choice.
  - Explain zero-hit battles, highlight the active battle clearing, and replace generic banner text with event/action-specific prompts.
  - Show remaining ruins and grouped crafted-item counts.
- **P3 — cosmetic**
  - Lock the action tray while a compound March is staged. The engine already submits both moves atomically.
  - Show decree card suit and free building slots.
  - Verify Eyrie crafting power from live, unused roosts. Reusing a roost next turn is lawful; same-turn reuse and removed roosts are not.
  - Remove colored rings around piece icons; retain clearing rule/highlight rings.

### Files to change
- `lib/src/queries/**`, faction/card-effect callers: defenseless defender targeting.
- `lib/src/events/battle.ts`, `lib/src/log/types.ts`: battle completion/result data.
- `frontend/phaser/src/api/client.ts`: expose discard and ruin state already sent by the backend.
- `frontend/phaser/src/game/**`: pending-event, March, forced-action, and selection composers.
- `frontend/phaser/src/ui/**`: prompts, pile modal, board indicators, winner action, item grouping, piece styling.
- `frontend/phaser/src/scenes/GameScene.ts`: orchestration and automatic UI actions.

### Test plan
- Rule tests: attacker requirement remains; warriorless defenders with buildings/tokens are legal; defenseless hit applies.
- Craft tests: used roost blocked in the same turn, refreshed next turn, removed roost unavailable immediately.
- Phaser units: Ambush/Field Hospitals auto-open; March tray lock; forced warrior removal; sole `endPhase`; decree suit; discard selection; item grouping.
- UI model tests: active battle clearing, zero-hit result, free slots, ruins, winner callback, piece rings removed.
- Manual replay: use `logs/23-09-2026-18h41m/game.json` to inspect battles, Field Hospitals, discard, and Eyrie craft transitions.
- Per commit: targeted tests plus `pnpm -r typecheck`.
- Merge gate: `pnpm -r test && pnpm lint && pnpm build:lib && pnpm build:phaser`.

### Commit plan
- ~~**P0** `fix(lib): allow defenseless battle targets`~~ **done**
- ~~**P0** `feat(phaser): add winner menu action`~~ **done**
- ~~**P1** `fix(phaser): auto-open Field Hospitals`~~ **done**
- ~~**P1** `fix(phaser): remove unsafe undo control`~~ **done**
- ~~**P1** `feat(phaser): add discard pile viewer`~~ **done**
- ~~**P1** `fix(phaser): raise selected discard cards`~~ **done**
- ~~**P2** `fix(phaser): auto-open ambush window`~~ **done**
- ~~**P2** `feat(phaser): auto-advance forced steps`~~ **done**
- ~~**P2** `fix(phaser): auto-remove forced warriors`~~ **done**
- ~~**P2** `fix(phaser): explain zero-hit battles`~~ **done**
- ~~**P2** `feat(phaser): highlight battle clearing`~~ **done**
- ~~**P2** `fix(phaser): clarify turn banner prompts`~~ **done**
- ~~**P2** `feat(phaser): mark remaining ruins`~~ **done**
- ~~**P2** `feat(phaser): group crafted item counts`~~ **done**
- ~~**P3** `fix(phaser): lock staged March actions`~~ **done**
- ~~**P3** `fix(phaser): show decree card suit`~~ **done**
- ~~**P3** `feat(phaser): show clearing slot counts`~~ **done**
- ~~**P3** `test(lib): cover live Eyrie craft power`~~ **done**
- ~~**P3** `style(phaser): remove piece icon rings`~~ **done**
