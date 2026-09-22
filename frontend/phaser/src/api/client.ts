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
    const body = (result.error ?? {}) as Partial<ErrorBody>
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
  }>
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

function asGameState(value: unknown): GameState {
  return value as GameState
}

function asActionResult(value: components['schemas']['ActionResult']): ActionResult {
  return {
    state: asGameState(value.state),
    log: value.log as unknown[],
  }
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
          query:
            input.replace === true ? { replace: '1' } : {},
        },
        body:
          input.factions === undefined
            ? {}
            : {
                factions:
                  input.factions as components['schemas']['FactionId'][],
              },
      })
      const data = throwIfError(result)
      return { state: asGameState(data.state) }
    },

    async join(playerId: string): Promise<ActionResult> {
      const result = await client.POST('/game/join', {
        body: { playerId },
      })
      return asActionResult(throwIfError(result))
    },

    async start(): Promise<ActionResult> {
      const result = await client.POST('/game/start')
      return asActionResult(throwIfError(result))
    },

    async getGame(): Promise<{ state: GameState; historyLength: number }> {
      const result = await client.GET('/game')
      const data = throwIfError(result)
      return {
        state: asGameState(data.state),
        historyLength: data.historyLength,
      }
    },

    async legalActions(): Promise<LegalActionsResponse> {
      const result = await client.GET('/game/actions')
      return throwIfError(result)
    },

    async submitAction(action: unknown): Promise<ActionResult> {
      const result = await client.POST('/game/actions', {
        body: action as components['schemas']['Action'],
      })
      return asActionResult(throwIfError(result))
    },

    async undo(): Promise<{ state: GameState }> {
      const result = await client.POST('/game/undo')
      const data = throwIfError(result)
      return { state: asGameState(data.state) }
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
