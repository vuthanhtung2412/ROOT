import {
  createRootWebClient,
  type components,
  type RootWebClient,
} from '@root/web-client'

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

function throwIfHttpError(result: ClientResult<unknown>): void {
  if (!result.response.ok) {
    const body = readErrorBody(result.error ?? {})
    throw new ApiError(result.response.status, {
      code: body.code ?? 'HTTP_ERROR',
      detail: body.detail ?? null,
    })
  }
}

/**
 * Narrow game view used by Phaser. OpenAPI marks GameState as opaque JSON;
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
    playArea?: Array<{ id: string; defId: string }>
    craftedItems?: Array<string | { type: string; exhausted?: boolean }>
    board?: unknown
  }>
  clearings: Array<{
    pieces: Array<{
      id: string
      kind: string
      owner: number
      type?: string
      used?: boolean
    }>
    ruin?: { items: string[] }
  }>
  deck?: {
    discard: Array<{ id: string; defId: string }>
  }
  pending: unknown[]
  winner?: number
  turnScratch?: unknown
}

export type ActionSpec = components['schemas']['ActionSpec']

export type ActionResult = {
  state: GameState
  log: unknown[]
}

export type LegalActionsResponse = {
  actions: ActionSpec[]
}

export type FallLayout = components['schemas']['FallLayoutResponse']

function isGameStatus(value: unknown): value is GameState['status'] {
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
  const pending = Reflect.get(value, 'pending')
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
    Array.isArray(clearings) &&
    Array.isArray(pending)
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

export type PhaserApiClient = ReturnType<typeof createPhaserApi>

export type CreatePhaserApiOptions = {
  /** Defaults to same-origin (Vite proxy) in browser. */
  baseUrl?: string
  client?: RootWebClient
}

export type CreateGameInput = {
  factions?: string[]
  /** When true, overwrite occupied slot. Host remote path omits this (409 if full). */
  replace?: boolean
}

/** Thin Phaser-facing helpers over the shared OpenAPI client. */
// Return type is PhaserApiClient via ReturnType<> below the implementation.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- circular with PhaserApiClient
export function createPhaserApi(options: CreatePhaserApiOptions = {}) {
  const client =
    options.client ??
    createRootWebClient({
      baseUrl: options.baseUrl ?? '',
    })

  return {
    async createGame(input: CreateGameInput = {}): Promise<{ state: GameState }> {
      const result = await client.POST('/game', {
        params: {
          query: input.replace === true ? { replace: '1' } : {},
        },
        body:
          input.factions === undefined
            ? {}
            : { factions: parseFactionIds(input.factions) },
      })
      const data = throwIfError(result)
      return { state: parseGameState(data.state) }
    },

    async join(playerId: string): Promise<ActionResult> {
      const result = await client.POST('/game/join', {
        body: { playerId },
      })
      return parseActionResult(throwIfError(result))
    },

    async start(): Promise<ActionResult> {
      const result = await client.POST('/game/start')
      return parseActionResult(throwIfError(result))
    },

    async getGame(): Promise<{ state: GameState; historyLength: number }> {
      const result = await client.GET('/game')
      const data = throwIfError(result)
      return {
        state: parseGameState(data.state),
        historyLength: data.historyLength,
      }
    },

    async legalActions(): Promise<LegalActionsResponse> {
      const result = await client.GET('/game/actions')
      return throwIfError(result)
    },

    async submitAction(action: unknown): Promise<ActionResult> {
      if (!isOpenApiAction(action)) {
        throw new Error('invalid action payload')
      }
      const result = await client.POST('/game/actions', {
        body: action,
      })
      return parseActionResult(throwIfError(result))
    },

    async undo(): Promise<{ state: GameState }> {
      const result = await client.POST('/game/undo')
      const data = throwIfError(result)
      return { state: parseGameState(data.state) }
    },

    async gameLog(): Promise<{ log: unknown[] }> {
      const result = await client.GET('/game/log')
      return throwIfError(result)
    },

    async fallLayout(): Promise<FallLayout> {
      const result = await client.GET('/map/fall/layout')
      return throwIfError(result)
    },

    async deleteGame(): Promise<void> {
      const result = await client.DELETE('/game')
      throwIfHttpError(result)
    },
  }
}
