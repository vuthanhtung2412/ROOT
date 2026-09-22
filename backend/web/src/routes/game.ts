import {
  FALL,
  FALL_LAYOUT,
  Game,
  toAscii,
  toSvg,
} from '@root/lib'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { logGameEvent } from '#debug/logGame.js'
import { gameExists, HttpError, noGame } from '#middleware/errors.js'
import { errorResponses, ReplaceQuerySchema } from '#schemas/common.js'
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
import { store } from '#store/GameStore.js'
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
  logGameEvent('CREATE', store.game.state)
  broadcastCurrentGame()
  return context.json({ state: store.game.state }, 201)
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
  const result = game.join(body.playerId)
  logGameEvent('JOIN', result.state, { type: 'join', playerId: body.playerId })
  broadcastCurrentGame()
  return context.json(result, 200)
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
  const result = game.start()
  logGameEvent('START', result.state, { type: 'start' })
  broadcastCurrentGame()
  return context.json(result, 200)
})

const getGameRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['game'],
  summary: 'Get current game',
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
      state: game.state,
      historyLength: game.history.length,
    },
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
  logGameEvent('LOAD', store.game.state)
  return context.json({ state: store.game.state }, 200)
})

const getActionsRoute = createRoute({
  method: 'get',
  path: '/actions',
  tags: ['game'],
  summary: 'List legal actions',
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
  return context.json({ actions: game.legalActions() }, 200)
})

const postActionsRoute = createRoute({
  method: 'post',
  path: '/actions',
  tags: ['game'],
  summary: 'Apply action',
  request: {
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
  const result = game.apply(body)
  logGameEvent('ACT', result.state, body)
  broadcastCurrentGame()
  return context.json(result, 200)
})

const getLogRoute = createRoute({
  method: 'get',
  path: '/log',
  tags: ['game'],
  summary: 'Get game log',
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
  return context.json({ log: game.log }, 200)
})

const undoRoute = createRoute({
  method: 'post',
  path: '/undo',
  tags: ['game'],
  summary: 'Undo last action',
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
  game.undo()
  logGameEvent('UNDO', game.state)
  broadcastCurrentGame()
  return context.json({ state: game.state }, 200)
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
  store.game = null
  broadcastCurrentGame()
  return context.body(null, 204)
})
