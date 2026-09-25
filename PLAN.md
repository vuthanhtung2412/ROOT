### Goal
- Never auto-skip Ambush/Foil — always banner Skip even with empty hand

### Approach
- Lib: stop `soleForcedBattleResolve` for ambush/foil decline-only
- Phaser: `beginAmbush([])` → incomplete Skip prompt (not ready decline)

### Test plan
- openBattle with no ambush cards → pending stays `ambush`
- After manual decline, sole removals still drain
- beginAmbush([]) → incomplete, canCancel false, Skip option

### Commit plan
- ~~`fix(lib): keep ambush prompt when hand empty`~~
- ~~`fix(phaser): prompt Skip ambush with empty hand`~~
