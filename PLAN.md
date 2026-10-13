### Goal
- A seat (one faction) can be played by an LLM ("AI player") instead of a human.
- Picking the model is a config choice, not a code change (per seat, chosen in the lobby).
- API keys live only in server env (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). Nothing key-related reaches the frontend.
- The AI decides with tools: its own redacted game state, its legal actions, the game log, and rule lookup.
- The tools mirror `root-cli` commands, so the same player view is usable from the terminal.

### Approach
- **Where it runs**: all AI code in `backend/web/src/aiPlayer/`. The server already owns the game, redaction and legal actions. The frontend only sends/receives model ids.
- **Model id format**: `<provider>:<modelId>`, e.g. `anthropic:claude-opus-5-5`, `openai:<id>`.
  - `ROOT_AI_PLAYER_MODELS` (comma list) = models offered in the lobby. No OpenAI id is hardcoded.
  - `ROOT_AI_PLAYER_DEFAULT_MODEL` = default, falls back to `anthropic:claude-opus-5-5`.
  - A provider whose key is missing is dropped from the offered list.
  - Model is fixed once the game starts: `PATCH /game/ai-players/{seat}` works in the lobby only.
- **Provider interface**: one small `ModelProvider` interface (`runTurn(request): Promise<ModelTurn>`: system prompt + messages + tool definitions in, text + tool calls out). Two adapters on the official SDKs: `@anthropic-ai/sdk` and `openai`. A registry maps the provider prefix to the adapter. Adding a provider = one adapter file + one registry line.
  - Anthropic adapter: adaptive thinking, `tool_choice: auto` (forced tool choice is rejected by current models), prompt caching on system prompt + tools, `refusal` stop reason handled as a failed session.
