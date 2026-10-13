import { randomUUID } from 'node:crypto'
import type { Action, Game, PlayerState } from '@root/lib'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'
import {
  aiPlayerActivityFeed,
  type AiPlayerActivity,
} from '#aiPlayer/AiPlayerActivityFeed.js'
import { aiPlayerDriver } from '#aiPlayer/aiPlayerRuntime.js'
import {
  listOfferedModels,
  resolveDefaultModel,
} from '#aiPlayer/modelIdentifier.js'
import { logGameEvent } from '#debug/logGame.js'
import { HttpError, noGame } from '#middleware/errors.js'
import { publishGameChange } from '#routes/game.js'
import {
  AddAiPlayerBodySchema,
  AiModelsResponseSchema,
  AiPlayerActivitySchema,
  AiPlayerSeatParamsSchema,
  AiPlayersResponseSchema,
  SetAiPlayerModelBodySchema,
} from '#schemas/aiPlayer.js'
import { errorResponses } from '#schemas/common.js'
import {
  DEFAULT_AI_PLAYER_STATUS,
  store,
  type AiPlayerSeat,
} from '#store/GameStore.js'
import {
  ONLINE_HOST_SEAT,
  PLAYER_ID_HEADER,
  seatForPlayerId,
} from '#view/actionSeatGuard.js'
import { listAiPlayerViews } from '#view/aiPlayerView.js'

/** Join id of an AI seat: random, so no client can guess it and play the seat. */
const AI_PLAYER_ID_PREFIX = 'ai-'
const LOBBY_STATUS = 'waiting'
export const AI_PLAYER_ACTIVITY_EVENT = 'activity'
const KEEP_ALIVE_COMMENT = ': keep-alive\n\n'
const KEEP_ALIVE_INTERVAL_MILLISECONDS = 15000

export const aiPlayerRoutes = new OpenAPIHono()

function requireGame(): Game {
  if (store.game === null) noGame()
  return store.game
}

/** AI seats are set up before the game starts, like every other seat. */
function requireLobby(game: Game): void {
  if (game.state.status !== LOBBY_STATUS) {
    throw new HttpError(409, 'GAME_STARTED', 'AI players are set in the lobby')
  }
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
    throw new HttpError(403, 'NOT_HOST', 'only the host may set AI players')
  }
}

/** The requested model, or the default: always one the server offers. */
function requireOfferedModel(requestedModel: string | undefined): string {
  const model = requestedModel ?? resolveDefaultModel(process.env)
  if (model === null) {
    throw new HttpError(400, 'NO_AI_MODEL', 'no AI model is configured')
  }
  if (!listOfferedModels(process.env).includes(model)) {
    throw new HttpError(400, 'BAD_MODEL', model)
  }
  return model
}

const listAiModelsRoute = createRoute({
  method: 'get',
  path: '/ai-models',
  tags: ['ai-player'],
  summary: 'List models an AI player may use',
  responses: {
    200: {
      description: 'Offered models',
      content: { 'application/json': { schema: AiModelsResponseSchema } },
    },
  },
})

aiPlayerRoutes.openapi(listAiModelsRoute, (context) => {
  return context.json(
    {
      models: listOfferedModels(process.env),
      defaultModel: resolveDefaultModel(process.env),
    },
    200,
  )
})

const addAiPlayerRoute = createRoute({
  method: 'post',
  path: '/ai-players',
  tags: ['ai-player'],
  summary: 'Seat an AI player in the lobby',
  request: {
    body: {
      content: { 'application/json': { schema: AddAiPlayerBodySchema } },
      required: false,
    },
  },
  responses: {
    201: {
      description: 'AI player seated',
      content: { 'application/json': { schema: AiPlayersResponseSchema } },
    },
    ...errorResponses,
  },
})

aiPlayerRoutes.openapi(addAiPlayerRoute, async (context) => {
  const game = requireGame()
  requireLobby(game)
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER))
  const body = context.req.valid('json') ?? {}
  const model = requireOfferedModel(body.model)
  const joinAction: Action = {
    type: 'join',
    playerId: `${AI_PLAYER_ID_PREFIX}${randomUUID()}`,
    ...(body.faction === undefined ? {} : { faction: body.faction }),
  }
  const result = game.apply(joinAction)
  store.aiPlayers = [
    ...store.aiPlayers,
    {
      playerId: joinAction.playerId,
      model,
      status: DEFAULT_AI_PLAYER_STATUS,
    },
  ]
  logGameEvent('JOIN', result.state, joinAction)
  publishGameChange()
  return context.json({ aiPlayers: listAiPlayerViews() }, 201)
})

