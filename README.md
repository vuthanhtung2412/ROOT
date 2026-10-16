# Root

TypeScript implementation of the Root board game (GP2 playable: Marquise vs Eyrie Builder; GP1 also supported).

## Packages

| Package | Path | Role |
|---------|------|------|
| `@root/lib` | `lib/` | Pure game engine — rules, state, actions, snapshot JSON |
| `@root/web` | `backend/web/` | Hono HTTP API — **one game slot**, no rooms |
| `@root/web-client` | `backend/web_client/` | Generated OpenAPI client (`createRootWebClient`) |
| `@root/cli` | `frontend/cli/` | Terminal client — talks **only** to web API |
| `@root/react` | `frontend/react/` | React GP2 hot-seat UI — talks **only** to web API |

## Quick start

```bash
pnpm install
pnpm -r typecheck
```

### Library

```bash
pnpm --filter @root/lib test
pnpm --filter @root/lib build
```

Use `Game.create` / `join` / `start` / `apply` / `legalActions` / `undo` / `toJSON` / `fromJSON` from `@root/lib`.

### Web API

```bash
pnpm --filter @root/web dev    # http://localhost:3000
pnpm dev                       # web + React UI + AI player stream (process-compose TUI)
```

Remote play (friends): **`pnpm remote`** — build + serve + Tailscale Funnel URL. See `frontend/react/README.md`.

Single game slot at `/game/...` (no game id):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/game?replace=1` | Create lobby `{ factions? }` |
| POST | `/game/join` | `{ playerId }` |
| POST | `/game/start` | Start when ≥2 players |
| GET | `/game` | Current state |
| GET | `/game/snapshot` | Full `GameSnapshot` (lossless JSON) |
| PUT | `/game/snapshot?replace=1` | Load `GameSnapshot` into slot |
| GET | `/game/actions` | Legal action specs |
| GET | `/game/actions/explained` | Legal action types in plain words: kind, Law of Root rules, JSON Schema (no legal values) |
| POST | `/game/actions` | Apply an `Action` |
| GET | `/game/log` | Event log |
| POST | `/game/undo` | Undo last action |
| GET | `/game/map.svg` | Fall map SVG |
| GET | `/game/map.ascii` | Fall map ASCII |
| DELETE | `/game` | Clear slot |
| GET | `/map/fall` | Fall graph JSON |
| GET | `/map/fall/layout` | Layout coords |

Errors: `400` RuleError `{ code, detail }`, `404` no game, `409` slot occupied.

### CLI

```bash
# terminal 1
pnpm --filter @root/web dev

# terminal 2 (ROOT_DEV_API from .env via mise _.file)
pnpm --filter @root/cli start -- new
pnpm --filter @root/cli start -- join alice
pnpm --filter @root/cli start -- join bob
pnpm --filter @root/cli start -- start
pnpm --filter @root/cli start -- show
pnpm --filter @root/cli start -- actions
pnpm --filter @root/cli start -- act '{"type":"endPhase"}'
pnpm --filter @root/cli start -- log
pnpm --filter @root/cli start -- undo
# dump → edit → reload GameSnapshot
curl -s "$ROOT_DEV_API/game/snapshot" -o snap.json
pnpm --filter @root/cli start -- load snap.json

# GP1 smoke: random agent
pnpm --filter @root/cli start -- auto --turns 50 --players 2
```

`new` always uses `?replace=1`. Optional `--factions marquise,eyrie`.

### React UI (GP2 hot-seat)

```bash
# terminal 1
pnpm --filter @root/web dev

# terminal 2
pnpm --filter @root/react dev
```

Open the Vite URL. **New GP2 game** creates Marquise vs Eyrie, joins both seats, and starts. See `frontend/react/README.md`.

Regenerate shared API client after OpenAPI changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

### CORS

The API allows localhost, LAN and Capacitor origins. Add more with `ROOT_CORS_ORIGINS` (comma list, server env), e.g. `ROOT_CORS_ORIGINS=https://vuthanhtung2412.github.io`.

### GitHub Pages

`pnpm remote:pages` = `pnpm remote` plus `scripts/sync-pages.sh` (set `ROOT_CORS_ORIGINS=https://<owner>.github.io` in `.env`): once the Funnel URL answers, it builds the **checked-out commit** with `ROOT_WEB_API` = that URL and `ROOT_WEB_BASE_PATH=/<repo>/`, pushes `frontend/react/dist` to the `gh-pages` branch (one commit, no history) and points Pages at it. The site at `https://<owner>.github.io/<repo>/` always matches your local checkout, so `git checkout <old-commit> && pnpm remote:pages` deploys that version. Needs `gh auth login`.

