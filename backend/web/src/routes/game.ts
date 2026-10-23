import {
  FALL,
  FALL_LAYOUT,
  Game,
  isBotFaction,
  type Action,
  type GameState,
  formatGameView,
  formatTurnLog,
  toAscii,
  toSvg,
} from '@root/lib'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { logGameEvent } from '#debug/logGame.js'
import {
  requireCooperativeStart,
  requireNoTwinClash,
} from '#lobby/cooperativeLobby.js'
import { isOnlineRoom, openOnlineRoom } from '#lobby/onlineRooms.js'
import {
  gameExists,
  HttpError,
  notYourSeat,
} from '#middleware/errors.js'
import {
  resolveGameCaller,
  resolveRoom,
  type GameCaller,
} from '#middleware/roomResolver.js'
import {
  mayPlayerSendAction,
  ONLINE_HOST_SEAT,
  PLAYER_ID_HEADER,
  seatForPlayerId,
} from '#view/actionSeatGuard.js'
import {
  errorResponses,
  PLAYER_VIEW,
  roomLimitResponse,
  ReplaceQuerySchema,
  UndoQuerySchema,
  ViewQuerySchema,
} from '#schemas/common.js'
import {
  ActionResultSchema,
  ActionSchema,
  CreateGameBodySchema,
  CreateGameResponseSchema,
  GameSnapshotSchema,
  GetGameResponseSchema,
  JoinBodySchema,
  LegalActionsResponseSchema,
  LogResponseSchema,
  UndoResponseSchema,
} from '#schemas/game.js'
import {
  closeOnlineRoom,
  isSeatScoped,
  publishGameChange,
  requireGame,
} from '#routes/roomAccess.js'
import { persistRoom } from '#store/gamePersistence.js'
import { runtimeOf } from '#store/roomRuntime.js'
import {
  DEFAULT_BOT_STEP_DELAY_SECONDS,
  DEFAULT_LOBBY_MODE,
  resetGameStore,
  store,
  type GameRoom,
} from '#store/GameStore.js'
import { listAiPlayerViews } from '#view/aiPlayerView.js'
import { formatPlayerGameView, formatPlayerLog } from '#view/playerView.js'
import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'
import {
  redactLogForViewer,
  type ViewerLogEntry,
} from '#view/redactLogForViewer.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'
import {
  isAction,
  hasOnlyOwnTraits,
  isFactionIdArray,
  isGameSnapshot,
} from '#typeGuards.js'


/** Seat-scoped: state as the caller may see it. Otherwise: full state. */
function stateForCaller(game: Game, caller: GameCaller): GameState {
  if (!isSeatScoped(caller.room, caller.view)) {
    return game.state
  }
  return redactStateForViewer(game.state, caller.playerId ?? '')
}

/** Seat-scoped: log entries as the caller may see them. Otherwise: full log. */
function logForCaller(game: Game, caller: GameCaller): ViewerLogEntry[] {
  if (!isSeatScoped(caller.room, caller.view)) {
    return [...game.log]
  }
  return redactLogForViewer(game.log, game.state, caller.playerId ?? '')
}

/** Online mode: full-slot dumps would leak hands and join ids. */
function requireHotseatForFullDump(room: GameRoom): void {
  if (room.mode === 'online') {
    throw new HttpError(403, 'ONLINE_MODE', 'full game dump is hotseat-only')
  }
}

/**
 * A live online game belongs to its players: only the host (seat 0) may
 * replace or remove it. Free slot, hotseat games and finished games are open.
 */
function requireHostToReplaceOnlineGame(caller: GameCaller): void {
  const { room, playerId } = caller
  const game = room.game
  if (
    game === null ||
    room.mode !== 'online' ||
    game.state.status === 'finished' ||
    // Lobby nobody joined yet has no host to ask.
    game.state.players.length === 0
  ) {
    return
  }
  const isHost =
    playerId !== undefined &&
    seatForPlayerId(game.state, playerId) === ONLINE_HOST_SEAT
  if (!isHost) {
    throw new HttpError(403, 'NOT_HOST', 'only the host may end an online game')
  }
}

/** Seat-scoped only: reject callers whose seat may not send this action type. */
function requireSeatForAction(
  game: Game,
  caller: GameCaller,
  actionType: string,
): void {
  if (!isSeatScoped(caller.room, caller.view)) {
    return
  }
  if (!mayPlayerSendAction(game, caller.playerId, actionType)) {
    notYourSeat()
  }
}