- **Tools** = `root-cli` commands (one registry, each = name + description + zod schema + handler bound to the AI seat's `playerId`):

  | Tool | `root-cli` | Returns |
  |---|---|---|
  | `show` | `show` | own state, other hands hidden (`redactStateForViewer`) |
  | `actions` | `actions` | legal actions where `actor` is this seat |
  | `log` | `log` | recent log, redacted (`redactLogForViewer`) |
  | `rules` | `rules <query \| sectionNumber>` | matching sections of `Law_of_Root.md` (split by numbered heading, loaded once) |
  | `act` | `act '<json>'` | applies the action; a rule error comes back as a tool error so the model can correct itself |

- **Forced redaction**: a `root-cli --player-id <id>` call is always redacted and seat-checked, in hotseat too. Done with a `view=player` query on `GET /game`, `GET /game/actions`, `GET /game/log`, `POST /game/actions` (plain hotseat calls from the UI stay unchanged). The in-server tools use the same handlers.
- **Session = one AI turn** (whole turn, not a phase):
  - Starts when the turn passes to an AI seat: fresh context = system prompt (faction, goal, how to use the tools) + tool list.
  - Kept in server memory for the whole turn (Birdsong → Daylight → Evening). Every model reply and tool result is appended, so nothing is lost between phases.
  - Pauses while another seat must answer (e.g. defender ambush) and resumes with the same context.
  - Ends when the turn passes to the next seat; the context is dropped.
  - Off-turn decisions of an AI seat (ambush, Field Hospitals, Outrage, setup choices) get a short reaction session that ends when the decision is resolved.
  - No memory between turns: a new turn knows only the game state and the log.
  - Pacing: after each applied `act` the session waits `AI_PLAYER_ACTION_DELAY_MILLISECONDS` (2000) so humans can follow.
  - One session per seat at a time. Capped by `MAX_TOOL_CALLS_PER_SESSION`.
  - Aborted when history length shrinks (undo) or the game is replaced; a new session starts from the new state.
- **Failure**: provider error, refusal or cap hit → seat status `stuck`, game waits. No random fallback move, no automatic retry beyond the SDK's own.
  - `POST /game/ai-players/{seat}/restart` (+ `root-cli ai-restart <seat>`): drop the active session and start a fresh one from the current game state. Actions already applied this turn stay. Works on a `thinking` seat too. No seat check (operator tool, endpoint + CLI only, not in the UI).
- **AI seats**: kept in the server store (not in `lib` game state): `playerId -> { model, status }`. Saved in the persistence slot; after a server restart the active AI turn starts a fresh session.
- **API**:
  - `GET /game/ai-models` → `{ models, defaultModel }`.
  - `POST /game/ai-players` `{ faction?, model? }` → server makes the `playerId`, joins the seat. Host only in online mode.
  - `PATCH /game/ai-players/{seat}` `{ model }` → lobby only.
  - `POST /game/ai-players/{seat}/restart`.
  - `GET /game/rules?query=` → rule lookup.
  - Game push payload gains `aiPlayers: [{ seat, model, status }]` (`idle | thinking | stuck`).
- **Frontend**: lobby gets "Add AI player" + model select; seat shows an AI badge with model and thinking/stuck status (no restart control in the UI). Client regenerated with `pnpm gen:api-client`.

### Files to change
- `backend/web/package.json`: add `@anthropic-ai/sdk`, `openai`.
- `backend/web/src/aiPlayer/modelIdentifier.ts`: parse/validate `<provider>:<modelId>`, env catalog.
- `backend/web/src/aiPlayer/ModelProvider.ts`: neutral interface + types.
- `backend/web/src/aiPlayer/providers/anthropicProvider.ts`, `openAiProvider.ts`, `providerRegistry.ts`.
- `backend/web/src/aiPlayer/rulebook.ts`: load + section split + search.
- `backend/web/src/aiPlayer/aiPlayerTools.ts`: tool registry.
- `backend/web/src/aiPlayer/aiPlayerPrompt.ts`: system prompt.
- `backend/web/src/aiPlayer/AiPlayerSession.ts`: one session = context + tool loop.
- `backend/web/src/aiPlayer/AiPlayerDriver.ts`: start / resume / end / abort / restart sessions.
- `backend/web/src/store/GameStore.ts`, `store/gamePersistence.ts`: AI seat registry.
- `backend/web/src/routes/aiPlayer.ts`, `routes/rules.ts`, `schemas/aiPlayer.ts`, `openapi.ts`: new routes.
- `backend/web/src/routes/game.ts`: `view=player` forced redaction; call the driver from `publishGameChange`.
- `backend/web/src/ws/GameHub.ts`: `aiPlayers` in the push payload.
- `backend/web_client/src/*`: regenerated + `gameApi.ts` methods.
- `frontend/cli/src/index.ts`, `api/client.ts`, `commands/rules.ts`, `commands/aiRestart.ts`.
- `frontend/react/src/game/menuLobby.ts`, `react/MenuLobbyPanel.tsx`, seat badge component, `api/client.ts`.
- `README.md`: env vars + how to add an AI player.

### Test plan
- Unit (vitest, fixtures + a scripted fake `ModelProvider`, no network):
  - `modelIdentifier`: parse, unknown provider, provider without key dropped.
  - `rulebook`: section split and search on a small fixture markdown.
  - `aiPlayerTools`: `show` / `log` / `actions` never contain another seat's hand; `act` rejects a wrong-seat action and returns rule errors.
  - `AiPlayerSession`: scripted tool calls end in applied actions; context grows across phases; cap hit; illegal action then corrected; delay between applied actions (fake timers).
  - `AiPlayerDriver`: one session for the whole turn, dropped at turn end; resume after another seat answers; reaction session off-turn; abort on undo; `stuck` on provider error; restart makes a fresh context.
  - Routes: add AI player, model change rejected after start, add AI player host-only in online mode, restart open to any caller, `view=player` redacts in hotseat.
  - Key leak: no route response or push payload contains the env key values.
  - Adapters: request mapping tested with a mocked SDK client.
- Checks: `pnpm typecheck`, `pnpm lint`, `pnpm --filter @root/web test`, `grep` for `API_KEY` under `frontend/` returns nothing.
- Manual QA: human Marquise vs AI Eyrie to turn 5; undo while the AI is thinking; kill the network mid-turn then `root-cli ai-restart`; play one game with an OpenAI model; `root-cli --player-id` in hotseat shows no other hand.

### Commit plan
- `feat(web): parse AI player model ids and env model catalog`
  - `backend/web/src/aiPlayer/modelIdentifier.ts` (+ test)
- `feat(web): rulebook section lookup and search`
  - `backend/web/src/aiPlayer/rulebook.ts` (+ test)
- `feat(web): forced player view on game routes`
  - `backend/web/src/routes/game.ts` (+ test)
- `feat(web): AI player tool registry mirroring root-cli commands`
  - `backend/web/src/aiPlayer/aiPlayerTools.ts` (+ test)
- `feat(web): model provider interface and per-turn AI player session`
  - `backend/web/src/aiPlayer/ModelProvider.ts`, `aiPlayerPrompt.ts`, `AiPlayerSession.ts` (+ test)
- `feat(web): Anthropic model provider`
  - `backend/web/package.json`, `pnpm-lock.yaml`, `backend/web/src/aiPlayer/providers/anthropicProvider.ts`, `providerRegistry.ts` (+ test)
- `feat(web): OpenAI model provider`
  - `backend/web/package.json`, `pnpm-lock.yaml`, `backend/web/src/aiPlayer/providers/openAiProvider.ts`, `providerRegistry.ts` (+ test)
- `feat(web): AI seat registry saved with the game slot`
  - `backend/web/src/store/GameStore.ts`, `store/gamePersistence.ts` (+ test)
- `feat(web): AI player driver runs one session per AI turn`
  - `backend/web/src/aiPlayer/AiPlayerDriver.ts` (+ test), `backend/web/src/routes/game.ts`
- `feat(web): routes to list models, add an AI player and set its model in the lobby`
  - `backend/web/src/routes/aiPlayer.ts` (+ test), `schemas/aiPlayer.ts`, `openapi.ts`, `ws/GameHub.ts`
- `feat(web): route to restart the active AI player session`
  - `backend/web/src/routes/aiPlayer.ts` (+ test), `schemas/aiPlayer.ts`
- `feat(web): rule lookup route`
  - `backend/web/src/routes/rules.ts` (+ test), `openapi.ts`
- `feat(web-client): regenerate client with AI player and rules routes`
  - `backend/web_client/src/*`
- `feat(cli): --player-id forced player view, rules and ai-restart commands`
  - `frontend/cli/src/index.ts`, `api/client.ts`, `commands/rules.ts`, `commands/aiRestart.ts`
- `feat(ui): add AI player with model select in the lobby`
  - `frontend/react/src/game/menuLobby.ts` (+ test), `react/MenuLobbyPanel.tsx`, `api/client.ts`
- `feat(ui): AI seat badge with model and status`
  - seat badge component, `frontend/react/src/game/hudStore.ts`
- `docs: AI player env vars and usage`
  - `README.md`
