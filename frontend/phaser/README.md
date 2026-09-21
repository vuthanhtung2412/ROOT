# `@root/phaser`

Vite + Phaser 3 **GP2 remote client**: Marquise vs Eyrie (Builder) on two machines.

Phaser **never mutates** engine state. Commands go REST (`POST /game/...`). UI state comes from **WebSocket** pushes (`/ws?playerId=…`) with **opponent hands redacted**. CLI/REST keep full state for QA.

## Play GP2 (LAN, two machines)

```bash
# Machine A (host) — API
pnpm --filter @root/web dev

# Machine A — Phaser
pnpm --filter @root/phaser dev
```

```bash
# Machine B — Phaser (same repo)
pnpm --filter @root/phaser dev
```

1. **Host (A):** menu **Host GP2** (API base empty if Vite proxies to local `:3000`). Joins as `marquise`, waits.
2. **Join (B):** set API base to `http://<A-LAN-IP>:3000` (or leave empty if B’s Vite `ROOT_API` points at A). **Join GP2** as `eyrie`.
3. Either side confirms **Start** when prompted (2 players in lobby).
4. Turns alternate; waiting client sees “Waiting for other player…” and cannot submit.
5. **Continue** after refresh restores seat from `localStorage` (`playerId` + `apiBaseUrl`).
6. **End game** (drawer, two-click confirm) → `DELETE /game`, clears identity, both return to menu via empty WS.
7. **QA: Continue loaded game** — REST poll of whatever is in the slot (playtest dumps; not for normal play).

Vite listens on LAN (`server.host: true`) and proxies `/game`, `/map`, `/ws`.

## Architecture

| Layer | Role |
|---|---|
| `GameSession` | host/join/start/continue + REST commands + WS apply |
| `gameSocket` | connect / reconnect / parse push |
| `playerIdentity` | persist `playerId` + `apiBaseUrl` |
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
