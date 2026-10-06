### Goal
- Lizard Cult (Law 10) and Riverfolk Company (Law 11) playable end to end:
  rules in `@root/lib`, accepted by the web server, playable in the React UI.
- Existing factions, hotseat, online and QA flows keep working unchanged.

### Approach
- **Follow the existing faction shape**: `factions/<Name>.ts` class + `factions/<name>/`
  helpers (`rules`, `legalActions`, `setup`), board type in `state/boards.ts`.
- **Legal actions carry full payloads**: every new action spec lists complete legal
  payloads in `params.options`; validation = payload is one of the options. One generic
  React composer walks the option fields (card → clearing → seat → count → choice).
- **Setup no longer needs the Marquise**: setup events are queued per faction in setup
  order (Marquise, Eyrie, Alliance, Vagabond, Lizard Cult, Riverfolk Company).
- **Lost Souls** live on the deck (`deck.lostSouls`), so every existing discard is
  routed there while the Cult is in the game, without touching each call site.
- **Riverfolk services** are a pending event at the start of each other player's
  Birdsong (`buyServices`); Riverboats and Mercenaries are turn flags read by the
  adjacency, rule and battle queries.
- Seats stay 0–3 (max four players); the host picks any 2–4 of the six factions.

Simplifications (say if wrong):
- Riverfolk craft picks which funds and which Trade Posts spaces to use automatically.
- Trade Disruption removes funds in box order (no choice of which funds).
- The Vagabond pays for services with automatically chosen items.
- Lizard Cult starting corner follows Law 10.3.2; the garden suit is the clearing suit
  (no Lost City landmark).

### Test plan
- Lib unit tests per rule, fixture factories only: `Lizard.test.ts`, `Riverfolk.test.ts`,
  `buyServices.test.ts`, setup events, Lost Souls routing, Pilgrims rule, Revenge,
  Swimmers, Mercenaries rule and hit split, Trade Disruption.
- Web: create game with new factions; Riverfolk hand stays public in online mode.
- React: generic option composer unit tests; faction board view model tests.
- Regression: lib, web and React suites green; `pnpm typecheck` and `pnpm lint` clean.

### Commit plan
- done: `docs(plan): Lizard Cult and Riverfolk Company`
  - `PLAN.md`
- done: `feat(lib): Lizard Cult and Riverfolk boards, pieces and Lost Souls`
  - `lib/src/pieces/types.ts`, `lib/src/state/boards.ts`, `lib/src/cards/Deck.ts`
  - `lib/src/queries/supply.ts`, `lib/src/rules/place.ts`, `lib/src/rules/remove.ts`
  - `lib/src/queries/craft.ts`, `lib/src/queries/ruler.ts`, `lib/src/typeGuards.ts`
- done: `refactor(lib): queue faction setup without requiring the Marquise`
  - `lib/src/game/Game.ts`, `lib/src/game/factionSetup.ts`
  - `lib/src/events/placeStartingBuilding.ts`
- done: `feat(lib): Lizard Cult faction`
  - `lib/src/factions/Lizard.ts`, `lib/src/factions/lizard/*`
  - `lib/src/events/chooseCultCorner.ts`, `lib/src/events/chooseOutcast.ts`
  - `lib/src/actions/types.ts`, `lib/src/events/types.ts`, `lib/src/events/resolvers.ts`
- done: `feat(lib): Riverfolk Company faction`
  - `lib/src/factions/Riverfolk.ts`, `lib/src/factions/riverfolk/*`
  - `lib/src/events/placeRiverfolkWarrior.ts`, `lib/src/events/setStartingCosts.ts`
- done: `feat(lib): Riverfolk services for other players`
  - `lib/src/events/buyServices.ts`, `lib/src/queries/mercenaries.ts`
  - `lib/src/queries/pieces.ts`, `lib/src/queries/move.ts`, `lib/src/triggers/hooks.ts`
  - `lib/src/events/battle/stages.ts`, `lib/src/events/battle/removal.ts`
- done: `feat(web): accept Lizard Cult and Riverfolk Company`
  - `backend/web/src/schemas/common.ts`, `backend/web/src/typeGuards.ts`
  - `backend/web/src/view/redactStateForViewer.ts`
  - `backend/web_client/src/gameApi.ts`, `backend/web_client/src/schema.d.ts`
- done: `feat(ui): Lizard Cult and Riverfolk assets, menu and pieces`
  - `frontend/react/public/assets/**`, `frontend/react/src/assets/gameAssets.ts`
  - `frontend/react/src/game/menuPartySetup.ts`, `frontend/react/src/game/theme.ts`
- done: `feat(ui): play Lizard Cult and Riverfolk actions`
  - `frontend/react/src/game/resolution/optionActionComposer.ts`
  - `frontend/react/src/game/resolution/eventActionComposer.ts`
  - `frontend/react/src/ui/ActionTray.ts`
- done: `feat(ui): Lizard Cult and Riverfolk faction boards`
  - `frontend/react/src/ui/factionBoardViewModel.ts`
  - `frontend/react/src/react/factionBoardOverlays.tsx`
  - `frontend/react/src/assets/layouts/*.layout.json`
