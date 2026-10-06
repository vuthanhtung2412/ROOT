### Goal
- The in-game HUD reads closer to the Steam digital edition: hand-inked torn paper,
  round icon medallions, portrait tiles — on the components seen every turn.
- No layout change (wide 20/60/20, narrow insets) and no rule or view model change.
- New elements cover no more of the game board than the ones they replace.

### Approach
- **One paper kit** in `style.css`: `root-paper` (torn edge on a `::before` layer so text
  stays crisp), `root-medallion`, colour tokens. The torn edge is one inline SVG filter.
- **Neutral paper**: panels stay parchment; only portrait tiles carry a faction tint.
- **Icons** from `react-icons/lu` (Lucide), one icon per action type with a fallback.
- **Scope**: action tray, turn banner + count stepper, battle overlay, option grid modal,
  player rail. Menu, faction board, card gallery and hand are untouched.
- Accessible button names stay as they are (`OK`, `X`, action labels, `cards`), so the
  QA replay scripts keep finding them.
- Fonts stay (`IM Fell English`); no new font download.

Simplifications (say if wrong):
- Banner keeps X left / OK right of the prompt (not a row below) to stay as short as today.
- Option grid modal keeps confirming through the banner's OK and X.
- Battle overlay shows the clearing number, not its suit (suit is not in the view model).
- Unavailable actions are not listed dimmed (legal actions only, as today).

### Test plan
- Unit: `actionIcons.test.ts` — every labelled action type has an icon, unknown types
  fall back.
- Regression: React suite green; `pnpm typecheck` and `pnpm lint` clean.
- Manual: QA snapshots `march-ready`, `battle-remove-ready`, `riverfolk-set-costs` at
  1280×720 and a narrow viewport; screenshots in `tmp/ui-mockups/`.

### Commit plan
- done: `docs(plan): Steam-style HUD paper kit`
  - `PLAN.md`
- done: `feat(ui): torn paper kit and Lucide icons`
  - `frontend/react/package.json`, `frontend/react/src/style.css`
  - `frontend/react/src/react/PaperFilters.tsx`, `frontend/react/src/react/ReactHud.tsx`
- done: `feat(ui): action tray as icon medallions`
  - `frontend/react/src/ui/actionIcons.ts`, `frontend/react/src/ui/actionIcons.test.ts`
  - `frontend/react/src/react/ActionTray.tsx`
  - `.agents/skills/QA/record-fe-qa-scenarios.mjs`, `.agents/skills/QA/shoot-hud.mjs`
- done: `feat(ui): turn banner as a torn paper strip`
  - `frontend/react/src/react/TurnBanner.tsx`
- done: `feat(ui): battle overlay as floating portrait tiles`
  - `frontend/react/src/react/BattleOverlay.tsx`, `frontend/react/src/react/BattleOverlay.css` (removed)
- done: `feat(ui): option grid modal on paper`
  - `frontend/react/src/react/OptionGridModal.tsx`
- done: `feat(ui): player rail seats on paper`
  - `frontend/react/src/react/PlayerRail.tsx`
