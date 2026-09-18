import { defineConfig } from 'vite'

const webApiTarget = process.env.ROOT_API ?? 'http://localhost:3000'

/** Vite config for @root/phaser — proxies game/map API to @root/web. */
export default defineConfig({
  server: {
    proxy: {
      '/game': webApiTarget,
      '/map': webApiTarget,
      '/doc': webApiTarget,
    },
  },
})
