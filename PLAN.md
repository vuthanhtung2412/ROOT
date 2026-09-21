### Goal
- Two humans on **different machines** play one GP2 game via Phaser.
- **Authoritative state stays on `@root/web`** (one game slot, unchanged).
- **State updates push over WebSocket**; commands stay REST (`POST /game/...`).
- **Deprecate one-screen hot-seat** (no shared-keyboard path in menu / GameSession).
- Phaser remembers **`localPlayerId`** across refresh so Continue / reconnect resume same seat.
- In-game **End game** button deletes server slot (`DELETE /game`) and returns to menu.
- Opponent **hand cards never reach** the other Phaser client.

### Approach
- **Model**: Host machine runs `@root/web`. Both Phaser clients talk to that host (LAN IP or `localhost`).
- **Commands (REST)**: create / join / start / action / undo / delete — same routes as today.
- **CLI**: REST response bodies stay **full** (unredacted) — QA / agents unchanged.
- **Updates (WS)**: `GET /ws?playerId=…` upgrade. On connect + after every successful mutation, server sends **per-viewer** payload: `{ state, historyLength, legalActions, log }` where `state` runs through `redactStateForViewer(state, playerId)` (own hand intact; other seats’ `hand` emptied / card defs stripped; public board + counts OK).
- **Phaser vs REST leak**: after mutation Phaser **does not trust** unfiltered REST `state` for UI — apply redacted WS push (or optional `?viewerPlayerId=` on GET later). CLI never sends viewer id → full JSON.
- **Empty game**: no slot → WS payload `{ state: null, … }` (or close); GameScene → MenuScene.
- **Identity**: each client keeps `localPlayerId` (join id). Derive `localSeat` from `state.players`. Only that seat may submit when it is actor. No handoff overlay (hot-seat gone).
- **Persist playerId**: on host/join only, write `{ playerId, apiBaseUrl? }` to `localStorage`. Continue + WS reconnect read it; match `state.players[].playerId` → seat. Missing / unknown id → stay menu with clear error (do not invent new join into full/playing game).
- **Lobby**: Host `POST /game` (**no** `replace=1`; 409 if occupied) + `POST /join` self → wait. Guest `POST /join`. Either side `POST /start` when `players.length === 2`. WS push wakes both UIs.
- **Menu**: Host / Join / Continue (restore playerId) / **QA-only** “Continue loaded game” (poll full slot via REST — label as QA; not for normal play). Remove “New GP2” hot-seat.
- **End game**: GameDrawer **End game** → confirm → `GameSession.restart()` / `DELETE /game` → clear stored playerId → MenuScene. Broadcast empty so peer returns menu.
- **LAN wiring**: Hono CORS; Vite `server.host` + proxy `/ws`; Phaser `baseUrl` / `wsUrl` from env or menu text field (default same-origin proxy). WS stack: Hono node helper + `ws` (`createNodeWebSocket` / equivalent) — pick one in first commit.
- **Out of scope (this plan)**: multi-room, auth tokens, WAN relay/NAT traversal, action-over-WS, encrypting CLI/full dumps.

### Files to change
- `backend/web/package.json`: add `ws` (+ types if needed).
- `backend/web/src/ws/GameHub.ts`: sockets keyed by `playerId` + `broadcastGame()` per-viewer redact.
- `backend/web/src/view/redactStateForViewer.ts`: strip opponent hands (+ unit test).
- `backend/web/src/routes/ws.ts`: `/ws` upgrade + snapshot on open.
- `backend/web/src/routes/game.ts`: call `broadcastGame()` after create/join/start/action/undo/delete.
- `backend/web/src/index.ts`: wire WS upgrade on `serve`.
- `backend/web/src/middleware/cors.ts` (or inline): allow Phaser origins.
- `frontend/phaser/vite.config.ts`: proxy `/ws`, `server.host: true`.
- `frontend/phaser/src/api/client.ts`: absolute `baseUrl`; Host create **without** `replace=1`; drop hot-seat-only replace default (or `createGame({ replace })`).
- `frontend/phaser/src/api/gameSocket.ts`: connect with `playerId`, parse push, reconnect light.
- `frontend/phaser/src/game/playerIdentity.ts`: read/write/clear `localStorage`.
- `frontend/phaser/src/game/GameSession.ts`: host/join/start/continue-by-id; apply WS snapshot; remove `startHotSeatGame`; `restart()` clears identity.
- `frontend/phaser/src/scenes/MenuScene.ts`: Host / Join / Continue / QA Continue loaded; remove New GP2 hot-seat.
- `frontend/phaser/src/scenes/GameScene.ts`: gate tray to `localSeat`; remove handoff overlay path.
- `frontend/phaser/src/ui/GameDrawer.ts`: **End game** beside Undo → `onEndGame`.
- `frontend/phaser/src/ui/HandoffOverlay.ts`: unused → delete or leave dead until cleanup commit.
- `frontend/phaser/README.md`: LAN how-to + continue + end game + QA continue note.

