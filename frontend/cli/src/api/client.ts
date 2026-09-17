const BASE = process.env.ROOT_API ?? 'http://localhost:3000'

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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE}${path}`
  const init: RequestInit = { method, headers: {} }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(url, init)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined
  if (!res.ok) {
    const err = (data ?? { code: 'HTTP_ERROR' }) as { code: string; detail?: unknown }
    throw new ApiError(res.status, err)
  }
  return data as T
}

export type GameState = {
  id: string
  seed: number
  status: 'waiting' | 'playing' | 'finished'
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

export type ActionSpec = {
  type: string
  actor: number
  params?: Record<string, unknown[]>
}

export type ActionResult = {
  state: GameState
  log: unknown[]
}

export const api = {
  create(factions?: string[]) {
    return request<{ state: GameState }>('POST', '/game?replace=1', { factions })
  },

  join(playerId: string) {
    return request<ActionResult>('POST', '/game/join', { playerId })
  },

  start() {
    return request<ActionResult>('POST', '/game/start')
  },

  get() {
    return request<{ state: GameState; historyLength: number }>('GET', '/game')
  },

  snapshot() {
    return request<unknown>('GET', '/game/snapshot')
  },

  actions() {
    return request<{ actions: ActionSpec[] }>('GET', '/game/actions')
  },

  act(action: unknown) {
    return request<ActionResult>('POST', '/game/actions', action)
  },

  log() {
    return request<{ log: unknown[] }>('GET', '/game/log')
  },

  undo() {
    return request<{ state: GameState }>('POST', '/game/undo')
  },

  delete() {
    return request<void>('DELETE', '/game')
  },

  async mapAscii() {
    const url = `${BASE}/game/map.ascii`
    const res = await fetch(url)
    const text = await res.text()
    if (!res.ok) {
      const data = text ? (JSON.parse(text) as { code: string; detail?: unknown }) : { code: 'HTTP_ERROR' }
      throw new ApiError(res.status, data)
    }
    return text
  },
}
