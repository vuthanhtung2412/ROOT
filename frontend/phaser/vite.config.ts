import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const webApiTarget = process.env.ROOT_API ?? 'http://localhost:3000'
const packageRoot = path.dirname(fileURLToPath(import.meta.url))

/** Vite + Vitest config for @root/phaser — proxies game/map/ws API to @root/web. */
export default defineConfig({
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
