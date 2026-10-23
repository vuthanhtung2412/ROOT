import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  clearStoredGame,
  enableGamePersistence,
} from '#store/gamePersistence.js'
import { resetGameStore, store } from '#store/GameStore.js'
import { runtimeOf } from '#store/roomRuntime.js'
import {
  DEFAULT_INACTIVE_GAME_TIMEOUT_SECONDS,
  startInactiveGameCleanup,
} from '#store/inactiveGameCleanup.js'
import { publishGameChange } from '#routes/game.js'
import { aiPlayerActivityFeed } from '#aiPlayer/AiPlayerActivityFeed.js'
import { logAiPlayerActivity } from '#debug/logAiPlayerActivity.js'
import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { app } from '#openapi.js'
import { attachGameWebSocket } from '#routes/ws.js'
import { mountReactStatic, reactPublicDirectory } from '#static.js'

const GAME_STORE_FILE_ENV_KEY = 'ROOT_GAME_STORE_FILE'
const GAME_STORE_DISABLED_VALUE = 'off'
const INACTIVE_GAME_TIMEOUT_ENV_KEY = 'ROOT_INACTIVE_GAME_TIMEOUT_SECONDS'
const STOP_SIGNAL = 'SIGINT'
/** Shell convention: 128 + signal number (SIGINT = 2). */
const STOP_SIGNAL_EXIT_CODE = 130
const DEFAULT_GAME_STORE_FILE = path.resolve(
  import.meta.dirname,
  '../.data/game-slot.json',
)

// The feed keeps serving GET /game/ai-players/stream; the file gets every activity too.
aiPlayerActivityFeed.subscribe(logAiPlayerActivity)

// Survive restarts: reload the saved game slot, keep it saved on every change.
// ROOT_GAME_STORE_FILE=<path> moves the file; =off keeps the slot in memory only.
const gameStoreFile: string =
  process.env[GAME_STORE_FILE_ENV_KEY] ?? DEFAULT_GAME_STORE_FILE
if (gameStoreFile !== GAME_STORE_DISABLED_VALUE) {
  enableGamePersistence(gameStoreFile)
  // A restored game may be waiting on an AI seat: let it play on.
  runtimeOf(store).aiPlayerDriver.handleGameChanged()
}

// Always on: drop a game nobody has touched for a while, so the slot frees up.
// ROOT_INACTIVE_GAME_TIMEOUT_SECONDS=<seconds> changes the wait (default 300).
// `||`, not `??`: an empty value (blank line copied from env.template) means default.
const inactiveGameTimeoutSetting: string =
  process.env[INACTIVE_GAME_TIMEOUT_ENV_KEY] || String(DEFAULT_INACTIVE_GAME_TIMEOUT_SECONDS)
const inactiveGameTimeoutSeconds: number = Number(inactiveGameTimeoutSetting)
if (!Number.isFinite(inactiveGameTimeoutSeconds) || inactiveGameTimeoutSeconds <= 0) {
  throw new Error(
    `${INACTIVE_GAME_TIMEOUT_ENV_KEY} must be a positive number of seconds, ` +
      `got "${inactiveGameTimeoutSetting}"`,
  )
}
startInactiveGameCleanup({
  inactivityTimeoutSeconds: inactiveGameTimeoutSeconds,
  clearGame: (): void => {
    console.log(`Clearing game after ${inactiveGameTimeoutSeconds} seconds without activity`)
    resetGameStore()
    publishGameChange(store)
  },
})

// Stopping the server by hand (Ctrl+C) ends the game: drop the saved slot.
// A crash or a dev-watch restart (SIGTERM) keeps it, so those still resume.
process.once(STOP_SIGNAL, () => {
  clearStoredGame()
  process.exit(STOP_SIGNAL_EXIT_CODE)
})

attachGameWebSocket(app)
mountReactStatic(app)

const webSocketServer = new WebSocketServer({ noServer: true })

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
    websocket: { server: webSocketServer },
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
    console.log(`Health: http://localhost:${info.port}/health`)
    console.log(`OpenAPI doc: http://localhost:${info.port}/doc`)
    console.log(`WebSocket: ws://localhost:${info.port}/ws?playerId=…`)
    if (existsSync(reactPublicDirectory)) {
      console.log(`React game: http://localhost:${info.port}/`)
    }
  },
)
