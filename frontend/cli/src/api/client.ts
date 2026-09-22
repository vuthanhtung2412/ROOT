import {
  createRootWebClient,
  type components,
} from '@root/web-client'

const client = createRootWebClient()

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: unknown

  constructor(status: number, body: { code: string; detail?: unknown }) {
    super(body.code)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.detail = body.detail
  }
}

type ErrorBody = components['schemas']['ErrorBody']
type FactionId = components['schemas']['FactionId']
type OpenApiAction = components['schemas']['Action']
type OpenApiGameSnapshot = components['schemas']['GameSnapshot']
type OpenApiActionResult = components['schemas']['ActionResult']

type ClientResult<T> = {
  data?: T
  error?: unknown
  response: Response
}

const FACTION_ID_MARQUISE: FactionId = 'marquise'
const FACTION_ID_EYRIE: FactionId = 'eyrie'
const FACTION_ID_ALLIANCE: FactionId = 'alliance'
const FACTION_ID_VAGABOND: FactionId = 'vagabond'

function readErrorBody(value: unknown): Partial<ErrorBody> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }
  const code = Reflect.get(value, 'code')
  const detail = Reflect.get(value, 'detail')
  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(detail !== undefined ? { detail } : {}),
  }
}

function throwIfError<T>(result: ClientResult<T>): T {
  if (!result.response.ok) {
    const body = readErrorBody(result.error ?? {})
    throw new ApiError(result.response.status, {
      code: body.code ?? 'HTTP_ERROR',
      detail: body.detail ?? null,
    })
  }
  if (result.data === undefined) {
    throw new ApiError(result.response.status, {
      code: 'EMPTY_RESPONSE',
      detail: null,
    })
  }
  return result.data
}

/**
 * Narrow game view used by CLI commands. OpenAPI marks GameState as opaque JSON;
 * runtime shape still matches the engine.
 */
export type GameState = {
  id: string
  seed: number
  status: 'waiting' | 'setup' | 'playing' | 'finished'
  turn: number
  currentSeat: number
  phase: string
  step: string
  factions: string[]
  players: Array<{
    playerId: string
    seat: number
    faction: string
    vp: number
    hand: Array<{ id: string; defId: string }>
  }>
  clearings: Array<{
    pieces: Array<{ id: string; kind: string; owner: number }>
  }>
  winner?: number
}

export type ActionSpec = components['schemas']['ActionSpec']

export type ActionResult = {
  state: GameState
  log: unknown[]
}

function isGameStatus(
  value: unknown,
): value is GameState['status'] {
  return (
    value === 'waiting' ||
    value === 'setup' ||
    value === 'playing' ||
    value === 'finished'
  )
}

function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const id = Reflect.get(value, 'id')
  const seed = Reflect.get(value, 'seed')
  const status = Reflect.get(value, 'status')
  const turn = Reflect.get(value, 'turn')
  const currentSeat = Reflect.get(value, 'currentSeat')
  const phase = Reflect.get(value, 'phase')
  const step = Reflect.get(value, 'step')
  const factions = Reflect.get(value, 'factions')
  const players = Reflect.get(value, 'players')
  const clearings = Reflect.get(value, 'clearings')
  return (
    typeof id === 'string' &&
    typeof seed === 'number' &&
    isGameStatus(status) &&
    typeof turn === 'number' &&
    typeof currentSeat === 'number' &&
    typeof phase === 'string' &&
    typeof step === 'string' &&
    Array.isArray(factions) &&
    Array.isArray(players) &&
    Array.isArray(clearings)
  )
}

function parseGameState(value: unknown): GameState {
  if (!isGameState(value)) {
    throw new Error('invalid game state payload')
  }
  return value
}

function parseActionResult(value: OpenApiActionResult): ActionResult {
  return {
    state: parseGameState(value.state),
    log: Array.isArray(value.log) ? value.log : [],
  }
}

function isFactionId(value: string): value is FactionId {
  return (
    value === FACTION_ID_MARQUISE ||
    value === FACTION_ID_EYRIE ||
    value === FACTION_ID_ALLIANCE ||
    value === FACTION_ID_VAGABOND
  )
}

function parseFactionIds(values: string[]): FactionId[] {
  const factionIds: FactionId[] = []
  for (const value of values) {
    if (!isFactionId(value)) {
      throw new Error(`invalid faction id: ${value}`)
    }
    factionIds.push(value)
  }
  return factionIds
}

function isOpenApiAction(value: unknown): value is OpenApiAction {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'type') === 'string'
  )
}

function isOpenApiGameSnapshot(value: unknown): value is OpenApiGameSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const state = Reflect.get(value, 'state')
  const history = Reflect.get(value, 'history')
  const log = Reflect.get(value, 'log')
  const rng = Reflect.get(value, 'rng')
  if (!isGameState(state) || !Array.isArray(history) || !Array.isArray(log)) {
    return false
  }
  if (typeof rng !== 'object' || rng === null) {
    return false
  }
  const seed = Reflect.get(rng, 'seed')
  const cursor = Reflect.get(rng, 'cursor')
  return typeof seed === 'number' && typeof cursor === 'number'
}

export const api = {
  async create(factions?: string[]) {
    const result = await client.POST('/game', {
      params: { query: { replace: '1' } },
      body:
        factions === undefined
          ? {}
          : { factions: parseFactionIds(factions) },
    })
    const data = throwIfError(result)
    return { state: parseGameState(data.state) }
  },

  async join(playerId: string) {
    const result = await client.POST('/game/join', {
      body: { playerId },
    })
    return parseActionResult(throwIfError(result))
  },

  async start() {
    const result = await client.POST('/game/start')
    return parseActionResult(throwIfError(result))
  },

  async get() {
    const result = await client.GET('/game')
    const data = throwIfError(result)
    return {
      state: parseGameState(data.state),
      historyLength: data.historyLength,
    }
  },

  async snapshot() {
    const result = await client.GET('/game/snapshot')
    return throwIfError(result)
  },

  async loadSnapshot(snapshot: unknown) {
    if (!isOpenApiGameSnapshot(snapshot)) {
      throw new Error('invalid game snapshot payload')
    }
    const result = await client.PUT('/game/snapshot', {
      params: { query: { replace: '1' } },
      body: snapshot,
    })
    const data = throwIfError(result)
    return { state: parseGameState(data.state) }
  },

  async actions() {
    const result = await client.GET('/game/actions')
    return throwIfError(result)
  },

  async act(action: unknown) {
    if (!isOpenApiAction(action)) {
      throw new Error('invalid action payload')
    }
    const result = await client.POST('/game/actions', {
      body: action,
    })
    return parseActionResult(throwIfError(result))
  },

  async log() {
    const result = await client.GET('/game/log')
    return throwIfError(result)
  },

  async undo() {
    const result = await client.POST('/game/undo')
    const data = throwIfError(result)
    return { state: parseGameState(data.state) }
  },

  async delete() {
    const result = await client.DELETE('/game')
    throwIfError(result)
  },
}