const setAiPlayerModelRoute = createRoute({
  method: 'patch',
  path: '/ai-players/{seat}',
  tags: ['ai-player'],
  summary: 'Change the model of an AI player (lobby only)',
  request: {
    params: AiPlayerSeatParamsSchema,
    body: {
      content: { 'application/json': { schema: SetAiPlayerModelBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Model changed',
      content: { 'application/json': { schema: AiPlayersResponseSchema } },
    },
    ...errorResponses,
  },
})

aiPlayerRoutes.openapi(setAiPlayerModelRoute, async (context) => {
  const game = requireGame()
  requireLobby(game)
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER))
  const model = requireOfferedModel(context.req.valid('json').model)
  const playerId = requireAiPlayerId(game, context.req.valid('param').seat)
  store.aiPlayers = store.aiPlayers.map(
    (aiSeat: AiPlayerSeat): AiPlayerSeat =>
      aiSeat.playerId === playerId ? { ...aiSeat, model } : aiSeat,
  )
  publishGameChange()
  return context.json({ aiPlayers: listAiPlayerViews() }, 200)
})

const restartAiPlayerRoute = createRoute({
  method: 'post',
  path: '/ai-players/{seat}/restart',
  tags: ['ai-player'],
  summary: 'Restart the session of an AI player',
  description:
    'Drops what the AI player was doing (thinking or stuck) and starts a fresh session from the current game state. Actions it already took stay. Operator tool: no seat check.',
  request: { params: AiPlayerSeatParamsSchema },
  responses: {
    200: {
      description: 'Session restarted',
      content: { 'application/json': { schema: AiPlayersResponseSchema } },
    },
    ...errorResponses,
  },
})

aiPlayerRoutes.openapi(restartAiPlayerRoute, (context) => {
  const seat = context.req.valid('param').seat
  requireAiPlayerId(requireGame(), seat)
  aiPlayerDriver.restart(seat)
  return context.json({ aiPlayers: listAiPlayerViews() }, 200)
})

const streamAiPlayerActivityRoute = createRoute({
  method: 'get',
  path: '/ai-players/stream',
  tags: ['ai-player'],
  summary: 'Stream what the AI players do',
  description:
    'Server-sent events, one per activity (message to the model, its reply, tool call, tool result, failure): the latest ones first, then live. Shows what an AI player sees and thinks, its hand included. Operator tool: no seat check.',
  responses: {
    200: {
      description: 'Event stream; the data of each event is one AiPlayerActivity',
      content: { 'text/event-stream': { schema: AiPlayerActivitySchema } },
    },
  },
})

aiPlayerRoutes.openapi(streamAiPlayerActivityRoute, (context) => {
  return streamSSE(context, async (stream: SSEStreamingApi): Promise<void> => {
    const send = (activity: AiPlayerActivity): void => {
      void stream.writeSSE({
        id: String(activity.sequence),
        event: AI_PLAYER_ACTIVITY_EVENT,
        data: JSON.stringify(activity),
      })
    }
    aiPlayerActivityFeed.recentActivities().forEach(send)
    const unsubscribe = aiPlayerActivityFeed.subscribe(send)
    // Quiet streams get cut by idle timeouts: a comment line keeps them open.
    const keepAlive = setInterval((): void => {
      void stream.write(KEEP_ALIVE_COMMENT)
    }, KEEP_ALIVE_INTERVAL_MILLISECONDS)
    await new Promise<void>((resolve: () => void): void => {
      stream.onAbort(resolve)
    })
    clearInterval(keepAlive)
    unsubscribe()
  })
})

/** Join id of the AI player at `seat`; 404 when a human (or nobody) sits there. */
function requireAiPlayerId(game: Game, seat: number): string {
  const player = game.state.players.find(
    (candidate: PlayerState): boolean => candidate.seat === seat,
  )
  const aiSeat = store.aiPlayers.find(
    (candidate: AiPlayerSeat): boolean =>
      candidate.playerId === player?.playerId,
  )
  if (aiSeat === undefined) {
    throw new HttpError(404, 'NO_AI_PLAYER', { seat })
  }
  return aiSeat.playerId
}
