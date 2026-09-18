### Goal
- Ship the first playable Phaser client for the completed GP2 game: Marquise versus Eyrie (Builder).
- Desktop-first local hot-seat play through the existing Hono API, from new game to 30 VP.
- Use the tracked Autumn map, Exiles & Partisans cards, and faction icons. Use Steam frames only as interaction inspiration.
- Keep Alliance, Vagabond, remote multiplayer, secure hidden hands, AI, WebSocket push, and production asset licensing out of scope.

### Approach
- Keep `@root/web` authoritative. Phaser reads state/actions and submits normal `Action` commands; it never mutates game state locally. Engine already resolves Law §§6–7 (plus shared §4 battle/move/craft); UI only surfaces `legalActions` / `pending` and submits choices.
- Refresh state and legal actions after every command (no WebSocket). Show API errors without losing the current selection.
- **Contract first (blocker):** replace `ActionSpec.params: Record<string, unknown[]>` with typed UI choice metadata. Marquise must expose real choice domains; Eyrie must expose **correlated** decree choices (not fragile parallel arrays). Do this before any Phaser composers. Same correlation rule for Marquise **overwork** (card × sawmill clearing) and **build** (clearing × building type).
- **OpenAPI client:** annotate Hono game/map routes with `@hono/zod-openapi`, expose `GET /doc`, dump `backend/web/openapi.json`, then `pnpm gen:api-client` → shared package `@root/web-client` (`backend/web_client`). Frontends (Phaser, CLI, …) import `createRootWebClient` from `@root/web-client`. Do **not** hand-copy HTTP types. Regenerating the client is mandatory after API shape changes.
- Route OpenAPI schemas may touch `backend/web/src/routes/game.ts` for request/response docs only — **do not** change `legalActions()` passthrough behavior.
- Prefer generated OpenAPI types for HTTP; use type-only `@root/lib` only where the OpenAPI schema intentionally re-exports shared domain unions (Action, etc.). Bundle no engine behavior into the client.
- Scene flow: preload → local game menu → game board.
- Build the board from the Autumn image and corrected normalized clearing coordinates. Render pieces as original vector shapes in faction colors.
- Drive the interface from server state:
  - top banner: actor, phase, step, prompt (must distinguish craft vs actions / decreeAdd vs decree)
  - left rail: players, VP, active actor
  - bottom tray: hand and legal actions
  - right drawer: faction board, decree, log, undo
  - blocking overlay: battle (§4.3), Field Hospitals (6.2.3), turmoil feedback (7.7), winner
- Staged action composers for cards, clearings, defenders, piece removal, and counts.
  - **March (6.5.2):** one compound `march` action — confirm after first move, optional second move, then submit once (do not split into two March actions).
  - **Add to Decree (7.4.2):** forced when hand nonempty; pick 1–2 cards, ≤1 bird, each to a column; no skip/`endPhase`.
  - **Turmoil (7.7):** when decree card has no full resolution, only `turmoil` legal; UI shows Humiliate/Purge/Rest result. **Builder-only house rule:** no Depose leader picker (engine retucks viziers; leader stays Builder).
- Auto steps (server `autoActions`, UI only refreshes board/log): Marquise birdsong wood (6.4), evening draw (6.6); Eyrie Emergency Orders (7.4.1), evening roost score (7.6.1), evening draw (7.6.2).
- Passive / no extra UI beyond legal highlights + board truth: Keep place lock (6.2.2), Lords of the Forest (7.2.2), Disdain / Builder ignore (7.2.3 / 7.8.1), setup (6.3 / 7.3 — fixed corners, no keep/leader pick).
- Shared composers (both seats): craft, discard-to-5, `endPhase`, battle initiation + pending battle stages. Card effects (Swap Meet, etc.) deferred beyond “appears in tray if granted”.
- Hot-seat privacy is a handoff curtain only. Backend still exposes all hands to the browser.
- Style each component inside its feature commit. No sweeping polish commit — only concrete visual-smoke fixes if needed later.
- Do not ship Steam screenshots. Existing Leder assets remain personal/dev only until distribution rights are resolved.

