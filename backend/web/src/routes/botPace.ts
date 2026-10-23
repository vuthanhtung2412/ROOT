import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { HttpError, noGame } from '#middleware/errors.js'
import { resolveRoom } from '#middleware/roomResolver.js'
import { publishGameChange } from '#routes/roomAccess.js'
import { errorResponses } from '#schemas/common.js'
import { SetBotPaceBodySchema } from '#schemas/game.js'
import type { GameRoom } from '#store/GameStore.js'
import {
  ONLINE_HOST_SEAT,
  PLAYER_ID_HEADER,
  seatForPlayerId,
} from '#view/actionSeatGuard.js'

export const botPaceRoutes = new OpenAPIHono()

const setBotPaceRoute = createRoute({
  method: 'put',
  path: '/bot-pace',
  tags: ['game'],
  summary: 'Set how long the server waits after each bot action',
  description:
    'Online games play bots one action at a time; this is the pause between two. Any time, lobby or game. Host only in online mode.',
  request: {
    body: {
      content: { 'application/json': { schema: SetBotPaceBodySchema } },
      required: true,
    },
  },
  responses: {
    204: { description: 'Pace set' },
    ...errorResponses,
  },
})

botPaceRoutes.openapi(setBotPaceRoute, (context) => {
  const playerId = context.req.header(PLAYER_ID_HEADER)
  const room: GameRoom = resolveRoom(playerId)
  const game = room.game
  if (game === null) noGame()
  const isHost =
    playerId !== undefined && seatForPlayerId(game.state, playerId) === ONLINE_HOST_SEAT
  if (room.mode === 'online' && !isHost) {
    throw new HttpError(403, 'NOT_HOST', 'only the host may set the bot pace')
  }
  room.botStepDelaySeconds = context.req.valid('json').botStepDelaySeconds
  publishGameChange(room)
  return context.body(null, 204)
})