/** `POST /game/undo?scope=turn`: the undo a player may use. */
const TURN_UNDO_SCOPE = 'turn'

export const gameRoutes = new OpenAPIHono()

const createGameRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['game'],
  summary: 'Create lobby',
  description:
    'Online mode: always a new room with its own code; the caller (X-Player-Id) is in it. 409 ALREADY_IN_GAME while the caller is in another unfinished game. Hotseat: the single hotseat slot.',
  request: {
    query: ReplaceQuerySchema,
    body: {
      content: { 'application/json': { schema: CreateGameBodySchema } },
      required: false,
    },
  },
  responses: {
    201: {
      description: 'Lobby created',
      content: { 'application/json': { schema: CreateGameResponseSchema } },
    },
    ...errorResponses,
    ...roomLimitResponse,
  },
})

gameRoutes.openapi(createGameRoute, async (context) => {
  const playerId: string | undefined = context.req.header(PLAYER_ID_HEADER)
  const body = context.req.valid('json') ?? {}
  const isOnline: boolean = body.mode === 'online'
  if (!isOnline) {
    if (store.game && context.req.valid('query').replace !== '1') {
      gameExists()
    }
    requireHostToReplaceOnlineGame({ room: store, playerId })
  }
  const seed = Math.floor(Math.random() * 1_000_000_000)
  const factions =
    body.factions === undefined
      ? undefined
      : isFactionIdArray(body.factions)
        ? body.factions
        : (() => {
            throw new HttpError(400, 'BAD_FACTIONS', body.factions)
          })()
  const botSettings = body.botSettings
  if (botSettings !== undefined && !hasOnlyOwnTraits(botSettings)) {
    throw new HttpError(400, 'BAD_BOT_SETTINGS', botSettings)
  }
  const game: Game = Game.create({
    seed,
    factions,
    ...(botSettings === undefined ? {} : { botSettings }),
  })
  const room: GameRoom = isOnline ? openOnlineRoom(playerId) : store
  room.game = game
  room.mode = body.mode ?? DEFAULT_LOBBY_MODE
  room.aiPlayers = []
  room.botStepDelaySeconds = DEFAULT_BOT_STEP_DELAY_SECONDS
  logGameEvent('CREATE', game.state)
  publishGameChange(room)
  return context.json(
    { state: game.state, mode: room.mode, roomCode: room.roomCode },
    201,
  )
})

