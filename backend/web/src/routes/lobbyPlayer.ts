import type { Action, Game, PlayerState } from '@root/lib'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { logGameEvent } from '#debug/logGame.js'
import { HttpError, noGame } from '#middleware/errors.js'
import { publishGameChange } from '#routes/game.js'
import { errorResponses } from '#schemas/common.js'
import { LobbySeatParamsSchema } from '#schemas/game.js'
import { store, type AiPlayerSeat } from '#store/GameStore.js'
import {
  ONLINE_HOST_SEAT,
  PLAYER_ID_HEADER,
  seatForPlayerId,
} from '#view/actionSeatGuard.js'
import { isSeat } from '#typeGuards.js'

export const lobbyPlayerRoutes = new OpenAPIHono()

function requireGame(): Game {
  if (store.game === null) noGame()
  return store.game
}

/** Online mode: the host decides who sits at the table. Hotseat: anyone. */
function requireHostInOnlineGame(game: Game, playerId: string | undefined): void {
  if (store.mode !== 'online') {
    return
  }
  const isHost =
    playerId !== undefined &&
    seatForPlayerId(game.state, playerId) === ONLINE_HOST_SEAT
  if (!isHost) {
    throw new HttpError(403, 'NOT_HOST', 'only the host may expel a player')
  }
}

const expelPlayerRoute = createRoute({
  method: 'delete',
  path: '/players/{seat}',
  tags: ['game'],
  summary: 'Expel a player from the open lobby',
  description:
    'Frees the seat of a human or AI player; later seats move down one. Host only in online mode. The host seat (0) cannot be expelled.',
  request: { params: LobbySeatParamsSchema },
  responses: {
    204: { description: 'Player expelled' },
    ...errorResponses,
  },
})

lobbyPlayerRoutes.openapi(expelPlayerRoute, (context) => {
  const game = requireGame()
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER))
  const seat: number = context.req.valid('param').seat
  if (!isSeat(seat)) {
    throw new HttpError(400, 'BAD_SEAT', { seat })
  }
  const expelled = game.state.players.find(
    (player: PlayerState): boolean => player.seat === seat,
  )
  const expelAction: Action = { type: 'expel', seat }
  const result = game.apply(expelAction)
  store.aiPlayers = store.aiPlayers.filter(
    (aiSeat: AiPlayerSeat): boolean => aiSeat.playerId !== expelled?.playerId,
  )
  logGameEvent('EXPEL', result.state, expelAction)
  publishGameChange()
  return context.body(null, 204)
})
