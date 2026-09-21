import { upgradeWebSocket } from '@hono/node-server'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { WSContext } from 'hono/ws'
import {
  gameHub,
  snapshotGamePush,
  type GameHubClient,
} from '../ws/GameHub.js'

const OPEN_READY_STATE = 1

function toHubClient(playerId: string, ws: WSContext): GameHubClient {
  return {
    playerId,
    send: (data: string) => {
      ws.send(data)
    },
    isOpen: () => ws.readyState === OPEN_READY_STATE,
  }
}

/** Register `GET /ws?playerId=` upgrade on the app. */
export function attachGameWebSocket(app: OpenAPIHono): void {
  app.get(
    '/ws',
    upgradeWebSocket((context) => {
      const playerId = context.req.query('playerId')
      if (playerId === undefined || playerId.trim() === '') {
        return {
          onOpen(_event, ws) {
            ws.close(1008, 'playerId required')
          },
        }
      }

      let hubClient: GameHubClient | null = null

      return {
        onOpen(_event, ws) {
          hubClient = toHubClient(playerId, ws)
          gameHub.addClient(hubClient)
          ws.send(JSON.stringify(snapshotGamePush()))
        },
        onClose() {
          if (hubClient !== null) {
            gameHub.removeClient(hubClient)
            hubClient = null
          }
        },
      }
    }),
  )
}
