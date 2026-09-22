import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { app } from '#openapi.js'
import { attachGameWebSocket } from '#routes/ws.js'
import { mountPhaserStatic, phaserPublicDirectory } from '#static.js'

attachGameWebSocket(app)
mountPhaserStatic(app)

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
    if (existsSync(phaserPublicDirectory)) {
      console.log(`Phaser game: http://localhost:${info.port}/`)
    }
  },
)
