## Follow-up: deprecate `GET /game/actions`

### Goal
- No legal action specs (`params`) on the wire. Today they are bloated (march, riverfolkMove, build, setServiceCosts reach 60–100 options, 3–4 KB each) and still miss march's second move.
- The client works out its own legal actions from its (redacted) state with `lib` rules. The server keeps validating every action.
- AI and CLI read `GET /game/actions/explained` (kind, rules, schema) and `preview` instead of `params`.
- Removed: `GET /game/actions`, `legalActions` in the WS push and in the `act` tool result. Kept: `POST /game/actions` (apply).

### Approach
1. `lib`: pull the body of `Game.legalActions()` into a pure `legalActionsOf(state)`: builds the same ctx (Fall map, rule hooks, card grants) with an rng that throws if used, since listing actions must never roll. `Game.legalActions()` calls it; the lobby branch stays in `Game`.
2. Parity guard: in random-play fixture games, at every step, for the acting seat, `legalActionsOf(redactStateForViewer(state, actor))` equals `redactLegalActionsForViewer(game.legalActions(), …)`. This proves hidden info (other hands, deck) never decides your own legal actions. Any mismatch → stop and ask before fixing.
3. React: `GameSession.refresh()` and the WS handler compute `legalActions` with `legalActionsOf(state)` instead of reading them from the server. The composers keep reading the same `ActionSpec` shape, so `ActionComposer` / `ActionTray` / flows stay untouched.
4. AI: the `actions` tool returns the explained list; the `act` result returns it too (replaces `legalActions`). Prompt: drop the "pick a value from each param" paragraph; build the action from `schema` + `rules` + `show` / `clearing` / `card`, check with `preview`, the engine rejects illegal ones. Internal uses of `listPlayerLegalActions` (driver, card/clearing detail, seat guard) stay server side.
5. CLI: `actions` prints the explained list. `auto` gets `@root/lib` and runs `legalActionsOf` on the fetched state.
6. API: remove `GET /game/actions` and `legalActions` from the WS push. Regenerate the client with `pnpm gen:api-client`; remove `legalActions()` from `gameApi.ts`.

### Risks
- Hidden info: if a seat's own legal actions depend on another seat's hidden info (hand, deck, face-down cards), a redacted client cannot compute them. The parity test (step 2) is the gate; a mismatch stops the plan.
- Scope: "UI computes clickables" is read as running `lib`'s legal-action code on the client. Composers keep the `ActionSpec` shape; no rewrite of the composer layer.
- AI play quality: the AI loses the list of exact legal values. It relies on rules + board, `preview`, and the server's rejection errors. Watch for retry loops in `ai-stream`.
- Bloat moves, not gone: march / riverfolkMove / build `params` stay large, now only in the client's memory. No wire or token cost; compact later if UI speed suffers.
- Hidden randomness: listing actions must never roll. The throwing rng in `legalActionsOf` makes any roll a loud failure instead of a client/server desync.

### Test plan
- `lib`: `legalActionsOf` equals `Game.legalActions()` on fixture games (Marquise daylight, Eyrie decree, pending event). Throwing rng never fires.
- Backend parity test (step 2) over all six factions, fixed seeds.
- React: `GameSession.test.ts` and `gameSocket.test.ts` publish locally computed legal actions; the push has no `legalActions` field.
- AI: tool tests: `actions` returns kind/rules/schema with no `params`; `act` result carries the explained list.
- Backend route test: `GET /game/actions` → 404; `POST /game/actions` unchanged.
- Manual: React game of Marquise vs Eyrie, one full turn each (march two moves, build, recruit, decree); `pnpm --filter @root/cli start -- auto --turns 20`; one AI turn via `ai-stream`.

### Commit plan
- `refactor(lib): legal actions as a pure function of state`
  - `lib/src/game/legalActionsOf.ts` (new)
  - `lib/src/game/legalActionsOf.test.ts` (new)
  - `lib/src/game/Game.ts`
  - `lib/src/index.ts`
- `test(web): client legal actions match server on redacted state`
  - `backend/web/src/view/viewerLegalActionsParity.test.ts` (new)
- `feat(react): compute legal actions locally`
  - `frontend/react/src/game/GameSession.ts`
  - `frontend/react/src/game/GameSession.test.ts`
  - `frontend/react/src/api/gameSocket.ts`
  - `frontend/react/src/api/gameSocket.test.ts`
- `feat(ai): actions tool lists explained actions, no params`
  - `backend/web/src/aiPlayer/aiPlayerTools.ts`
  - `backend/web/src/aiPlayer/aiPlayerTools.test.ts`
  - `backend/web/src/aiPlayer/aiPlayerPrompt.ts`
- `feat(cli): actions and auto without GET /game/actions`
  - `frontend/cli/package.json`, `pnpm-lock.yaml`
  - `frontend/cli/src/commands/actions.ts`
  - `frontend/cli/src/commands/auto.ts`
- `feat(api)!: remove GET /game/actions and pushed legal actions`
  - `backend/web/src/routes/game.ts`
  - `backend/web/src/routes/game.test.ts`
  - `backend/web/src/schemas/game.ts`
  - `backend/web/src/ws/GameHub.ts`
  - `backend/web/openapi.json`
  - `backend/web_client/src/schema.d.ts` (generated)
  - `backend/web_client/src/gameApi.ts`
  - `README.md` (endpoint table)