### Rules coverage (Law §§6–7 → UI)
| Law | Need in first Phaser UI | Plan home |
|---|---|---|
| 6.2.1 / 7.2.1 Craft | Pick craftable hand cards in craft step | card composers + tray |
| 6.2.2 Keep | Legal place targets only (no special modal) | board choice specs |
| 6.2.3 Field Hospitals | Pending pay matching card or decline | Field Hospitals commit |
| 6.4 / 6.6 / 7.4.1 / 7.6 | Auto wood/draw/score; then discard if >5 | session refresh + discard |
| 6.5 Daylight | Craft step then ≤3 actions; +1 per bird spent outside action | HUD step + card/board composers |
| 6.5.1 Battle | Clearing + defender, then §4.3 pending | board actions + battle overlay |
| 6.5.2 March | Up to 2 moves as **one** action | March composer |
| 6.5.3 Recruit | Once/turn; no extra params if legal | board actions |
| 6.5.4 Build | Rule clearing + leftmost building + wood network | correlated board choices |
| 6.5.5 Overwork | Card matching sawmill clearing | correlated card×clearing |
| 7.4.2 Add to Decree | Must add 1–2 cards, ≤1 bird, any columns | Eyrie composer (not optional) |
| 7.4.3 A New Roost | Only if 0 roosts; pick fewest-warrior legal clearing | Eyrie composer |
| 7.5.2 Decree | L→R columns; any order in column; suit-matched recruit/move/battle/build | Eyrie commits |
| 7.7 Turmoil | Immediate when impossible; show result; no leader pick (Builder) | tray `turmoil` + overlay feedback |
| 7.8.2–4 Other leaders | Out of scope (Builder only) | — |

### Files to change
- `lib/src/actions/types.ts`: typed UI action choice metadata (replace loose `Record`).
- `lib/src/factions/Marquise.ts` (+ tests): card choices, then board/route/battle choices.
- `lib/src/factions/Eyrie.ts` (+ tests): paired/correlated decree choices.
- `lib/src/layout/fall.ts` (+ svg test): align clearing coords to Autumn image.
- `backend/web/src/openapi.ts`, `routes/**` (schema only), `scripts/export-openapi.ts`: OpenAPIHono `/doc` + `gen:openapi` dump.
- `backend/web_client/**`: shared generated OpenAPI client (`@root/web-client`); `pnpm gen:api-client`.
- `frontend/phaser/package.json`, `vite.config.ts`, `pnpm-lock.yaml`: `@root/web-client` dep, Vite proxy, Vitest.
- `frontend/phaser/src/api/**`, `src/test/factories.ts`: thin Phaser session wrapper over `@root/web-client` + fixtures.
- `frontend/phaser/src/assets/**`, `src/scenes/**`, `src/game/**`, `src/ui/**`: preload, session, menu, board, HUD, composers, overlays.
- `frontend/phaser/README.md`, root `README.md`: GP2 play flow + `gen:api-client` usage.
- **Behavior freeze:** `GET /game/actions` still returns `game.legalActions()` unchanged.

### Test plan
- Contract units: every GP2 `ActionSpec` carries enough typed metadata to build a valid `Action`; Marquise card/board domains complete; Eyrie clearing/defender and decree choices stay paired.
- OpenAPI: `pnpm --filter @root/web gen:openapi` writes JSON; `pnpm gen:api-client` writes `@root/web-client` schema; Phaser/CLI import `@root/web-client`.
- Phaser units use fixture factories and mocked fetch:
  - API success/error handling
  - session refresh after create, action, undo, and restart
  - composers for Marquise cards/March/board, Eyrie decree, battle, Field Hospitals, discard
  - prompt actor from `pending[0]`, not only `currentSeat`
  - card and piece view-model mapping
- Visual smoke at 1280×720 and 1920×1080: map scales; 12 clearings selectable; HUD/overlays do not block targets.
- End-to-end smoke with live web: create → join Marquise/Eyrie → start → Marquise craft + bird-spend + March(1–2) + recruit/build/battle → Field Hospitals → Eyrie forced addToDecree → craft → full decree columns (or turmoil) → evening discard → winner.
- Merge gate: `pnpm --filter @root/lib test`, `pnpm --filter @root/phaser test`, `pnpm -r typecheck`, `pnpm build:lib`, `pnpm build:web`, `pnpm build:phaser`, CLI GP2 auto smoke.

### Commit plan
1. `docs(phaser): plan first playable game` *(done)*
   - `PLAN.md`
