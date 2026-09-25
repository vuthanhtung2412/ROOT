### Goal
- React shell (template-react) + migrate character board out of Phaser

### Approach
- React entry → PhaserGame → StartGame + EventBus
- Character board as React overlay; reuse viewModel + layout

### Test plan
- typecheck + test + build @root/phaser
- Menu → Game; open faction board; Marquise/Eyrie overlays

### Commit plan
- ~~`feat(phaser): scaffold React+EventBus shell`~~
- ~~`feat(ui): React faction board shell`~~
- ~~`feat(ui): React board overlays parity`~~
- ~~`refactor(ui): drop Phaser FactionBoardModal`~~
- ~~`fix(ui): pin board tokens to layout.json %`~~
- ~~`fix(ui): show track tokens above board art`~~
