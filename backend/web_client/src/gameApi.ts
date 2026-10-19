import {
  createRootWebClient,
  type components,
  type RootWebClient,
} from '@root/web-client'

export type { RootWebClient } from '@root/web-client'

type ErrorBody = components['schemas']['ErrorBody']
export type FactionId = components['schemas']['FactionId']
export type ApiAction = components['schemas']['Action']
export type ActionSpec = components['schemas']['ActionSpec']
/** A legal action type in plain words: kind, Law of Root rules, JSON Schema. */
export type ExplainedAction = components['schemas']['ExplainedAction']
export type ExplainedActionsResponse =
  components['schemas']['ExplainedActionsResponse']
export type GameSnapshot = components['schemas']['GameSnapshot']
export type FallLayout = components['schemas']['FallLayoutResponse']
/** A seat played by an LLM: seat, `<provider>:<modelId>`, live status. */
export type AiPlayer = components['schemas']['AiPlayer']
type OpenApiActionResult = components['schemas']['ActionResult']

type ClientResult<T> = {
  data?: T
  error?: unknown
  response: Response
}

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
  /** Created with no faction set: players pick an untaken faction on joining. */
  openLobby?: boolean
  /** Rootbotics 3.3 — difficulty and traits per bot; absent = default, none. */
  botSettings?: BotSettingsByFaction
  /** Rootbotics 3.5.1 — the humans against the bots as one team; absent = free-for-all. */
  cooperative?: boolean
  /** Items left in the supply on the map, by item type. */
  itemSupply?: Record<string, number>
  /** Latest actions the player whose turn it is may take back; absent = none. */
  undoableActions?: number
  pending: unknown[]
  winner?: number
  /** Seats that win along with `winner` (Vagabond coalition, co-op team). */
  coWinners?: number[]
  /** Co-op game over: the team that won. */
  winningTeam?: 'humans' | 'bots'
  turnScratch?: unknown
}

export type ActionResult = {
  state: GameState
  log: unknown[]
}

export type LegalActionsResponse = {
  actions: ActionSpec[]
}

export type LobbyMode = components['schemas']['LobbyMode']

/** Request header carrying the caller's join id (online mode seat check). */
export const PLAYER_ID_HEADER = 'X-Player-Id'

/** Rootbotics 3.3 — difficulty and traits per bot faction. */
export type BotSettingsByFaction = components['schemas']['BotSettingsByFaction']
export type BotSettings = components['schemas']['BotSettings']
export type BotFactionId = components['schemas']['BotFactionId']
/** Free-for-all, or the humans against the bots (Rootbotics 3.5.1). */
export type PlayMode = components['schemas']['PlayMode']
/** Online bot pace: seconds the server waits after each bot action. */
export type BotStepDelaySeconds = components['schemas']['BotStepDelaySeconds']

/** The paces the server offers, slowest first. */
export const BOT_STEP_DELAY_SECONDS_OFFERED: readonly BotStepDelaySeconds[] = [5, 2, 1]

export function isBotStepDelaySeconds(value: number): value is BotStepDelaySeconds {
  return BOT_STEP_DELAY_SECONDS_OFFERED.some(
    (seconds: BotStepDelaySeconds): boolean => seconds === value,
  )
}

export type CreateGameInput = {
  factions?: string[]
  replace?: boolean
  mode?: LobbyMode
  botSettings?: BotSettingsByFaction
}

export type CreateGameApiOptions = {
  baseUrl?: string
  client?: RootWebClient
  request?: (request: Request) => Promise<Response>
  requestTimeoutMilliseconds?: number
  /** Current join id, sent on every request; null while not seated. */
  playerId?: () => string | null
  /**
   * Ask for the player view: see and do only what the `playerId` seat may,
   * also in a hotseat game.
   */
  playerView?: boolean
}

export type GameApi = {
  createGame: (
    input?: CreateGameInput,
  ) => Promise<{ state: GameState; mode: LobbyMode }>
  /** `faction`: the player's pick in an open lobby (created with no factions). */
  join: (playerId: string, faction?: string) => Promise<ActionResult>
  /** Open lobby, host only: free the seat of a human or AI player. */
  expelPlayer: (seat: number) => Promise<void>
  /** Open lobby, host only: free-for-all or co-op vs bots. */
  setPlayMode: (playMode: PlayMode) => Promise<void>
  /** Co-op lobby, host only: seat a bot (settings left out: remembered or default). */
  addBot: (faction: BotFactionId, settings?: BotSettings) => Promise<void>
  /** Lobby, host only: a bot's difficulty and traits. */
  setBotSettings: (faction: BotFactionId, settings: BotSettings) => Promise<void>
  start: () => Promise<ActionResult>
  getGame: () => Promise<{
    state: GameState
    historyLength: number
    mode: LobbyMode
    aiPlayers: AiPlayer[]
    /** Seconds between two bot actions (online: set by the host). */
    botStepDelaySeconds: number
  }>
  /** Online host (hotseat: anyone): the wait between two bot actions. */
  setBotPace: (botStepDelaySeconds: BotStepDelaySeconds) => Promise<void>
  gameView: () => Promise<string>
  getSnapshot: () => Promise<GameSnapshot>
  loadSnapshot: (snapshot: unknown, replace?: boolean) => Promise<{ state: GameState }>
  legalActions: () => Promise<LegalActionsResponse>
  /** Legal action types with kind, rules and JSON Schema; no legal values. */
  explainedActions: () => Promise<ExplainedActionsResponse>
  submitAction: (action: unknown) => Promise<ActionResult>
  gameLog: () => Promise<{ log: unknown[] }>
  formattedGameLog: () => Promise<string>
  /** Hotseat dev tool: rewind any action. */
  undo: () => Promise<{ state: GameState }>
  /** What a player may do: take back the latest action of the current turn. */
  undoTurnAction: () => Promise<{ state: GameState }>
  fallLayout: () => Promise<FallLayout>
  deleteGame: () => Promise<void>
}

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

