# Root

TypeScript implementation of the Root board game (GP2 playable: Marquise vs Eyrie Builder; GP1 also supported).

## Packages

| Package | Path | Role |
|---------|------|------|
| `@root/lib` | `lib/` | Pure game engine — rules, state, actions, snapshot JSON |
| `@root/web` | `backend/web/` | Hono HTTP API — **one game slot**, no rooms |
| `@root/web-client` | `backend/web_client/` | Generated OpenAPI client (`createRootWebClient`) |
| `@root/cli` | `frontend/cli/` | Terminal client — talks **only** to web API |
| `@root/phaser` | `frontend/phaser/` | Phaser GP2 hot-seat UI — talks **only** to web API |

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
pnpm dev                       # web + Phaser (process-compose TUI)
```

Remote play (friends): **`pnpm remote`** — build + serve + Tailscale Funnel URL. See `frontend/phaser/README.md`.

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

### Phaser (GP2 hot-seat)

```bash
# terminal 1
pnpm --filter @root/web dev

# terminal 2
pnpm --filter @root/phaser dev
```

Open the Vite URL. **New GP2 game** creates Marquise vs Eyrie, joins both seats, and starts. See `frontend/phaser/README.md`.

Regenerate shared API client after OpenAPI changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

## Resources

- `resources/rules/` — Law of Root (SoT: PDF + markdown); Law of Rootbotics for Clockwork/electric bots (PDF + markdown + Electric Eyrie errata)
- `resources/notes/` — plans + simplified implementable base rules (non-SoT)
- `resources/reference/` — cards, map assets (not imported at runtime by CLI)
