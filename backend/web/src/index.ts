import { existsSync } from 'node:fs'
import path from 'node:path'
import { enableGamePersistence } from '#store/gamePersistence.js'
import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { app } from '#openapi.js'
import { attachGameWebSocket } from '#routes/ws.js'
import { mountReactStatic, reactPublicDirectory } from '#static.js'

const GAME_STORE_FILE_ENV_KEY = 'ROOT_GAME_STORE_FILE'
const GAME_STORE_DISABLED_VALUE = 'off'
const DEFAULT_GAME_STORE_FILE = path.resolve(
  import.meta.dirname,
  '../.data/game-slot.json',
)

// Survive restarts: reload the saved game slot, keep it saved on every change.
// ROOT_GAME_STORE_FILE=<path> moves the file; =off keeps the slot in memory only.
const gameStoreFile: string =
  process.env[GAME_STORE_FILE_ENV_KEY] ?? DEFAULT_GAME_STORE_FILE
if (gameStoreFile !== GAME_STORE_DISABLED_VALUE) {
  enableGamePersistence(gameStoreFile)
}

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
