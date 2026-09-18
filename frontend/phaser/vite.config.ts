import { defineConfig } from 'vitest/config'

const webApiTarget = process.env.ROOT_API ?? 'http://localhost:3000'

/** Vite + Vitest config for @root/phaser — proxies game/map API to @root/web. */
export default defineConfig({
  server: {
    proxy: {
      '/game': webApiTarget,
      '/map': webApiTarget,
      '/doc': webApiTarget,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
