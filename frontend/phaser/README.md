# `@root/phaser`

Vite + Phaser 3 client. Bare boot for now — no API / `@root/lib` wire yet.

## Start

From repo root:

```bash
pnpm install
pnpm dev:phaser
```

Open the URL Vite prints (default `http://localhost:5173`).

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @root/phaser dev` | Vite dev server |
| `pnpm --filter @root/phaser build` | production build → `dist/` |
| `pnpm --filter @root/phaser typecheck` | `tsc --noEmit` |
| `pnpm --filter @root/phaser preview` | preview production build |
