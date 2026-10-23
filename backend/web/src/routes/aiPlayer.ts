import { randomUUID } from 'node:crypto'
import { isBotFaction, type Action, type Game, type PlayerState } from '@root/lib'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'
import {
  aiPlayerActivityFeed,
  type AiPlayerActivity,
} from '#aiPlayer/AiPlayerActivityFeed.js'
import {
  listOfferedModels,
  resolveDefaultModel,
} from '#aiPlayer/modelIdentifier.js'
import { logGameEvent } from '#debug/logGame.js'
import { HttpError } from '#middleware/errors.js'
import {
  resolveGameCaller,
  resolveRoom,
  type GameCaller,
} from '#middleware/roomResolver.js'
import { publishGameChange, requireGame } from '#routes/roomAccess.js'
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
  type AiPlayerSeat,
  type GameRoom,
} from '#store/GameStore.js'
import { runtimeOf } from '#store/roomRuntime.js'
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

/** AI seats are set up before the game starts, like every other seat. */
function requireLobby(game: Game): void {
  if (game.state.status !== LOBBY_STATUS) {
    throw new HttpError(409, 'GAME_STARTED', 'AI players are set in the lobby')
  }
}

/** Online mode: the host decides who sits at the table. Hotseat: anyone. */
function requireHostInOnlineGame(game: Game, caller: GameCaller): void {
  if (caller.room.mode !== 'online') {
    return
  }
  const isHost =
    caller.playerId !== undefined &&
    seatForPlayerId(game.state, caller.playerId) === ONLINE_HOST_SEAT
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
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  const room: GameRoom = caller.room
  const game = requireGame(room)
  requireLobby(game)
  requireHostInOnlineGame(game, caller)
  if (game.state.cooperative === true) {
    // Rule: Rootbotics 3.5.1 — co-op is humans against the bots: no LLM seat.
    throw new HttpError(400, 'COOPERATIVE_GAME', 'co-op games have no AI players')
  }
  const body = context.req.valid('json') ?? {}
  const model = requireOfferedModel(body.model)
  if (body.faction !== undefined && isBotFaction(body.faction)) {
    // A Rootbotics bot plays its own turns: no AI player can take its seat.
    throw new HttpError(400, 'BOT_FACTION', { faction: body.faction })
  }
  const joinAction: Action = {
    type: 'join',
    playerId: `${AI_PLAYER_ID_PREFIX}${randomUUID()}`,
    ...(body.faction === undefined ? {} : { faction: body.faction }),
  }
  const result = game.apply(joinAction)
  room.aiPlayers = [
    ...room.aiPlayers,
    {
      playerId: joinAction.playerId,
      model,
      status: DEFAULT_AI_PLAYER_STATUS,
    },
  ]
  logGameEvent('JOIN', result.state, joinAction)
  publishGameChange(room)
  return context.json({ aiPlayers: listAiPlayerViews(room) }, 201)
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
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  const room: GameRoom = caller.room
  const game = requireGame(room)
  requireLobby(game)
  requireHostInOnlineGame(game, caller)
  const model = requireOfferedModel(context.req.valid('json').model)
  const playerId = requireAiPlayerId(room, context.req.valid('param').seat)
  room.aiPlayers = room.aiPlayers.map(
    (aiSeat: AiPlayerSeat): AiPlayerSeat =>
      aiSeat.playerId === playerId ? { ...aiSeat, model } : aiSeat,
  )
  publishGameChange(room)
  return context.json({ aiPlayers: listAiPlayerViews(room) }, 200)
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
  const room: GameRoom = resolveRoom(context.req.header(PLAYER_ID_HEADER))
  requireAiPlayerId(room, seat)
  runtimeOf(room).aiPlayerDriver.restart(seat)
  return context.json({ aiPlayers: listAiPlayerViews(room) }, 200)
})

const streamAiPlayerActivityRoute = createRoute({
  method: 'get',
  path: '/ai-players/stream',
  tags: ['ai-player'],
  summary: 'Stream what the AI players do',
  description:
    'Server-sent events, one per activity (message to the model, its reply, tool call, tool result, failure): the latest ones first, then live. Shows what an AI player sees and thinks, its hand included. With X-Player-Id: only the caller room; without: every room, each activity tagged with its roomCode. Operator tool: no seat check.',
  responses: {
    200: {
      description: 'Event stream; the data of each event is one AiPlayerActivity',
      content: { 'text/event-stream': { schema: AiPlayerActivitySchema } },
    },
  },
})

aiPlayerRoutes.openapi(streamAiPlayerActivityRoute, (context) => {
  const playerId: string | undefined = context.req.header(PLAYER_ID_HEADER)
  // A player sees the AI seats of their own room; the operator (no join id) sees every room.
  const watchedRoomCode: string | null | undefined =
    playerId === undefined ? undefined : resolveRoom(playerId).roomCode
  return streamSSE(context, async (stream: SSEStreamingApi): Promise<void> => {
    const send = (activity: AiPlayerActivity): void => {
      if (watchedRoomCode !== undefined && activity.roomCode !== watchedRoomCode) return
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
function requireAiPlayerId(room: GameRoom, seat: number): string {
  const player = requireGame(room).state.players.find(
    (candidate: PlayerState): boolean => candidate.seat === seat,
  )
  const aiSeat = room.aiPlayers.find(
    (candidate: AiPlayerSeat): boolean =>
      candidate.playerId === player?.playerId,
  )
  if (aiSeat === undefined) {
    throw new HttpError(404, 'NO_AI_PLAYER', { seat })
  }
  return aiSeat.playerId
}
