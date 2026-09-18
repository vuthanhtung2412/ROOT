# `@root/phaser`

Vite + Phaser 3 **GP2 hot-seat client**: Marquise vs Eyrie (Builder).

Phaser **never mutates** engine state. It reads `/game` + `/game/actions`, stages choices in composers, and submits `Action` JSON. Refresh after every command.

## Play GP2 (local)

```bash
# terminal 1 — API
pnpm --filter @root/web dev

# terminal 2 — Phaser (proxies /game + /map to API)
pnpm --filter @root/phaser dev
```

Open Vite URL (default `http://localhost:5173`).

1. **New GP2 game** — creates lobby, joins `marquise` + `eyrie`, starts
2. Board + HUD + hand + action tray
3. Compose actions (March is one compound submit; Add to Decree forced when hand nonempty)
4. Hot-seat **handoff curtain** when actor seat changes (privacy is UI-only; API still exposes all hands)
5. Undo from game drawer; winner overlay at 30 VP / finished

## Architecture

| Layer | Role |
|---|---|
| `GameSession` | create/join/start/action/undo + refresh |
| `ActionComposer` + faction/event hooks | stage choices → `Action` |
| Scenes | Boot → Menu → Game |
| UI | board, HUD, hand, trays, overlays |

## Assets

- Autumn map + Marquise/Eyrie icons under `public/assets/` (from `resources/reference/`)
- EP card faces under `public/assets/cards/` — **hold** a hand card (~350ms) for name + rules text
- Pieces: faction icon + count (building/token stacks show a type badge)
- Dev-only Leder reference art — not for redistribution

## API client

Shared typed client: `@root/web-client` (`backend/web_client`).

```ts
import { createRootWebClient } from '@root/web-client'
```

Phaser wraps it in `createPhaserApi()` (`src/api/client.ts`) with `baseUrl: ''` so Vite proxy works.

Regenerate after API shape changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/phaser dev` | Vite + API proxy |
| `pnpm --filter @root/phaser test` | Vitest (factories + mocked fetch) |
| `pnpm --filter @root/phaser typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/phaser build` | production → `dist/` |
| `pnpm gen:api-client` | regenerate `@root/web-client` |

## Out of scope

Alliance, Vagabond, remote multiplayer, secure hidden hands, AI, WebSocket push, production asset licensing.
