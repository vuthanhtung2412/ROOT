import { defineConfig } from 'vitest/config'

const webApiTarget = process.env.ROOT_API ?? 'http://localhost:3000'

/** Vite + Vitest config for @root/phaser — proxies game/map/ws API to @root/web. */
export default defineConfig({
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
