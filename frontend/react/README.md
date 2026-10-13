# `@root/react`

Vite + React **GP2 remote client**: Marquise vs Eyrie (Builder). Two browser sessions talk to one `@root/web`.

UI **never mutates** engine state. Commands go REST (`POST /game/...`). UI state comes from **WebSocket** pushes (`/ws?playerId=…`) with **opponent hands redacted**. CLI/REST keep full state for QA.

> **Note:** Package was formerly `@root/phaser`. Scripts `dev:phaser` / `build:phaser` / `serve:phaser` still forward with a deprecation warning.

## Play GP2 (one machine, two windows)

```bash
pnpm dev   # process-compose: web + React (`/` filter, F3 log search)
```

Open Vite URL **twice** (two tabs or windows):

1. Window A → **Play** → Marquise, waits (“Waiting for second player…”)
2. Window B → **Play** → Eyrie, auto-starts; both enter the board
3. Play; waiting window cannot submit
4. **Play** after refresh resumes stored seat when still in the API slot (`sessionStorage`, per tab)
5. **End game** (drawer, two-click) → clears slot; peers return to menu
6. **QA: Continue loaded game** — REST full-slot refresh + WS wake (live after CLI/UI acts); does **not** touch stored Play identity. Dev autoload: open `/?qaSnapshot=tmp/qa/snapshots/x.json` (or set `ROOT_QA_SNAPSHOT_PATH`) and the button first loads that repository file into the slot (replaces the game)

Same on two machines: B sets API base to `http://<A-ip>:3000`.

Identity: `sessionStorage` key `root.react.playerIdentity` (`playerId` + `apiBaseUrl`). Legacy `root.phaser.playerIdentity` is migrated on load.

## Serve from web backend (one process)

Build React UI, copy into `@root/web` `public/`, start API + static + WS on port 3000:

```bash
pnpm serve:game
```

Open `http://localhost:3000/` (or `http://<lan-ip>:3000/` from another device). Empty API base = same origin. Service JSON lives at `/health`.

Runs in a process-compose TUI (`process-compose.serve.yaml`): `web` + `ai-stream` (what the AI players do). Without the TUI: `pnpm --filter @root/web serve:react`.

## Remote play (Tailscale Funnel)

```bash
pnpm remote   # Funnel URL — leave API base empty
# FUNNEL_HTTPS_PORT=10000 pnpm remote   # if 8443 busy (443/8443/10000 only)
pnpm remote:cloudflare   # Cloudflare quick tunnel — random URL each run, no account
```

Both run in a process-compose TUI (`process-compose.remote.yaml`, `process-compose.remote-cloudflare.yaml`): select the `remote` process to read the GAME URL; `ai-stream` shows what the AI players do. Without the TUI: `bash scripts/remote-play.sh`.

Needs Tailscale.app + Funnel enabled. Ctrl+C stops.

## Build iOS (Capacitor)

Requires macOS, [Xcode](https://developer.apple.com/xcode/), and a physical iPhone or Simulator. App is a WebView shell; game server still `@root/web`.

```bash
# Terminal A — host API (or use serve:game / remote)
pnpm --filter @root/web dev

# Terminal B — build + sync + open Xcode
pnpm build:ios
```

Or open the project yourself: `frontend/react/ios/App/App.xcodeproj`.

### Install on device / Simulator

1. Run `pnpm build:ios` (opens Xcode).
2. In Xcode, select your Apple ID team under **Signing & Capabilities**.
3. **Enable Developer Mode on the iPhone** (required on iOS 16+ for sideloaded apps): **Settings → Privacy & Security → Developer Mode → On**, then restart when prompted.
4. Plug in the device (or pick a Simulator), select it as the run destination, and press **▶ Run**.
5. On first install, trust the developer certificate: **Settings → General → VPN & Device Management**.

`pnpm build:ios` always reads `ROOT_PROD_API` from repo-root `.env` and bakes it as the native API default (even if shell env unset). Mise auto-loads `.env` via `.mise.toml` `[env] _.file`. Run `pnpm remote` on host so Funnel is up, then Play in Simulator / device. Override still possible via stored identity. Cleartext LAN HTTP still allowed via ATS + Capacitor `server.cleartext` if you point at `http://<lan-ip>:3000`.

## Architecture

| Layer | Role |
|---|---|
| `GameSession` | play (resume-or-join) / host/join/start + REST commands + WS apply |
| `gameSocket` | connect / reconnect / parse push |
| `playerIdentity` | persist `playerId` + `apiBaseUrl` (sessionStorage) |
| `ActionComposer` + faction/event hooks | stage choices → `Action` |
| React shell | boot → menu → game screen + HUD |
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

UI wraps it in `createFrontendApi()` (`src/api/client.ts`). Empty `baseUrl` uses Vite proxy / same-origin when served from `@root/web`; Host/Join menu can set absolute `http://HOST:3000`.

Regenerate after API shape changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/react dev` | Vite + API/WS proxy |
| `pnpm dev` | process-compose: web + React + AI player stream |
| `pnpm serve:game` | process-compose: build React → serve via `@root/web` + AI player stream |
| `pnpm remote` | process-compose: build + web serve + Tailscale Funnel → stable public URL + AI player stream |
| `pnpm remote:cloudflare` | process-compose: build + web serve + Cloudflare quick tunnel → random public URL + AI player stream |
| `pnpm build:ios` | build React → Capacitor sync → open Xcode |
| `pnpm --filter @root/react test` | Vitest (factories + mocked fetch) |
| `pnpm --filter @root/react typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/react build` | production → `dist/` |
| `pnpm gen:api-client` | regenerate `@root/web-client` |

## Out of scope

Alliance, Vagabond, multi-room, auth tokens, WAN/NAT relay, action-over-WS, production asset licensing, Android, App Store signing CI.
