# `@root/phaser`

Vite + Phaser 3 **GP2 remote client**: Marquise vs Eyrie (Builder). Two browser sessions talk to one `@root/web`.

Phaser **never mutates** engine state. Commands go REST (`POST /game/...`). UI state comes from **WebSocket** pushes (`/ws?playerId=…`) with **opponent hands redacted**. CLI/REST keep full state for QA.

## Play GP2 (one machine, two windows)

```bash
pnpm --filter @root/web dev
pnpm --filter @root/phaser dev
```

Open Vite URL **twice** (two tabs or windows):

1. Window A → **Host GP2** (API base empty) → joins as `marquise`
2. Window B → **Join GP2** → joins as `eyrie`
3. Either window confirms **Start** when prompted
4. Play; waiting window cannot submit
5. **Continue** after refresh uses **sessionStorage** (per tab — seats stay separate)
6. **End game** (drawer, two-click) → clears slot; peers return to menu
7. **QA: Continue loaded game** — REST poll of slot dumps (not normal play)

Same flow on two machines: B sets API base to `http://<A-ip>:3000` (or open A’s Vite LAN URL). Vite `server.host: true` + proxies `/game`, `/map`, `/ws`.

Identity: `sessionStorage` key `root.phaser.playerIdentity` (`playerId` + `apiBaseUrl`).

## Architecture

| Layer | Role |
|---|---|
| `GameSession` | host/join/start/continue + REST commands + WS apply |
| `gameSocket` | connect / reconnect / parse push |
| `playerIdentity` | persist `playerId` + `apiBaseUrl` (sessionStorage) |
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

Phaser wraps it in `createPhaserApi()` (`src/api/client.ts`). Empty `baseUrl` uses Vite proxy; Host/Join menu can set absolute `http://HOST:3000`.

Regenerate after API shape changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/phaser dev` | Vite + API/WS proxy |
| `pnpm --filter @root/phaser test` | Vitest (factories + mocked fetch) |
| `pnpm --filter @root/phaser typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/phaser build` | production → `dist/` |
| `pnpm gen:api-client` | regenerate `@root/web-client` |

## Out of scope

Alliance, Vagabond, multi-room, auth tokens, WAN/NAT relay, action-over-WS, production asset licensing.
