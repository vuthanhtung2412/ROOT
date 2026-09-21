# `@root/phaser`

Vite + Phaser 3 **GP2 remote client**: Marquise vs Eyrie (Builder). Two browser sessions talk to one `@root/web`.

Phaser **never mutates** engine state. Commands go REST (`POST /game/...`). UI state comes from **WebSocket** pushes (`/ws?playerId=…`) with **opponent hands redacted**. CLI/REST keep full state for QA.

## Play GP2 (one machine, two windows)

```bash
pnpm --filter @root/web dev
pnpm --filter @root/phaser dev
```

Open Vite URL **twice** (two tabs or windows):

1. Window A → **Play** → Marquise, waits (“Waiting for second player…”)
2. Window B → **Play** → Eyrie, auto-starts; both enter the board
3. Play; waiting window cannot submit
4. **Play** after refresh resumes stored seat when still in the API slot (`sessionStorage`, per tab)
5. **End game** (drawer, two-click) → clears slot; peers return to menu
6. **QA: Continue loaded game** — REST full-slot refresh + WS wake (live after CLI/UI acts); does **not** touch stored Play identity

Same on two machines: B sets API base to `http://<A-ip>:3000`.

Identity: `sessionStorage` key `root.phaser.playerIdentity` (`playerId` + `apiBaseUrl`).

## Serve from web backend (one process)

Build Phaser, copy into `@root/web` `public/`, start API + static + WS on port 3000:

```bash
pnpm serve:game
```

Open `http://localhost:3000/` (or `http://<lan-ip>:3000/` from another device). Empty API base = same origin. Service JSON lives at `/health`.

## Remote play (Cloudflare tunnel)

```bash
make remote   # build Phaser → @root/web → Cloudflare → print URL
```

Leave API base **empty**. Ctrl+C stops everything.
## Build iOS (Capacitor)

Requires macOS + Xcode. App is a WebView shell; game server still `@root/web`.

```bash
# Terminal A — host API (or use serve:game)
pnpm --filter @root/web dev

# Terminal B — build + sync + open Xcode
pnpm build:ios
```

In Simulator / device menu, set API base to `http://<host-lan-ip>:3000`, then Join. Cleartext LAN HTTP allowed via ATS + Capacitor `server.cleartext`.

## Architecture

| Layer | Role |
|---|---|
| `GameSession` | play (resume-or-join) / host/join/start + REST commands + WS apply |
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

Phaser wraps it in `createPhaserApi()` (`src/api/client.ts`). Empty `baseUrl` uses Vite proxy / same-origin when served from `@root/web`; Host/Join menu can set absolute `http://HOST:3000`.

Regenerate after API shape changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/phaser dev` | Vite + API/WS proxy |
| `pnpm serve:game` | build Phaser → serve via `@root/web` |
| `pnpm build:ios` | build Phaser → Capacitor sync → open Xcode |
| `pnpm --filter @root/phaser test` | Vitest (factories + mocked fetch) |
| `pnpm --filter @root/phaser typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/phaser build` | production → `dist/` |
| `pnpm gen:api-client` | regenerate `@root/web-client` |
| `make remote` | build + web serve + Cloudflare → public URL |

## Out of scope

Alliance, Vagabond, multi-room, auth tokens, WAN/NAT relay, action-over-WS, production asset licensing, Android, App Store signing CI.