const joinRoute = createRoute({
  method: 'post',
  path: '/join',
  tags: ['game'],
  summary: 'Join lobby',
  request: {
    body: {
      content: { 'application/json': { schema: JoinBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Joined',
      content: { 'application/json': { schema: ActionResultSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(joinRoute, async (context) => {
  const body = context.req.valid('json')
  const caller: GameCaller = resolveGameCaller(body.playerId)
  const room: GameRoom = caller.room
  const game = requireGame(room)
  if (body.faction !== undefined) {
    if (room.mode === 'online' && isBotFaction(body.faction)) {
      // Online bots are seated by the host through `POST /game/bots`.
      throw new HttpError(400, 'BOT_FACTION', { faction: body.faction })
    }
    requireNoTwinClash(game.state, { playerId: body.playerId, faction: body.faction })
  }
  const joinAction: Action = {
    type: 'join',
    playerId: body.playerId,
    ...(body.faction === undefined ? {} : { faction: body.faction }),
  }
  const result = game.apply(joinAction)
  logGameEvent('JOIN', result.state, joinAction)
  publishGameChange(room)
  return context.json({ ...result, state: stateForCaller(game, caller) }, 200)
})

const startRoute = createRoute({
  method: 'post',
  path: '/start',
  tags: ['game'],
  summary: 'Start game',
  responses: {
    200: {
      description: 'Started',
      content: { 'application/json': { schema: ActionResultSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(startRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  const game = requireGame(caller.room)
  requireSeatForAction(game, caller, 'start')
  requireCooperativeStart(game.state)
  const result = game.start()
  logGameEvent('START', result.state, { type: 'start' })
  publishGameChange(caller.room)
  return context.json({ ...result, state: stateForCaller(game, caller) }, 200)
})

const getGameRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['game'],
  summary: 'Get current game',
  request: { query: ViewQuerySchema },
  responses: {
    200: {
      description: 'Current game',
      content: { 'application/json': { schema: GetGameResponseSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getGameRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(
    context.req.header(PLAYER_ID_HEADER),
    context.req.valid('query').view,
  )
  const room: GameRoom = caller.room
  const game = requireGame(room)
  return context.json(
    {
      state: stateForCaller(game, caller),
      historyLength: game.history.length,
      mode: room.mode,
      roomCode: room.roomCode,
      aiPlayers: listAiPlayerViews(room),
      botStepDelaySeconds: room.botStepDelaySeconds,
    },
    200,
  )
})

const getGameViewRoute = createRoute({
  method: 'get',
  path: '/view',
  tags: ['game'],
  summary: 'Get formatted current game',
  request: { query: ViewQuerySchema },
  responses: {
    200: {
      description: 'Formatted game state',
      content: { 'text/plain': { schema: z.string() } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getGameViewRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  const game = requireGame(caller.room)
  if (context.req.valid('query').view === PLAYER_VIEW) {
    return context.text(formatPlayerGameView(game, caller.playerId ?? ''), 200)
  }
  requireHotseatForFullDump(caller.room)
  return context.text(
    formatGameView(game.state, { historyLength: game.history.length }),
    200,
  )
})

const getSnapshotRoute = createRoute({
  method: 'get',
  path: '/snapshot',
  tags: ['game'],
  summary: 'Get lossless snapshot',
  responses: {
    200: {
      description: 'GameSnapshot',
      content: { 'application/json': { schema: GameSnapshotSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getSnapshotRoute, (context) => {
  const room: GameRoom = resolveRoom(context.req.header(PLAYER_ID_HEADER))
  const game = requireGame(room)
  requireHotseatForFullDump(room)
  return context.json(game.toJSON(), 200)
})

const putSnapshotRoute = createRoute({
  method: 'put',
  path: '/snapshot',
  tags: ['game'],
  summary: 'Load snapshot into slot',
  request: {
    query: ReplaceQuerySchema,
    body: {
      content: { 'application/json': { schema: GameSnapshotSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Loaded',
      content: { 'application/json': { schema: CreateGameResponseSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(putSnapshotRoute, async (context) => {
  // Snapshots are QA / dev loads: always the hotseat slot, never an online room.
  const room: GameRoom = store
  if (room.game && context.req.valid('query').replace !== '1') {
    gameExists()
  }
  requireHostToReplaceOnlineGame({ room, playerId: context.req.header(PLAYER_ID_HEADER) })
  const body = context.req.valid('json')
  if (!isGameSnapshot(body)) {
    throw new HttpError(400, 'BAD_SNAPSHOT', 'invalid snapshot shape')
  }
  let game: Game
  try {
    game = Game.fromJSON(body)
  } catch (err) {
    throw new HttpError(
      400,
      'BAD_SNAPSHOT',
      err instanceof Error ? err.message : 'fromJSON failed',
    )
  }
  room.game = game
  // Loaded snapshots are QA / dev slots: every seat is driven from one device.
  room.mode = DEFAULT_LOBBY_MODE
  room.aiPlayers = []
  room.botStepDelaySeconds = DEFAULT_BOT_STEP_DELAY_SECONDS
  persistRoom(room)
  runtimeOf(room).aiPlayerDriver.handleGameChanged()
  logGameEvent('LOAD', game.state)
  return context.json(
    { state: game.state, mode: room.mode, roomCode: room.roomCode },
    200,
  )
})

const getActionsRoute = createRoute({
  method: 'get',
  path: '/actions',
  tags: ['game'],
  summary: 'List legal actions',
  request: { query: ViewQuerySchema },
  responses: {
    200: {
      description: 'Legal ActionSpecs',
      content: { 'application/json': { schema: LegalActionsResponseSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getActionsRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(
    context.req.header(PLAYER_ID_HEADER),
    context.req.valid('query').view,
  )
  const game = requireGame(caller.room)
  const actions =
    isSeatScoped(caller.room, caller.view)
      ? redactLegalActionsForViewer(
          game.legalActions(),
          game.state,
          caller.playerId ?? '',
        )
      : game.legalActions()
  return context.json({ actions }, 200)
})

const postActionsRoute = createRoute({
  method: 'post',
  path: '/actions',
  tags: ['game'],
  summary: 'Apply action',
  request: {
    query: ViewQuerySchema,
    body: {
      content: { 'application/json': { schema: ActionSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Applied',
      content: { 'application/json': { schema: ActionResultSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(postActionsRoute, async (context) => {
  const caller: GameCaller = resolveGameCaller(
    context.req.header(PLAYER_ID_HEADER),
    context.req.valid('query').view,
  )
  const game = requireGame(caller.room)
  const body = context.req.valid('json')
  if (!isAction(body)) {
    throw new HttpError(400, 'BAD_ACTION', 'invalid action shape')
  }
  requireSeatForAction(game, caller, body.type)
  const result = game.apply(body)
  logGameEvent('ACT', result.state, body, result.log)
  publishGameChange(caller.room)
  return context.json({ ...result, state: stateForCaller(game, caller) }, 200)
})

const getLogRoute = createRoute({
  method: 'get',
  path: '/log',
  tags: ['game'],
  summary: 'Get game log',
  request: { query: ViewQuerySchema },
  responses: {
    200: {
      description: 'Log entries',
      content: { 'application/json': { schema: LogResponseSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getLogRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(
    context.req.header(PLAYER_ID_HEADER),
    context.req.valid('query').view,
  )
  const game = requireGame(caller.room)
  return context.json({ log: logForCaller(game, caller) }, 200)
})

const getFormattedLogRoute = createRoute({
  method: 'get',
  path: '/log/view',
  tags: ['game'],
  summary: 'Get formatted game log',
  request: { query: ViewQuerySchema },
  responses: {
    200: {
      description: 'Formatted game log',
      content: { 'text/plain': { schema: z.string() } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getFormattedLogRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  const game = requireGame(caller.room)
  if (context.req.valid('query').view === PLAYER_VIEW) {
    return context.text(
      formatPlayerLog(game, caller.playerId ?? '', game.log.length),
      200,
    )
  }
  requireHotseatForFullDump(caller.room)
  return context.text(formatTurnLog(game.log, game.state), 200)
})

const undoRoute = createRoute({
  method: 'post',
  path: '/undo',
  tags: ['game'],
  summary: 'Undo last action',
  request: { query: UndoQuerySchema },
  responses: {
    200: {
      description: 'Restored state',
      content: { 'application/json': { schema: UndoResponseSchema } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(undoRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  const room: GameRoom = caller.room
  const game = requireGame(room)
  const playerId = caller.playerId
  if (context.req.valid('query').scope === TURN_UNDO_SCOPE) {
    // A player takes back an action of their own turn (see `undoableActions`).
    if (
      room.mode === 'online' &&
      (playerId === undefined ||
        seatForPlayerId(game.state, playerId) !== game.state.currentSeat)
    ) {
      throw new HttpError(403, 'NOT_YOUR_TURN', 'only the player whose turn it is may undo')
    }
    game.undoTurnAction()
  } else {
    if (room.mode === 'online') {
      // Rewinding at will would undo draws and reveals other players have seen.
      throw new HttpError(403, 'ONLINE_MODE', 'full undo is hotseat-only')
    }
    game.undo()
  }
  logGameEvent('UNDO', game.state)
  publishGameChange(room)
  return context.json({ state: stateForCaller(game, caller) }, 200)
})

const mapSvgRoute = createRoute({
  method: 'get',
  path: '/map.svg',
  tags: ['game'],
  summary: 'SVG map preview (graph only)',
  responses: {
    200: {
      description: 'image/svg+xml',
      content: { 'image/svg+xml': { schema: z.string() } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(mapSvgRoute, (context) => {
  requireGame(resolveRoom(context.req.header(PLAYER_ID_HEADER)))
  const svg = toSvg(FALL, FALL_LAYOUT)
  return context.body(svg, 200, { 'Content-Type': 'image/svg+xml' })
})

const mapAsciiRoute = createRoute({
  method: 'get',
  path: '/map.ascii',
  tags: ['game'],
  summary: 'ASCII map preview',
  responses: {
    200: {
      description: 'text/plain',
      content: { 'text/plain': { schema: z.string() } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(mapAsciiRoute, (context) => {
  requireGame(resolveRoom(context.req.header(PLAYER_ID_HEADER)))
  const ascii = toAscii(FALL, FALL_LAYOUT)
  return context.text(ascii, 200)
})

const deleteGameRoute = createRoute({
  method: 'delete',
  path: '/',
  tags: ['game'],
  summary: 'Clear game slot',
  responses: {
    204: { description: 'Cleared' },
  },
})

gameRoutes.openapi(deleteGameRoute, (context) => {
  const caller: GameCaller = resolveGameCaller(context.req.header(PLAYER_ID_HEADER))
  requireHostToReplaceOnlineGame(caller)
  if (isOnlineRoom(caller.room)) {
    closeOnlineRoom(caller.room)
  } else {
    resetGameStore()
    publishGameChange(caller.room)
  }
  return context.body(null, 204)
})