2. `feat(lib): type UI action choices` *(done)*
   - `lib/src/actions/types.ts`
   - `lib/src/index.ts` — re-export choice types
   - `lib/src/factions/Eyrie.ts` — ActionChoiceParams annotation only
3. `feat(lib): expose Marquise card choices` *(done)*
   - `lib/src/factions/Marquise.ts`
   - `lib/src/factions/Marquise.test.ts`
   - Spend bird, craft, discard; overwork as **paired** cardId × sawmill clearing (6.5.5)
4. `feat(lib): expose Marquise board choices` *(done)*
   - `lib/src/factions/Marquise.ts`
   - `lib/src/factions/Marquise.test.ts`
   - March routes + counts; build as **paired** clearing × building (6.5.4); battle clearing × defender; recruit flag-only
5. `feat(lib): pair Eyrie decree choices` *(done)*
   - `lib/src/factions/Eyrie.ts`
   - `lib/src/factions/Eyrie.test.ts`
   - Correlated decree recruit/move/battle/build; addToDecree card×column domains; newRoost clearing list
   - `frontend/cli/src/commands/auto.ts` — consume paired params (same intent unblock)
6. `fix(lib): align Autumn clearing layout` *(done)*
   - `lib/src/layout/fall.ts`
   - `lib/src/layout/render/svg.test.ts`
7. `feat(web): expose OpenAPI document` *(done)*
   - `backend/web/src/openapi.ts` — `getOpenApiDocument()` + `GET /doc`
   - `backend/web/src/routes/game.ts`, `map.ts` — Zod/OpenAPI request+response schemas only
   - `backend/web/src/index.ts` — wire OpenAPIHono / doc route
   - `backend/web/package.json` — `@hono/zod-openapi`, zod
   - `backend/web/openapi.json` — dumped via `gen:openapi`
   - Behavior unchanged for `legalActions` passthrough
8. `chore: add gen:api-client script` *(done — moved to `@root/web-client`)*
   - `backend/web_client/scripts/gen-api-client.ts`
   - `backend/web/scripts/export-openapi.ts`
   - Commands: `pnpm --filter @root/web gen:openapi` then `pnpm gen:api-client`
9. `feat(web-client): shared generated API package` *(done)*
   - `backend/web_client/**` — `@root/web-client` with `createRootWebClient` + `schema.d.ts`
   - Wire `frontend/phaser` (and later CLI) via `workspace:*`
10. `chore(phaser): configure API development proxy` *(done)*
    - `frontend/phaser/package.json`
    - `frontend/phaser/vite.config.ts`
    - `pnpm-lock.yaml`
    - Vite proxy to web
11. `chore(phaser): add Vitest` *(done)*
    - `frontend/phaser/package.json`
    - `frontend/phaser/vite.config.ts`
    - `pnpm-lock.yaml`
12. `feat(phaser): add generated game API client` *(done)*
    - Import from `@root/web-client` (not local generated files)
    - `frontend/phaser/src/api/client.ts` — thin Phaser-facing helpers if needed
    - `frontend/phaser/src/api/client.test.ts`
    - `frontend/phaser/src/test/factories.ts`
    - `backend/web_client/src/index.ts` — browser-safe env read
13. `feat(phaser): preload core game assets` *(done)*
    - `frontend/phaser/src/assets/gameAssets.ts`
    - `frontend/phaser/src/scenes/BootScene.ts`
    - `frontend/phaser/src/game/config.ts`
14. `feat(phaser): add GP2 session store` *(done)*
    - `frontend/phaser/src/game/GameSession.ts`
    - `frontend/phaser/src/game/GameSession.test.ts`
15. `feat(phaser): add local game menu` *(done)*
    - `frontend/phaser/src/scenes/MenuScene.ts`
    - `frontend/phaser/src/game/config.ts`
16. `feat(phaser): render Autumn board` *(done)*
    - `frontend/phaser/src/scenes/GameScene.ts`
    - `frontend/phaser/src/ui/BoardView.ts`
    - `frontend/phaser/src/game/boardLayout.ts`
    - `frontend/phaser/src/game/config.ts`
17. `feat(phaser): render clearing pieces` *(done)*
    - `frontend/phaser/src/ui/PieceView.ts`
    - `frontend/phaser/src/ui/BoardView.ts`
    - `frontend/phaser/src/game/theme.ts`
