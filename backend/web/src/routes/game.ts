import {
  FALL,
  FALL_LAYOUT,
  Game,
  toAscii,
  toSvg,
  type Action,
  type FactionId,
  type GameSnapshot,
} from '@root/lib'
import { Hono } from 'hono'
import { logGameEvent } from '../debug/logGame.js'
import { gameExists, HttpError, noGame } from '../middleware/errors.js'
import { store } from '../store/GameStore.js'

function isGameSnapshot(body: unknown): body is GameSnapshot {
  if (!body || typeof body !== 'object') return false
  const o = body as Record<string, unknown>
  return (
    o.state !== undefined &&
    Array.isArray(o.history) &&
    Array.isArray(o.log) &&
    o.rng !== undefined &&
    typeof o.rng === 'object'
  )
}

export const gameRoutes = new Hono()

function requireGame() {
  if (!store.game) noGame()
  return store.game!
}

gameRoutes.post('/', async (c) => {
  if (store.game && c.req.query('replace') !== '1') {
    gameExists()
  }

  let body: { factions?: FactionId[] } = {}
  try {
    body = await c.req.json<{ factions?: FactionId[] }>()
  } catch {
    body = {}
  }
  const seed = Math.floor(Math.random() * 1_000_000_000)
  store.game = Game.create({ seed, factions: body.factions })
  logGameEvent('CREATE', store.game.state)
  return c.json({ state: store.game.state }, 201)
})

gameRoutes.post('/join', async (c) => {
  const game = requireGame()
  const body = await c.req.json<{ playerId: string }>()
  const result = game.join(body.playerId)
  logGameEvent('JOIN', result.state, { type: 'join', playerId: body.playerId })
  return c.json(result)
})

gameRoutes.post('/start', (c) => {
  const game = requireGame()
  const result = game.start()
  logGameEvent('START', result.state, { type: 'start' })
  return c.json(result)
})

gameRoutes.get('/', (c) => {
  const game = requireGame()
  return c.json({
    state: game.state,
    historyLength: game.history.length,
  })
})

gameRoutes.get('/snapshot', (c) => {
  const game = requireGame()
  return c.json(game.toJSON())
})

gameRoutes.put('/snapshot', async (c) => {
  if (store.game && c.req.query('replace') !== '1') {
    gameExists()
  }
  const body: unknown = await c.req.json()
  if (!isGameSnapshot(body)) {
    throw new HttpError(400, 'BAD_SNAPSHOT', 'expected GameSnapshot { state, history, log, rng }')
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
  return c.json({ state: store.game.state }, 200)
})

gameRoutes.get('/actions', (c) => {
  const game = requireGame()
  return c.json({ actions: game.legalActions() })
})

gameRoutes.post('/actions', async (c) => {
  const game = requireGame()
  const action = (await c.req.json()) as Action
  const result = game.apply(action)
  logGameEvent('ACT', result.state, action)
  return c.json(result)
})

gameRoutes.get('/log', (c) => {
  const game = requireGame()
  return c.json({ log: game.log })
})

gameRoutes.post('/undo', (c) => {
  const game = requireGame()
  game.undo()
  logGameEvent('UNDO', game.state)
  return c.json({ state: game.state })
})

gameRoutes.get('/map.svg', (c) => {
  requireGame()
  const svg = toSvg(FALL, FALL_LAYOUT)
  return c.body(svg, 200, { 'Content-Type': 'image/svg+xml' })
})

gameRoutes.get('/map.ascii', (c) => {
  requireGame()
  const ascii = toAscii(FALL, FALL_LAYOUT)
  return c.text(ascii)
})

gameRoutes.delete('/', (c) => {
  store.game = null
  return c.body(null, 204)
})
