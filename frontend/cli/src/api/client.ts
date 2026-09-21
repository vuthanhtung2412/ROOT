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

type ClientResult<T> = {
  data?: T
  error?: unknown
  response: Response
}

function throwIfError<T>(result: ClientResult<T>): T {
  if (!result.response.ok) {
    const body = (result.error ?? {}) as Partial<ErrorBody>
    throw new ApiError(result.response.status, {
      code: body.code ?? 'HTTP_ERROR',
      detail: body.detail ?? null,
    })
  }
  return result.data as T
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

function asGameState(value: unknown): GameState {
  return value as GameState
}

function asActionResult(value: components['schemas']['ActionResult']): ActionResult {
  return {
    state: asGameState(value.state),
    log: value.log as unknown[],
  }
}

export const api = {
  async create(factions?: string[]) {
    const result = await client.POST('/game', {
      params: { query: { replace: '1' } },
      body:
        factions === undefined
          ? {}
          : { factions: factions as components['schemas']['FactionId'][] },
    })
    const data = throwIfError(result)
    return { state: asGameState(data.state) }
  },

  async join(playerId: string) {
    const result = await client.POST('/game/join', {
      body: { playerId },
    })
    return asActionResult(throwIfError(result))
  },

  async start() {
    const result = await client.POST('/game/start')
    return asActionResult(throwIfError(result))
  },

  async get() {
    const result = await client.GET('/game')
    const data = throwIfError(result)
    return {
      state: asGameState(data.state),
      historyLength: data.historyLength,
    }
  },

  async snapshot() {
    const result = await client.GET('/game/snapshot')
    return throwIfError(result)
  },

  async loadSnapshot(snapshot: unknown) {
    const result = await client.PUT('/game/snapshot', {
      params: { query: { replace: '1' } },
      body: snapshot as components['schemas']['GameSnapshot'],
    })
    const data = throwIfError(result)
    return { state: asGameState(data.state) }
  },

  async actions() {
    const result = await client.GET('/game/actions')
    return throwIfError(result)
  },

  async act(action: unknown) {
    const result = await client.POST('/game/actions', {
      body: action as components['schemas']['Action'],
    })
    return asActionResult(throwIfError(result))
  },

  async log() {
    const result = await client.GET('/game/log')
    return throwIfError(result)
  },

  async undo() {
    const result = await client.POST('/game/undo')
    const data = throwIfError(result)
    return { state: asGameState(data.state) }
  },

  async delete() {
    const result = await client.DELETE('/game')
    throwIfError(result)
  },
}