export function requireData<T>(result: ClientResult<T>): T {
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

function requireSuccess(result: ClientResult<unknown>): void {
  if (!result.response.ok) {
    const body = readErrorBody(result.error ?? {})
    throw new ApiError(result.response.status, {
      code: body.code ?? 'HTTP_ERROR',
      detail: body.detail ?? null,
    })
  }
}

function isGameStatus(value: unknown): value is GameState['status'] {
  return (
    value === 'waiting' ||
    value === 'setup' ||
    value === 'playing' ||
    value === 'finished'
  )
}

export function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'seed') === 'number' &&
    isGameStatus(Reflect.get(value, 'status')) &&
    typeof Reflect.get(value, 'turn') === 'number' &&
    typeof Reflect.get(value, 'currentSeat') === 'number' &&
    typeof Reflect.get(value, 'phase') === 'string' &&
    typeof Reflect.get(value, 'step') === 'string' &&
    Array.isArray(Reflect.get(value, 'factions')) &&
    Array.isArray(Reflect.get(value, 'players')) &&
    Array.isArray(Reflect.get(value, 'clearings')) &&
    Array.isArray(Reflect.get(value, 'pending'))
  )
}

export function parseGameState(value: unknown): GameState {
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
    value === 'marquise' ||
    value === 'eyrie' ||
    value === 'alliance' ||
    value === 'vagabond' ||
    value === 'lizard' ||
    value === 'riverfolk' ||
    value === 'mechanicalMarquise' ||
    value === 'electricEyrie'
  )
}

export function parseFactionIds(values: string[]): FactionId[] {
  const factionIds: FactionId[] = []
  for (const value of values) {
    if (!isFactionId(value)) {
      throw new Error(`invalid faction id: ${value}`)
    }
    factionIds.push(value)
  }
  return factionIds
}

function isApiAction(value: unknown): value is ApiAction {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'type') === 'string'
  )
}

export function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (typeof value !== 'object' || value === null) return false
  if (!isGameState(Reflect.get(value, 'state'))) return false
  if (!Array.isArray(Reflect.get(value, 'history'))) return false
  if (!Array.isArray(Reflect.get(value, 'log'))) return false
  const rng = Reflect.get(value, 'rng')
  if (typeof rng !== 'object' || rng === null) return false
  return (
    typeof Reflect.get(rng, 'seed') === 'number' &&
    typeof Reflect.get(rng, 'cursor') === 'number'
  )
}

function timeoutRequest(
  timeoutMilliseconds: number,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds)
    const signal = AbortSignal.any([request.signal, timeoutSignal])
    return globalThis.fetch(new Request(request, { signal }))
  }
}

/** Wrap a sender so each request carries the caller's join id when known. */
function withPlayerIdHeader(
  send: (request: Request) => Promise<Response>,
  readPlayerId: () => string | null,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const playerId = readPlayerId()
    if (playerId === null || playerId === '') {
      return send(request)
    }
    const headers = new Headers(request.headers)
    headers.set(PLAYER_ID_HEADER, playerId)
    return send(new Request(request, { headers }))
  }
}

export function createClient(options: CreateGameApiOptions): RootWebClient {
  if (options.client !== undefined) return options.client
  const baseRequest =
    options.request ??
    (options.requestTimeoutMilliseconds === undefined
      ? undefined
      : timeoutRequest(options.requestTimeoutMilliseconds))
  const request =
    options.playerId === undefined
      ? baseRequest
      : withPlayerIdHeader(
          baseRequest ??
            ((plainRequest: Request): Promise<Response> =>
              globalThis.fetch(plainRequest)),
          options.playerId,
        )
  return createRootWebClient({
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(request === undefined ? {} : { request }),
  })
}

