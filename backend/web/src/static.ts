import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Context } from 'hono'
import type { OpenAPIHono } from '@hono/zod-openapi'

const packageRootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Vite Phaser build output copied here by `serve-phaser` script. */
export const phaserPublicDirectory: string = join(
  packageRootDirectory,
  'public',
)

const VITE_HASHED_ASSET_PATTERN =
  /(?:^|\/)assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$/

/**
 * Cache policy for served Phaser files.
 * Hashed Vite chunks are immutable; HTML must revalidate; other assets short TTL.
 */
export function cacheControlForStaticPath(filePath: string): string {
  const normalizedPath = filePath.replaceAll('\\', '/')
  if (
    normalizedPath.endsWith('/index.html') ||
    normalizedPath === 'index.html'
  ) {
    return 'no-cache'
  }
  if (VITE_HASHED_ASSET_PATTERN.test(normalizedPath)) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=86400'
}

function applyStaticCacheHeaders(filePath: string, context: Context): void {
  context.header('Cache-Control', cacheControlForStaticPath(filePath))
}

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
      onFound: applyStaticCacheHeaders,
    }),
  )
}
