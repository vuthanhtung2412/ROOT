import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveStatic } from '@hono/node-server/serve-static'
import type { OpenAPIHono } from '@hono/zod-openapi'

const packageRootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Vite Phaser build output copied here by `serve-phaser` script. */
export const phaserPublicDirectory: string = join(
  packageRootDirectory,
  'public',
)

/**
 * Serve built Phaser assets from `public/` when present.
 * Mount after API routes so `/game`, `/map`, `/doc`, `/health`, `/ws` win.
 */
export function mountPhaserStatic(app: OpenAPIHono): void {
  if (!existsSync(phaserPublicDirectory)) {
    return
  }

  app.use(
    '/*',
    serveStatic({
      root: phaserPublicDirectory,
    }),
  )
}