18. `feat(phaser): add turn HUD`
    - `frontend/phaser/src/ui/TurnBanner.ts`
    - `frontend/phaser/src/ui/PlayerRail.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
19. `feat(phaser): show player hand`
    - `frontend/phaser/src/ui/CardHand.ts`
    - `frontend/phaser/src/ui/CardView.ts`
    - `frontend/phaser/src/assets/gameAssets.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
20. `feat(phaser): add action composer core`
    - `frontend/phaser/src/game/ActionComposer.ts`
    - `frontend/phaser/src/game/ActionComposer.test.ts`
21. `feat(phaser): add action selection shell`
    - `frontend/phaser/src/ui/ActionTray.ts`
    - `frontend/phaser/src/ui/SelectionPrompt.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
22. `feat(phaser): compose Marquise card actions`
    - `frontend/phaser/src/game/marquiseActionComposer.ts`
    - `frontend/phaser/src/game/marquiseActionComposer.test.ts`
    - `frontend/phaser/src/ui/ActionTray.ts`
    - Craft, spendBird, overwork (paired), discard; also shared craft/discard paths usable by Eyrie seat
23. `feat(phaser): compose Marquise March`
    - `frontend/phaser/src/game/marquiseActionComposer.ts`
    - `frontend/phaser/src/game/marquiseActionComposer.test.ts`
    - `frontend/phaser/src/ui/BoardView.ts`
    - `frontend/phaser/src/ui/SelectionPrompt.ts`
    - Compound 6.5.2: one-move confirm + optional second move → single `march` submit
24. `feat(phaser): compose Marquise board actions`
    - `frontend/phaser/src/game/marquiseActionComposer.ts`
    - `frontend/phaser/src/game/marquiseActionComposer.test.ts`
    - `frontend/phaser/src/ui/ActionTray.ts`
    - `frontend/phaser/src/ui/BoardView.ts`
    - Recruit (once), build (paired), battle initiation
25. `feat(phaser): compose Eyrie birdsong and decree`
    - `frontend/phaser/src/game/eyrieActionComposer.ts`
    - `frontend/phaser/src/game/eyrieActionComposer.test.ts`
    - `frontend/phaser/src/ui/SelectionPrompt.ts`
    - Forced addToDecree (7.4.2), optional newRoost (7.4.3), decree resolve L→R, turmoil when stuck
26. `feat(phaser): show Eyrie decree panel`
    - `frontend/phaser/src/ui/EyrieDecreePanel.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
    - Columns + viziers + cursor/remaining; Builder badge (no leader picker)
27. `feat(phaser): resolve Field Hospitals`
    - `frontend/phaser/src/game/eventActionComposer.ts`
    - `frontend/phaser/src/game/eventActionComposer.test.ts`
    - `frontend/phaser/src/ui/EventOverlay.ts`
28. `feat(phaser): resolve battle events`
    - `frontend/phaser/src/game/eventActionComposer.ts`
    - `frontend/phaser/src/game/eventActionComposer.test.ts`
    - `frontend/phaser/src/ui/BattleOverlay.ts`
29. `feat(phaser): show faction boards`
    - `frontend/phaser/src/ui/FactionDrawer.ts`
    - `frontend/phaser/src/ui/MarquiseBoard.ts`
    - `frontend/phaser/src/ui/EyrieBoard.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
30. `feat(phaser): show game log`
    - `frontend/phaser/src/ui/GameDrawer.ts`
    - `frontend/phaser/src/ui/GameLog.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
31. `feat(phaser): add game undo`
    - `frontend/phaser/src/ui/GameDrawer.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
    - `frontend/phaser/src/game/GameSession.test.ts`
32. `feat(phaser): add hot-seat handoff`
    - `frontend/phaser/src/ui/HandoffOverlay.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
33. `feat(phaser): show game winner`
    - `frontend/phaser/src/ui/WinnerOverlay.ts`
    - `frontend/phaser/src/scenes/GameScene.ts`
34. `docs(phaser): document GP2 play flow`
    - `frontend/phaser/README.md`
    - `README.md`
    - Document `pnpm --filter @root/web gen:openapi` + `pnpm gen:api-client` → `@root/web-client`