### Test plan
- Unit: `redactStateForViewer` — own hand kept; opponent hand empty; board pieces unchanged.
- Unit: `GameHub` — N mock sockets each get **own** redaction; ignore dead sockets; empty game payload.
- Unit: `GameSession` apply WS payload; host/join call REST once each; no hot-seat helper.
- Unit: `playerIdentity` save / load / clear (mock `localStorage`).
- Unit: Continue with stored playerId maps to seat; unknown id errors.
- Unit: input gate — `submitAction` no-op / error when `localSeat !== actorSeat`.
- Unit: End game → `DELETE /game` + identity cleared + snapshot null.
- Manual LAN:
  1. Machine A: `pnpm --filter @root/web dev` + Phaser Host → lobby waiting.
  2. Machine B: Phaser Join with A’s IP → both see 2 players via WS.
  3. Start → alternate turns; B sees A’s move without refresh; **B never sees A’s card faces**.
  4. Refresh B → Continue → same seat, can play when actor.
  5. Pending event for other seat: waiting client cannot submit; actor client can.
  6. End game on A → slot empty; B gets empty WS → menu; Host create works again (no replace).
  7. CLI `get` / `act` still show **full** hands (QA).
  8. Menu QA “Continue loaded game” still loads slot for playtest dumps.

### Commit plan
- `feat(web): add GameHub websocket broadcast`
  - `backend/web/package.json`
  - `backend/web/src/ws/GameHub.ts`
  - `backend/web/src/ws/GameHub.test.ts`
  - `backend/web/src/routes/ws.ts`
  - `backend/web/src/index.ts`
- `feat(web): redact opponent hands per viewer`
  - `backend/web/src/view/redactStateForViewer.ts`
  - `backend/web/src/view/redactStateForViewer.test.ts`
  - `backend/web/src/ws/GameHub.ts` (use redact in broadcast)
- `feat(web): push snapshot after game mutations`
  - `backend/web/src/routes/game.ts`
- `feat(web): cors for remote phaser clients`
  - `backend/web/src/middleware/cors.ts` (or `openapi.ts` / `index.ts`)
- `feat(phaser): game socket client`
  - `frontend/phaser/src/api/gameSocket.ts`
  - `frontend/phaser/src/api/client.ts`
  - `frontend/phaser/vite.config.ts`
- `feat(phaser): persist local playerId`
  - `frontend/phaser/src/game/playerIdentity.ts`
  - `frontend/phaser/src/game/playerIdentity.test.ts`
- `feat(phaser): remote host and join session`
  - `frontend/phaser/src/game/GameSession.ts`
  - `frontend/phaser/src/game/GameSession.test.ts`
  - (wire WS apply; drop `startHotSeatGame`; create without replace)
- `feat(phaser): menu host join continue`
  - `frontend/phaser/src/scenes/MenuScene.ts`
  - (Host / Join / Continue by id; QA Continue loaded kept; remove New GP2)
- `feat(phaser): gate seat input drop handoff`
  - `frontend/phaser/src/scenes/GameScene.ts`
  - `frontend/phaser/src/ui/HandoffOverlay.ts` (delete if unused)
- `feat(phaser): end game delete button`
  - `frontend/phaser/src/ui/GameDrawer.ts`
  - `frontend/phaser/src/scenes/GameScene.ts`
  - `frontend/phaser/src/game/GameSession.ts`
- `docs(phaser): lan two-player howto`
  - `frontend/phaser/README.md`
