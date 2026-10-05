### Goal
- 2–4 humans play one game, each from their own browser, one seat each.
- Each player sees only their own hand and can act only for their own seat.
- Hotseat ("Start game") and QA flows keep working unchanged.

### Approach
- **Two lobby modes**, chosen at create: `hotseat` (today's behaviour, default) and `online`.
  Mode lives in the web server store, not in `@root/lib`.
- **Player id = secret.** Each browser generates a random id, keeps it in `sessionStorage`
  (already per-tab), joins with it, and sends it as `X-Player-Id` on every request.
- **Server enforces seats in online mode**: an action is accepted only if a legal action
  with that type has `actor` = the caller's seat. Otherwise `403 NOT_YOUR_SEAT`.
- **No leaks in online mode**: REST `GET /game` and `GET /game/actions` return the same
  per-viewer redaction the WebSocket already uses; other players' `playerId` is blanked
  so ids cannot be copied to impersonate a seat.
- **Seats by join order** (lib rule today: seat = join order, faction = `factions[seat]`).
  Host picks the faction list; joiners take the next free seat.
- **Host starts** once every seat is filled.
- **Reload = resume**: stored id still in the slot → reconnect to the same seat.
- Replace the hard-coded 2-player `joinMatch` (`first-player` / `second-player` ids).

Assumptions (say if wrong):
- Start only when the lobby is full; no bots or empty seats.
- Joiners do not pick a faction; join order decides.
- Undo, snapshot load and delete stay open (dev tools), not locked per seat.
- Still one game slot, in memory; a server restart drops the game.
- Game log is not redacted (may show card ids of other players' plays).

### Files to change
- `backend/web/src/store/GameStore.ts`: add lobby mode next to the game.
- `backend/web/src/schemas/game.ts`: `mode` on create body and game responses.
- `backend/web/src/routes/game.ts`: store mode; seat check on `POST /actions` and
  `POST /start`; viewer redaction on `GET /` and `GET /actions`.
- `backend/web/src/view/actionSeatGuard.ts` (new): "may this player send this action".
- `backend/web/src/view/redactStateForViewer.ts`: blank other players' `playerId`.
- `backend/web/src/middleware/cors.ts`: allow `X-Player-Id` header.
- `backend/web_client/src/gameApi.ts`, `schema.d.ts`: `mode` on create, player-id header
  (regenerate with `pnpm gen:api-client`).
- `frontend/react/src/game/playerIdentity.ts`: generate random player id.
- `frontend/react/src/game/GameSession.ts`: `hostOnlineGame`, `joinOnlineGame`, resume;
  drop `joinMatch` constants.
- `frontend/react/src/game/hudStore.ts`, `frontend/react/src/react/MenuOverlay.tsx`,
  `frontend/react/src/App.tsx`: Host / Join buttons, lobby panel (seats joined, Start).
- `.agents/skills/QA/replay-online-two-players.mjs` (new): two browser contexts, one game.

### Test plan
- Web unit (`routes/game.test.ts`, new guard test):
  - online: wrong seat → 403; right seat → 200; missing header → 403.
  - online: pending event (Field Hospitals, Outrage, ambush) accepted only from the
    responding seat, not the current turn seat.
  - hotseat: no header still works (QA scripts unchanged).
  - online `GET /game`: own hand present, other hands empty, other `playerId` blank.
- React unit (`GameSession.test.ts`): host creates + joins + waits; joiner joins next seat;
  resume with stored id; header sent on submit; "Not your seat" surfaced.
- Menu unit: Start disabled until lobby full; only host sees Start.
- End to end: `replay-online-two-players.mjs` — two contexts host/join, play a few turns,
  assert each page shows only its own hand and the off-turn page has no action tray.
- Regression: `replay-wa-vb-qa.mjs` still 17/17; lib and React suites green.

### Commit plan
- done: `feat(web): add online lobby mode to game slot`
  - `backend/web/src/store/GameStore.ts`
  - `backend/web/src/schemas/game.ts`
  - `backend/web/src/routes/game.ts`
  - `backend/web/src/routes/game.test.ts`
- done: `feat(web): enforce player seat on actions in online mode`
  - `backend/web/src/view/actionSeatGuard.ts`
  - `backend/web/src/view/actionSeatGuard.test.ts`
  - `backend/web/src/routes/game.ts`
  - `backend/web/src/routes/game.test.ts`
  - `backend/web/src/middleware/cors.ts`
  - `backend/web/src/middleware/cors.test.ts`
- done: `fix(web): redact REST game views per player in online mode`
  - `backend/web/src/view/redactStateForViewer.ts`
  - `backend/web/src/view/redactStateForViewer.test.ts`
  - `backend/web/src/routes/game.ts`
  - `backend/web/src/routes/game.test.ts`
- done: `feat(web-client): send player id and lobby mode`
  - `backend/web_client/src/gameApi.ts`
  - `backend/web_client/src/schema.d.ts`
  - `frontend/react/src/api/client.ts`
- done: `feat(ui): host, join and resume online game in session`
  - `frontend/react/src/game/playerIdentity.ts`
  - `frontend/react/src/game/playerIdentity.test.ts`
  - `frontend/react/src/game/GameSession.ts`
  - `frontend/react/src/game/GameSession.test.ts`
- done: `feat(ui): online lobby in menu`
  - `frontend/react/src/game/hudStore.ts`
  - `frontend/react/src/react/MenuOverlay.tsx`
  - `frontend/react/src/App.tsx`
- done: `test(qa): two-browser online replay`
  - `.agents/skills/QA/replay-online-two-players.mjs`
