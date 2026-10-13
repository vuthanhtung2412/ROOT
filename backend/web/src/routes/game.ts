import {
  FALL,
  FALL_LAYOUT,
  Game,
  type Action,
  type GameState,
  formatGameView,
  formatTurnLog,
  toAscii,
  toSvg,
} from '@root/lib'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { aiPlayerDriver } from '#aiPlayer/aiPlayerRuntime.js'
import { logGameEvent } from '#debug/logGame.js'
import {
  gameExists,
  HttpError,
  noGame,
  notYourSeat,
} from '#middleware/errors.js'
import {
  mayPlayerSendAction,
  ONLINE_HOST_SEAT,
  PLAYER_ID_HEADER,
  seatForPlayerId,
} from '#view/actionSeatGuard.js'
import {
  errorResponses,
  PLAYER_VIEW,
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
import { persistCurrentGame } from '#store/gamePersistence.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'
import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'
import {
  redactLogForViewer,
  type ViewerLogEntry,
} from '#view/redactLogForViewer.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'
import { broadcastCurrentGame } from '#ws/GameHub.js'
import {
  isAction,
  isFactionIdArray,
  isGameSnapshot,
} from '#typeGuards.js'

function requireGame(): Game {
  if (!store.game) noGame()
  return store.game
}

/**
 * After every slot change: save to disk, push to connected viewers, then let
 * the AI seats play what is theirs to play.
 */
function publishGameChange(): void {
  persistCurrentGame()
  broadcastCurrentGame()
  aiPlayerDriver.handleGameChanged()
}

/**
 * Seat-scoped calls see and do only what the caller's seat may. Always in
 * online mode; in hotseat only when the caller asks for the player view.
 */
function isSeatScoped(view: string | undefined): boolean {
  return store.mode === 'online' || view === PLAYER_VIEW
}

/** Seat-scoped: state as the caller may see it. Otherwise: full state. */
function stateForCaller(
  game: Game,
  playerId: string | undefined,
  view?: string,
): GameState {
  if (!isSeatScoped(view)) {
    return game.state
  }
  return redactStateForViewer(game.state, playerId ?? '')
}

/** Seat-scoped: log entries as the caller may see them. Otherwise: full log. */
function logForCaller(
  game: Game,
  playerId: string | undefined,
  view?: string,
): ViewerLogEntry[] {
  if (!isSeatScoped(view)) {
    return [...game.log]
  }
  return redactLogForViewer(game.log, game.state, playerId ?? '')
}

/** Online mode: full-slot dumps would leak hands and join ids. */
function requireHotseatForFullDump(): void {
  if (store.mode === 'online') {
    throw new HttpError(403, 'ONLINE_MODE', 'full game dump is hotseat-only')
  }
}

/**
 * A live online game belongs to its players: only the host (seat 0) may
 * replace or remove it. Free slot, hotseat games and finished games are open.
 */
function requireHostToReplaceOnlineGame(playerId: string | undefined): void {
  const game = store.game
  if (
    game === null ||
    store.mode !== 'online' ||
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
  playerId: string | undefined,
  actionType: string,
  view?: string,
): void {
  if (!isSeatScoped(view)) {
    return
  }
  if (!mayPlayerSendAction(game, playerId, actionType)) {
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
  },
})

gameRoutes.openapi(createGameRoute, async (context) => {
  if (store.game && context.req.valid('query').replace !== '1') {
    gameExists()
  }
  requireHostToReplaceOnlineGame(context.req.header(PLAYER_ID_HEADER))
  const body = context.req.valid('json') ?? {}
  const seed = Math.floor(Math.random() * 1_000_000_000)
  const factions =
    body.factions === undefined
      ? undefined
      : isFactionIdArray(body.factions)
        ? body.factions
        : (() => {
            throw new HttpError(400, 'BAD_FACTIONS', body.factions)
          })()
  store.game = Game.create({ seed, factions })
  store.mode = body.mode ?? DEFAULT_LOBBY_MODE
  store.aiPlayers = []
  logGameEvent('CREATE', store.game.state)
  publishGameChange()
  return context.json({ state: store.game.state, mode: store.mode }, 201)
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
  const game = requireGame()
  const body = context.req.valid('json')
  const joinAction: Action = {
    type: 'join',
    playerId: body.playerId,
    ...(body.faction === undefined ? {} : { faction: body.faction }),
  }
  const result = game.apply(joinAction)
  logGameEvent('JOIN', result.state, joinAction)
  publishGameChange()
  return context.json(
    { ...result, state: stateForCaller(game, body.playerId) },
    200,
  )
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
  const game = requireGame()
  const playerId = context.req.header(PLAYER_ID_HEADER)
  requireSeatForAction(game, playerId, 'start')
  const result = game.start()
  logGameEvent('START', result.state, { type: 'start' })
  publishGameChange()
  return context.json(
    { ...result, state: stateForCaller(game, playerId) },
    200,
  )
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
  const game = requireGame()
  return context.json(
    {
      state: stateForCaller(
        game,
        context.req.header(PLAYER_ID_HEADER),
        context.req.valid('query').view,
      ),
      historyLength: game.history.length,
      mode: store.mode,
    },
    200,
  )
})

const getGameViewRoute = createRoute({
  method: 'get',
  path: '/view',
  tags: ['game'],
  summary: 'Get formatted current game',
  responses: {
    200: {
      description: 'Formatted game state',
      content: { 'text/plain': { schema: z.string() } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getGameViewRoute, (context) => {
  const game = requireGame()
  requireHotseatForFullDump()
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
  const game = requireGame()
  requireHotseatForFullDump()
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
  if (store.game && context.req.valid('query').replace !== '1') {
    gameExists()
  }
  requireHostToReplaceOnlineGame(context.req.header(PLAYER_ID_HEADER))
  const body = context.req.valid('json')
  if (!isGameSnapshot(body)) {
    throw new HttpError(400, 'BAD_SNAPSHOT', 'invalid snapshot shape')
  }
  try {
    store.game = Game.fromJSON(body)
  } catch (err) {
    throw new HttpError(
      400,
      'BAD_SNAPSHOT',
      err instanceof Error ? err.message : 'fromJSON failed',
    )
  }
  // Loaded snapshots are QA / dev slots: every seat is driven from one device.
  store.mode = DEFAULT_LOBBY_MODE
  store.aiPlayers = []
  persistCurrentGame()
  aiPlayerDriver.handleGameChanged()
  logGameEvent('LOAD', store.game.state)
  return context.json({ state: store.game.state, mode: store.mode }, 200)
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
  const game = requireGame()
  const actions =
    isSeatScoped(context.req.valid('query').view)
      ? redactLegalActionsForViewer(
          game.legalActions(),
          game.state,
          context.req.header(PLAYER_ID_HEADER) ?? '',
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
  const game = requireGame()
  const body = context.req.valid('json')
  if (!isAction(body)) {
    throw new HttpError(400, 'BAD_ACTION', 'invalid action shape')
  }
  const playerId = context.req.header(PLAYER_ID_HEADER)
  const view = context.req.valid('query').view
  requireSeatForAction(game, playerId, body.type, view)
  const result = game.apply(body)
  logGameEvent('ACT', result.state, body, result.log)
  publishGameChange()
  return context.json(
    { ...result, state: stateForCaller(game, playerId, view) },
    200,
  )
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
  const game = requireGame()
  return context.json(
    {
      log: logForCaller(
        game,
        context.req.header(PLAYER_ID_HEADER),
        context.req.valid('query').view,
      ),
    },
    200,
  )
})

const getFormattedLogRoute = createRoute({
  method: 'get',
  path: '/log/view',
  tags: ['game'],
  summary: 'Get formatted game log',
  responses: {
    200: {
      description: 'Formatted game log',
      content: { 'text/plain': { schema: z.string() } },
    },
    ...errorResponses,
  },
})

gameRoutes.openapi(getFormattedLogRoute, (context) => {
  const game = requireGame()
  requireHotseatForFullDump()
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
  const game = requireGame()
  const playerId = context.req.header(PLAYER_ID_HEADER)
  if (context.req.valid('query').scope === TURN_UNDO_SCOPE) {
    // A player takes back an action of their own turn (see `undoableActions`).
    if (
      store.mode === 'online' &&
      (playerId === undefined ||
        seatForPlayerId(game.state, playerId) !== game.state.currentSeat)
    ) {
      throw new HttpError(403, 'NOT_YOUR_TURN', 'only the player whose turn it is may undo')
    }
    game.undoTurnAction()
  } else {
    if (store.mode === 'online') {
      // Rewinding at will would undo draws and reveals other players have seen.
      throw new HttpError(403, 'ONLINE_MODE', 'full undo is hotseat-only')
    }
    game.undo()
  }
  logGameEvent('UNDO', game.state)
  publishGameChange()
  return context.json({ state: stateForCaller(game, playerId) }, 200)
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
  requireGame()
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
  requireGame()
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
  requireHostToReplaceOnlineGame(context.req.header(PLAYER_ID_HEADER))
  store.game = null
  store.mode = DEFAULT_LOBBY_MODE
  store.aiPlayers = []
  publishGameChange()
  return context.body(null, 204)
})
