import type {
  ActionSpec,
  GameState,
  FrontendApiClient,
} from '#api/client.ts'
import { ApiError } from '#api/client.ts'
import {
  connectGameSocket,
  resolveWebSocketUrl,
  type ConnectGameSocketOptions,
  type GameSocketConnection,
  type GameSocketPush,
} from '#api/gameSocket.ts'
import { buildTurnBannerViewModel } from '#ui/TurnBanner.ts'
import {
  clearPlayerIdentity,
  createPlayerId,
  loadPlayerIdentity,
  savePlayerIdentity,
  type PlayerIdentityStorage,
  type StoredPlayerIdentity,
} from '#game/playerIdentity.ts'

export type GameSessionSnapshot = {
  state: GameState | null
  legalActions: ActionSpec[]
  historyLength: number
  log: unknown[]
  error: string | null
  loading: boolean
}

export type GameSessionListener = (snapshot: GameSessionSnapshot) => void

/** First click creates lobby as Marquise; second joins as Eyrie and starts. */
export type JoinMatchResult = 'waiting' | 'playing'

/** Play = resume stored seat when still in slot, else joinMatch. */
export type PlayResult = 'continued' | JoinMatchResult

/**
 * Server slot seen from the menu: nothing there, an online lobby with a free
 * seat, or a game that cannot be joined (hotseat, full, already started).
 */
export type OnlineLobbyStatus = 'none' | 'joinable' | 'busy'

/** The lobby creator joins first, so the host always holds seat 0. */
const ONLINE_HOST_SEAT = 0

const FIRST_PLAYER_ID = 'marquise'
const SECOND_PLAYER_ID = 'eyrie'
const DEFAULT_FACTIONS: string[] = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
]

export type GameSessionDependencies = {
  api: FrontendApiClient
  apiBaseUrl?: string
  identityStorage?: PlayerIdentityStorage | null
  connectSocket?: (options: ConnectGameSocketOptions) => GameSocketConnection
  resolveSocketUrl?: (apiBaseUrl: string, playerId: string) => string
  /** Online join id factory; defaults to a random id. */
  generatePlayerId?: () => string
}

/**
 * Client-side GP2 session for remote two-machine play.
 * Commands via REST; UI state from redacted WebSocket pushes.
 */
export class GameSession {
  private api: FrontendApiClient
  private apiBaseUrl: string
  private readonly identityStorage: PlayerIdentityStorage | null | undefined
  private readonly connectSocket: (
    options: ConnectGameSocketOptions,
  ) => GameSocketConnection
  private readonly resolveSocketUrl: (
    apiBaseUrl: string,
    playerId: string,
  ) => string
  private readonly generatePlayerId: () => string
  private readonly listeners: Set<GameSessionListener> = new Set()
  private localPlayerId: string | null = null
  private socket: GameSocketConnection | null = null
  /** QA Continue: live WS wake + REST refresh; never touch Play identity storage. */
  private qaMode = false
  /** Counts refresh() calls so only the latest one may publish. */
  private refreshSequence = 0
  private snapshot: GameSessionSnapshot = {
    state: null,
    legalActions: [],
    historyLength: 0,
    log: [],
    error: null,
    loading: false,
  }

  constructor(dependencies: GameSessionDependencies) {
    this.api = dependencies.api
    this.apiBaseUrl = dependencies.apiBaseUrl ?? ''
    this.identityStorage = dependencies.identityStorage
    this.connectSocket = dependencies.connectSocket ?? connectGameSocket
    this.resolveSocketUrl =
      dependencies.resolveSocketUrl ?? resolveWebSocketUrl
    this.generatePlayerId = dependencies.generatePlayerId ?? createPlayerId
  }

  getSnapshot(): GameSessionSnapshot {
    return this.snapshot
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId
  }

  getLocalSeat(): number | null {
    if (this.localPlayerId === null || this.snapshot.state === null) {
      return null
    }
    const player = this.snapshot.state.players.find(
      (entry) => entry.playerId === this.localPlayerId,
    )
    return player?.seat ?? null
  }

  /** Rebuild API client when menu sets a host IP. */
  rebindApi(api: FrontendApiClient, apiBaseUrl: string): void {
    this.disconnectSocket()
    this.api = api
    this.apiBaseUrl = apiBaseUrl
  }

