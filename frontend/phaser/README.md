# `@root/phaser`

Vite + Phaser 3 client. Bare boot for now — no API wire yet.

## Start

From repo root:

```bash
pnpm install
pnpm dev:phaser
```

Open the URL Vite prints (default `http://localhost:5173`).

## API client

Shared typed client: `@root/web-client` (`backend/web_client`).

```ts
import { createRootWebClient } from '@root/web-client'
```

Regenerate after API changes:

```bash
pnpm --filter @root/web gen:openapi
pnpm gen:api-client
```

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/phaser dev` | Vite dev server |
| `pnpm --filter @root/phaser build` | production build → `dist/` |
| `pnpm --filter @root/phaser typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/phaser preview` | preview production build |
| `pnpm gen:api-client` | regenerate `@root/web-client` OpenAPI types |
