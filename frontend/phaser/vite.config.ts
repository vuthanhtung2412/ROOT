import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ROOT_DEV_API_BASE_URL } from '@root/web-client'
import { defineConfig } from 'vitest/config'

const webApiTarget = process.env.ROOT_DEV_API ?? DEFAULT_ROOT_DEV_API_BASE_URL
const packageRoot = path.dirname(fileURLToPath(import.meta.url))

/** Vite + Vitest config for @root/phaser — proxies game/map/ws API to @root/web. */
export default defineConfig({
  /** Expose mise `ROOT_*` to `import.meta.env` (native default API base). */
  envPrefix: ['VITE_', 'ROOT_'],
  resolve: {
    alias: [
      {
        find: /^#(.+)$/,
        replacement: path.join(packageRoot, 'src', '$1'),
      },
    ],
  },
  server: {
    host: true,
    proxy: {
      '/game': webApiTarget,
      '/map': webApiTarget,
      '/doc': webApiTarget,
      '/ws': {
        target: webApiTarget,
        ws: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