### AI players

A seat can be played by an LLM. API keys stay on the server: clients only see model ids.

Server env (`backend/web`):

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Enables `anthropic:<modelId>` models |
| `OPENAI_API_KEY` | Enables `openai:<modelId>` models |
| `ROOT_AI_PLAYER_MODELS` | Comma list offered in the lobby, e.g. `anthropic:claude-opus-5-5,openai:<modelId>`. Unset = the default model only |
| `ROOT_AI_PLAYER_DEFAULT_MODEL` | Preselected model. Unset = `anthropic:claude-opus-5-5` |

A model whose provider has no key is not offered.

- **Add one**: host's online lobby → *Add an AI player* (faction + model), or `POST /game/ai-players` `{ "faction": "eyrie", "model": "anthropic:claude-opus-5-5" }`. The model is fixed once the game starts (`PATCH /game/ai-players/{seat}` works in the lobby only).
- **How it plays**: one session (one context window) per AI turn, dropped when the turn ends; a decision outside its turn (ambush, setup choice) gets a short session of its own. It waits 2 s after each action. Core tools: `show`, `actions` (kind, rules, JSON Schema per action type; `root-cli explain`), `rules`, `act`. Helpers: `actionChoices` (values on offer, for pending decisions; `root-cli actions`), `log`, `card`, `clearing`, `score`, `preview` and one per faction (`decree`, `workshops`, `sympathy`).
- **Stuck** (provider error, refusal, tool-call limit): the seat shows a warning badge and the game waits. Restart its session:

```bash
pnpm --filter @root/cli start -- ai-restart <seat>   # POST /game/ai-players/{seat}/restart
```

- **Watch it think**: every message to the model, its reply, each tool call and result, and why a session failed. `pnpm dev` shows it in the `ai-stream` process; on its own:

```bash
pnpm --filter @root/cli start -- ai-stream          # GET /game/ai-players/stream (server-sent events)
pnpm --filter @root/cli start -- ai-stream --full   # long texts whole
```

  The server also writes all of it, texts whole, to `logs/<game stamp>/ai-players.jsonl` (one JSON line per activity) beside `game.md`. `THINKS` lines are the model's own thinking summaries (Anthropic adaptive thinking); asking a model to write its reasoning in its reply is refused by the API (`reasoning_extraction`). A `FAILED` line carries what the provider said about the stop.

  The stream shows the AI player's hand and has no seat check (operator tool): keep it off a server opponents can reach.

- **Play a seat from the terminal** with the same view an AI player has (other hands hidden, only that seat may act, also in hotseat):

```bash
pnpm --filter @root/cli start -- --player-id bob show
pnpm --filter @root/cli start -- --player-id bob actions
pnpm --filter @root/cli start -- --player-id bob explain              # kind, rules, JSON Schema per action type
pnpm --filter @root/cli start -- --player-id bob act '{"type":"endPhase"}'
pnpm --filter @root/cli start -- rules 4.3          # or: rules ambush defender
pnpm --filter @root/cli start -- --player-id bob card                 # hand: cost, text, craftable now
pnpm --filter @root/cli start -- --player-id bob clearing 10          # pieces, ruler, slots, can I build
pnpm --filter @root/cli start -- --player-id bob score                # standings and own supply
pnpm --filter @root/cli start -- --player-id bob decree               # Eyrie; workshops = Marquise, sympathy = Alliance
pnpm --filter @root/cli start -- --player-id bob preview '{"type":"endPhase"}'   # dry run, applies nothing
```

- **Add a provider**: implement `ModelProvider` in `backend/web/src/aiPlayer/providers/`, add it to `providerRegistry.ts` and to `MODEL_PROVIDER_NAMES` in `modelIdentifier.ts`.

## Resources

- `resources/rules/` — Law of Root (SoT: PDF + markdown); Law of Rootbotics for Clockwork/electric bots (PDF + markdown + Electric Eyrie errata)
- `resources/notes/` — plans + simplified implementable base rules (non-SoT)
- `resources/reference/` — cards, map assets (not imported at runtime by CLI)
