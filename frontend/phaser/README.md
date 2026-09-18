# `@root/phaser`

Vite + Phaser 3 client. Bare boot for now — no API / `@root/lib` wire yet.

## Start

From repo root:

```bash
pnpm install
pnpm dev:phaser
```

Open the URL Vite prints (default `http://localhost:5173`).

## API client codegen

After `@root/web` exposes OpenAPI (`GET /doc` / `pnpm --filter @root/web gen:openapi`):

```bash
pnpm --filter @root/web gen:openapi   # writes backend/web/openapi.json
pnpm gen:api-client                   # writes frontend/phaser/src/api/generated/schema.d.ts
```

Or with a live server: `ROOT_API=http://localhost:3000 pnpm gen:api-client`.

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/phaser dev` | Vite dev server |
| `pnpm --filter @root/phaser build` | production build → `dist/` |
| `pnpm --filter @root/phaser typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/phaser preview` | preview production build |
| `pnpm gen:api-client` | generate OpenAPI TypeScript types for Phaser |