export function createGameApi(
  options: CreateGameApiOptions = {},
): GameApi {
  const client = createClient(options)
  const viewQuery: { view?: 'player' } =
    options.playerView === true ? { view: 'player' } : {}

  return {
    async createGame(
      input: CreateGameInput = {},
    ): Promise<{ state: GameState; mode: LobbyMode }> {
      const result = await client.POST('/game', {
        params: {
          query: input.replace === true ? { replace: '1' } : {},
        },
        body: {
          ...(input.factions === undefined
            ? {}
            : { factions: parseFactionIds(input.factions) }),
          ...(input.mode === undefined ? {} : { mode: input.mode }),
          ...(input.botSettings === undefined
            ? {}
            : { botSettings: input.botSettings }),
        },
      })
      const data = requireData(result)
      return { state: parseGameState(data.state), mode: data.mode }
    },

    async join(playerId: string, faction?: string): Promise<ActionResult> {
      const result = await client.POST('/game/join', {
        body: {
          playerId,
          ...(faction === undefined
            ? {}
            : { faction: parseFactionIds([faction])[0]! }),
        },
      })
      return parseActionResult(requireData(result))
    },

    async expelPlayer(seat: number): Promise<void> {
      requireSuccess(
        await client.DELETE('/game/players/{seat}', {
          params: { path: { seat } },
        }),
      )
    },

    async setPlayMode(playMode: PlayMode): Promise<void> {
      requireSuccess(await client.PUT('/game/play-mode', { body: { playMode } }))
    },

    async addBot(faction: BotFactionId, settings?: BotSettings): Promise<void> {
      requireSuccess(
        await client.POST('/game/bots', {
          body: { faction, ...(settings === undefined ? {} : { settings }) },
        }),
      )
    },

    async setBotSettings(faction: BotFactionId, settings: BotSettings): Promise<void> {
      requireSuccess(
        await client.PUT('/game/bots/{faction}', {
          params: { path: { faction } },
          body: { settings },
        }),
      )
    },

    async start(): Promise<ActionResult> {
      return parseActionResult(requireData(await client.POST('/game/start')))
    },

    async getGame(): Promise<{
      state: GameState
      historyLength: number
      mode: LobbyMode
      aiPlayers: AiPlayer[]
      botStepDelaySeconds: number
    }> {
      const data = requireData(
        await client.GET('/game', { params: { query: viewQuery } }),
      )
      return {
        state: parseGameState(data.state),
        historyLength: data.historyLength,
        mode: data.mode,
        // Absent on a server from before AI players.
        aiPlayers: data.aiPlayers ?? [],
        botStepDelaySeconds: data.botStepDelaySeconds,
      }
    },

    async setBotPace(botStepDelaySeconds: BotStepDelaySeconds): Promise<void> {
      requireSuccess(await client.PUT('/game/bot-pace', { body: { botStepDelaySeconds } }))
    },

    async gameView(): Promise<string> {
      return requireData(
        await client.GET('/game/view', {
          params: { query: viewQuery },
          parseAs: 'text',
        }),
      )
    },

    async getSnapshot(): Promise<GameSnapshot> {
      return requireData(await client.GET('/game/snapshot'))
    },

    async loadSnapshot(
      snapshot: unknown,
      replace = true,
    ): Promise<{ state: GameState }> {
      if (!isGameSnapshot(snapshot)) {
        throw new Error('invalid game snapshot payload')
      }
      const data = requireData(
        await client.PUT('/game/snapshot', {
          params: { query: replace ? { replace: '1' } : {} },
          body: snapshot,
        }),
      )
      return { state: parseGameState(data.state) }
    },

    async legalActions(): Promise<LegalActionsResponse> {
      return requireData(
        await client.GET('/game/actions', { params: { query: viewQuery } }),
      )
    },

    async explainedActions(): Promise<ExplainedActionsResponse> {
      return requireData(
        await client.GET('/game/actions/explained', {
          params: { query: viewQuery },
        }),
      )
    },

    async submitAction(action: unknown): Promise<ActionResult> {
      if (!isApiAction(action)) {
        throw new Error('invalid action payload')
      }
      const result = await client.POST('/game/actions', {
        params: { query: viewQuery },
        body: action,
      })
      return parseActionResult(requireData(result))
    },

    async gameLog(): Promise<{ log: unknown[] }> {
      return requireData(
        await client.GET('/game/log', { params: { query: viewQuery } }),
      )
    },

    async formattedGameLog(): Promise<string> {
      return requireData(
        await client.GET('/game/log/view', {
          params: { query: viewQuery },
          parseAs: 'text',
        }),
      )
    },

    async undo(): Promise<{ state: GameState }> {
      const data = requireData(await client.POST('/game/undo'))
      return { state: parseGameState(data.state) }
    },

    async undoTurnAction(): Promise<{ state: GameState }> {
      const data = requireData(
        await client.POST('/game/undo', {
          params: { query: { scope: 'turn' } },
        }),
      )
      return { state: parseGameState(data.state) }
    },

    async fallLayout(): Promise<FallLayout> {
      return requireData(await client.GET('/map/fall/layout'))
    },

    async deleteGame(): Promise<void> {
      requireSuccess(await client.DELETE('/game'))
    },
  }
}
