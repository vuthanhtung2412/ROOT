import type {
  ActionSpec,
  GameState,
  PhaserApiClient,
} from '../api/client.ts'
import {
  connectGameSocket,
  resolveWebSocketUrl,
  type ConnectGameSocketOptions,
  type GameSocketConnection,
  type GameSocketPush,
} from '../api/gameSocket.ts'
import {
  clearPlayerIdentity,
  loadPlayerIdentity,
  savePlayerIdentity,
  type PlayerIdentityStorage,
  type StoredPlayerIdentity,
} from './playerIdentity.ts'

export type GameSessionSnapshot = {
  state: GameState | null
  legalActions: ActionSpec[]
  historyLength: number
  log: unknown[]
  error: string | null
  loading: boolean
}

export type GameSessionListener = (snapshot: GameSessionSnapshot) => void

export type HostGameInput = {
  playerId: string
  factions?: string[]
}

export type JoinGameInput = {
  playerId: string
}

export type GameSessionDependencies = {
  api: PhaserApiClient
  apiBaseUrl?: string
  identityStorage?: PlayerIdentityStorage | null
  connectSocket?: (options: ConnectGameSocketOptions) => GameSocketConnection
  resolveSocketUrl?: (apiBaseUrl: string, playerId: string) => string
}

/**
 * Client-side GP2 session for remote two-machine play.
 * Commands via REST; UI state from redacted WebSocket pushes.
 */
export class GameSession {
  private api: PhaserApiClient
  private apiBaseUrl: string
  private readonly identityStorage: PlayerIdentityStorage | null | undefined
  private readonly connectSocket: (
    options: ConnectGameSocketOptions,
  ) => GameSocketConnection
  private readonly resolveSocketUrl: (
    apiBaseUrl: string,
    playerId: string,
  ) => string
  private readonly listeners: Set<GameSessionListener> = new Set()
  private localPlayerId: string | null = null
  private socket: GameSocketConnection | null = null
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
  rebindApi(api: PhaserApiClient, apiBaseUrl: string): void {
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

  /** Host: create lobby (no replace), join self, persist id, open WS. */
  async hostGame(input: HostGameInput): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.createGame({
        factions: input.factions ?? ['marquise', 'eyrie'],
      })
      await this.api.join(input.playerId)
      this.bindLocalPlayer(input.playerId)
      this.connectLocalSocket(input.playerId)
      this.publish({
        ...this.snapshot,
        loading: false,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /** Guest: join lobby, persist id, open WS. */
  async joinGame(input: JoinGameInput): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.join(input.playerId)
      this.bindLocalPlayer(input.playerId)
      this.connectLocalSocket(input.playerId)
      this.publish({
        ...this.snapshot,
        loading: false,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /** Either side: start when lobby has enough players. */
  async startLobby(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.start()
      this.publish({
        ...this.snapshot,
        loading: false,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /**
   * Continue: restore stored playerId, open WS, map to seat.
   * Unknown id → error (no new join).
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

  /** QA-only: poll full slot via REST (hands unredacted — local dump playtest). */
  async continueQaLoadedGame(): Promise<void> {
    await this.refresh()
  }

  async refresh(): Promise<void> {
    this.setLoading(true)
    try {
      const [game, legal, logResponse] = await Promise.all([
        this.api.getGame(),
        this.api.legalActions(),
        this.api.gameLog(),
      ])
      this.publish({
        state: game.state,
        legalActions: legal.actions,
        historyLength: game.historyLength,
        log: logResponse.log,
        error: null,
        loading: false,
      })
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

  private localSeatMayAct(): boolean {
    const localSeat = this.getLocalSeat()
    const state = this.snapshot.state
    if (localSeat === null || state === null) {
      return false
    }
    return localSeat === actorSeatFromState(state)
  }

  private bindLocalPlayer(playerId: string, apiBaseUrl?: string): void {
    this.localPlayerId = playerId
    const base = apiBaseUrl ?? this.apiBaseUrl
    savePlayerIdentity(
      { playerId, apiBaseUrl: base },
      this.identityStorage === undefined ? undefined : this.identityStorage,
    )
  }

  private connectLocalSocket(playerId: string): void {
    this.disconnectSocket()
    const url = this.resolveSocketUrl(this.apiBaseUrl, playerId)
    this.socket = this.connectSocket({
      url,
      handlers: {
        onPush: (payload) => {
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

function playerIdInState(state: GameState, playerId: string): boolean {
  return state.players.some((player) => player.playerId === playerId)
}

function actorSeatFromState(state: GameState): number {
  const pending = state.pending
  if (Array.isArray(pending) && pending.length > 0) {
    const head = pending[0]
    if (
      typeof head === 'object' &&
      head !== null &&
      'actor' in head &&
      typeof head.actor === 'number'
    ) {
      return head.actor
    }
  }
  return state.currentSeat
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}