  subscribe(listener: GameSessionListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  applySocketPush(payload: GameSocketPush): void {
    if (payload.state === null) {
      this.disconnectSocket()
      clearPlayerIdentity(
        this.identityStorage === undefined
          ? undefined
          : this.identityStorage,
      )
      this.localPlayerId = null
    }
    if (
      this.localPlayerId !== null &&
      payload.state !== null &&
      !playerIdInState(payload.state, this.localPlayerId)
    ) {
      this.setError('Stored playerId not in this game')
      return
    }
    this.publish({
      state: payload.state,
      legalActions: payload.legalActions,
      historyLength: payload.historyLength,
      log: payload.log,
      error: null,
      loading: false,
    })
  }

  /**
   * One-click play: resume stored seat if still in the API slot, else joinMatch.
   * Stale identity (missing / finished / wrong slot) is cleared before join.
   */
  async play(input: { factions?: string[] } = {}): Promise<PlayResult | null> {
    const storage =
      this.identityStorage === undefined ? undefined : this.identityStorage
    const stored = loadPlayerIdentity(storage)
    if (stored !== null) {
      this.setLoading(true)
      try {
        const game = await this.api.getGame()
        if (
          playerIdInState(game.state, stored.playerId) &&
          isResumableStatus(game.state.status)
        ) {
          this.bindLocalPlayer(stored.playerId, stored.apiBaseUrl)
          this.connectLocalSocket(stored.playerId)
          this.publish({
            state: game.state,
            legalActions: [],
            historyLength: game.historyLength,
            log: [],
            error: null,
            loading: false,
          })
          return 'continued'
        }
      } catch (error: unknown) {
        if (!isNoGameError(error)) {
          this.setError(errorMessage(error))
          return null
        }
      }
      clearPlayerIdentity(storage)
      this.localPlayerId = null
    }
    return this.joinMatch(input)
  }

  /**
   * One-click matchmaking against the single server slot.
   * - Empty slot → create, join Marquise, return `waiting` (peer starts).
   * - Occupied lobby → join Eyrie, auto-start, return `playing`.
   * - On failure → `null` and `snapshot.error` set.
   */
  async joinMatch(
    input: { factions?: string[] } = {},
  ): Promise<JoinMatchResult | null> {
    this.setLoading(true)
    try {
      const created = await this.tryCreateLobby(input.factions)
      if (created) {
        await this.api.join(FIRST_PLAYER_ID)
        this.bindLocalPlayer(FIRST_PLAYER_ID)
        this.connectLocalSocket(FIRST_PLAYER_ID)
        this.publish({
          ...this.snapshot,
          loading: false,
        })
        return 'waiting'
      }

      await this.api.join(SECOND_PLAYER_ID)
      this.bindLocalPlayer(SECOND_PLAYER_ID)
      this.connectLocalSocket(SECOND_PLAYER_ID)
      await this.api.start()
      this.publish({
        ...this.snapshot,
        loading: false,
      })
      return 'playing'
    } catch (error: unknown) {
      this.setError(errorMessage(error))
      return null
    }
  }

  /**
   * Continue: restore stored playerId, open WS, map to seat.
   * Unknown id → error (no new join). Prefer `play()` from the menu.
   */
  async continueWithStoredIdentity(
    identity?: StoredPlayerIdentity | null,
  ): Promise<void> {
    const stored =
      identity ??
      loadPlayerIdentity(
        this.identityStorage === undefined
          ? undefined
          : this.identityStorage,
      )
    if (stored === null) {
      this.setError('No stored player identity')
      return
    }
    this.setLoading(true)
    this.bindLocalPlayer(stored.playerId, stored.apiBaseUrl)
    this.connectLocalSocket(stored.playerId)
    this.publish({
      ...this.snapshot,
      loading: false,
    })
  }

  /**
   * QA-only: REST full slot (hands unredacted) + listen WS as wake signal.
   * Does not save/clear Play `playerIdentity` storage.
   */
  async continueQaLoadedGame(): Promise<void> {
    this.qaMode = true
    await this.refresh()
    this.syncQaViewerToActor()
  }

  /**
   * Join id to send with API requests so the server can check the seat.
   * Null until this browser holds a seat.
   */
  getRequestPlayerId(): string | null {
    return this.localPlayerId
  }

  /** Online: true when this browser holds seat 0 (the lobby creator). */
  isOnlineHost(): boolean {
    return !this.qaMode && this.getLocalSeat() === ONLINE_HOST_SEAT
  }

  /** What an online player can do with the server slot right now. */
  async findOnlineLobby(): Promise<OnlineLobbyStatus> {
    try {
      const game = await this.api.getGame()
      const hasFreeSeat = game.state.players.length < game.state.factions.length
      if (
        game.mode === 'online' &&
        game.state.status === 'waiting' &&
        hasFreeSeat
      ) {
        return 'joinable'
      }
      return 'busy'
    } catch (error: unknown) {
      if (isNoGameError(error)) {
        return 'none'
      }
      throw error
    }
  }

  /**
   * Online host: create an online lobby with the chosen factions and take
   * seat 0. Other browsers join; the host starts once every seat is filled.
   */
  async hostOnlineGame(factions: readonly string[]): Promise<boolean> {
    this.setLoading(true)
    this.qaMode = false
    try {
      await this.api.createGame({ factions: [...factions], mode: 'online' })
      return await this.takeNextOnlineSeat()
    } catch (error: unknown) {
      this.setError(
        isGameExistsError(error)
          ? 'A game is already running on this server'
          : errorMessage(error),
      )
      return false
    }
  }

  /** Online guest: take the next free seat of the waiting online lobby. */
  async joinOnlineGame(): Promise<boolean> {
    this.setLoading(true)
    this.qaMode = false
    try {
      const lobby = await this.findOnlineLobby()
      if (lobby !== 'joinable') {
        this.setError(
          lobby === 'none'
            ? 'No online game to join — ask the host to create one'
            : 'The game on this server cannot be joined',
        )
        return false
      }
      return await this.takeNextOnlineSeat()
    } catch (error: unknown) {
      this.setError(errorMessage(error))
      return false
    }
  }

  /** Online host: start the game once the lobby is full. */
  async startOnlineGame(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.start()
      this.publish({ ...this.snapshot, loading: false, error: null })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /**
   * Online reload: the stored join id still owns a seat in an online game →
   * reconnect to it. Otherwise forget the id.
   */
  async resumeOnlineGame(): Promise<boolean> {
    const storage =
      this.identityStorage === undefined ? undefined : this.identityStorage
    const stored = loadPlayerIdentity(storage)
    if (stored === null) {
      return false
    }
    // Send the stored id so the server returns this seat's own view.
    this.localPlayerId = stored.playerId
    try {
      const game = await this.api.getGame()
      if (
        game.mode === 'online' &&
        playerIdInState(game.state, stored.playerId) &&
        isResumableStatus(game.state.status)
      ) {
        this.qaMode = false
        this.connectLocalSocket(stored.playerId)
        this.publish({
          state: game.state,
          legalActions: [],
          historyLength: game.historyLength,
          log: [],
          error: null,
          loading: false,
        })
        return true
      }
    } catch (error: unknown) {
      if (!isNoGameError(error)) {
        this.localPlayerId = null
        this.setError(errorMessage(error))
        return false
      }
    }
    this.localPlayerId = null
    clearPlayerIdentity(storage)
    return false
  }

  private async takeNextOnlineSeat(): Promise<boolean> {
    const playerId = this.generatePlayerId()
    const joined = await this.api.join(playerId)
    this.bindLocalPlayer(playerId)
    this.connectLocalSocket(playerId)
    this.publish({
      state: joined.state,
      legalActions: [],
      historyLength: 0,
      log: [],
      error: null,
      loading: false,
    })
    return true
  }

  /**
   * Local hotseat from menu: replace slot, join every seat, start.
   * Follows current actor like QA (one device, all roles).
   */
  async startLocalParty(factions: readonly string[]): Promise<boolean> {
    this.setLoading(true)
    try {
      clearPlayerIdentity(
        this.identityStorage === undefined
          ? undefined
          : this.identityStorage,
      )
      this.localPlayerId = null
      this.qaMode = true
      await this.api.createGame({
        factions: [...factions],
        replace: true,
      })
      for (const faction of factions) {
        await this.api.join(faction)
      }
      await this.api.start()
      await this.refresh()
      this.syncQaViewerToActor()
      this.publish({
        ...this.snapshot,
        loading: false,
        error: null,
      })
      return true
    } catch (error: unknown) {
      this.setError(errorMessage(error))
      return false
    }
  }

  async refresh(): Promise<void> {
    this.refreshSequence += 1
    const sequence: number = this.refreshSequence
    this.setLoading(true)
    try {
      const [game, legal, logResponse] = await Promise.all([
        this.api.getGame(),
        this.api.legalActions(),
        this.api.gameLog(),
      ])
      // A newer refresh started while these three reads were in flight: this
      // result may be stale or mix two game states (state from one, legal
      // actions from the next). Drop it; the newer refresh publishes.
      if (sequence !== this.refreshSequence) {
        return
      }
      this.publish({
        state: game.state,
        legalActions: legal.actions,
        historyLength: game.historyLength,
        log: logResponse.log,
        error: null,
        loading: false,
      })
      if (this.qaMode) {
        this.syncQaViewerToActor()
      }
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  async submitAction(action: unknown): Promise<void> {
    if (!this.localSeatMayAct()) {
      this.setError('Not your seat')
      return
    }
    this.setLoading(true)
    try {
      await this.api.submitAction(action)
      this.publish({
        ...this.snapshot,
        loading: false,
        error: null,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  async undo(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.undo()
      this.publish({
        ...this.snapshot,
        loading: false,
        error: null,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /** End game: delete server slot, clear identity, close socket. */
  async restart(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.deleteGame()
      this.disconnectSocket()
      clearPlayerIdentity(
        this.identityStorage === undefined
          ? undefined
          : this.identityStorage,
      )
      this.qaMode = false
      this.localPlayerId = null
      this.publish({
        state: null,
        legalActions: [],
        historyLength: 0,
        log: [],
        error: null,
        loading: false,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  dispose(): void {
    this.disconnectSocket()
  }

  private async tryCreateLobby(factions?: string[]): Promise<boolean> {
    try {
      await this.api.createGame({
        factions: factions ?? DEFAULT_FACTIONS,
      })
      return true
    } catch (error: unknown) {
      if (isGameExistsError(error)) {
        return false
      }
      throw error
    }
  }

  private localSeatMayAct(): boolean {
    const localSeat = this.getLocalSeat()
    const state = this.snapshot.state
    if (localSeat === null || state === null) {
      return false
    }
    return (
      localSeat ===
      actorSeatFromState(state, this.snapshot.legalActions)
    )
  }

  private bindLocalPlayer(playerId: string, apiBaseUrl?: string): void {
    this.localPlayerId = playerId
    const base = apiBaseUrl ?? this.apiBaseUrl
    savePlayerIdentity(
      { playerId, apiBaseUrl: base },
      this.identityStorage === undefined ? undefined : this.identityStorage,
    )
  }

  /**
   * QA: follow current actor seat without persisting identity.
   * Reconnect socket when actor playerId changes.
   */
  private syncQaViewerToActor(): void {
    const state = this.snapshot.state
    if (!this.qaMode || state === null) {
      return
    }
    const actorSeat = actorSeatFromState(state, this.snapshot.legalActions)
    const actorPlayer = state.players.find((player) => player.seat === actorSeat)
    if (actorPlayer === undefined) {
      return
    }
    const needsReconnect =
      actorPlayer.playerId !== this.localPlayerId || this.socket === null
    this.localPlayerId = actorPlayer.playerId
    if (needsReconnect) {
      this.connectLocalSocket(actorPlayer.playerId)
    }
  }

  private connectLocalSocket(playerId: string): void {
    this.disconnectSocket()
    const url = this.resolveSocketUrl(this.apiBaseUrl, playerId)
    this.socket = this.connectSocket({
      url,
      handlers: {
        onPush: (payload) => {
          if (this.qaMode) {
            void this.refresh()
            return
          }
          this.applySocketPush(payload)
        },
      },
    })
  }

  private disconnectSocket(): void {
    this.socket?.close()
    this.socket = null
  }

  private publish(next: GameSessionSnapshot): void {
    this.snapshot = next
    for (const listener of this.listeners) {
      listener(next)
    }
  }

  private setLoading(loading: boolean): void {
    this.publish({ ...this.snapshot, loading, error: null })
  }

  private setError(message: string): void {
    this.publish({ ...this.snapshot, loading: false, error: message })
  }
}

function isGameExistsError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'GAME_EXISTS'
}

function isNoGameError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'NO_GAME' || error.status === 404)
  )
}

function isResumableStatus(status: GameState['status']): boolean {
  return status === 'waiting' || status === 'setup' || status === 'playing'
}

function playerIdInState(state: GameState, playerId: string): boolean {
  return state.players.some((player) => player.playerId === playerId)
}

/** Same pending-responder rules as turn banner (victim / battle stages). */
function actorSeatFromState(
  state: GameState,
  legalActions: readonly ActionSpec[],
): number {
  return buildTurnBannerViewModel(state, legalActions).actorSeat
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}
