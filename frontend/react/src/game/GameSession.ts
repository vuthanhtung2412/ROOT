import type {
  ActionSpec,
  GameState,
  FrontendApiClient,
} from '#api/client.ts'
import { isBotFaction } from '@root/lib/bot-factions'
import type { BotSettingsByFaction } from '@root/lib/bot-settings'
import { ApiError } from '#api/client.ts'
import { setAiPlayers } from '#game/aiPlayerStore.ts'
import type { LobbyTableChange } from '#game/hudStore.ts'
import { setOnlineBotPace } from '#game/botPace.ts'
import { isBotStepDelaySeconds } from '@root/web-client/game-api'
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
  private connectSocket: (
    options: ConnectGameSocketOptions,
  ) => GameSocketConnection
  private readonly resolveSocketUrl: (
    apiBaseUrl: string,
    playerId: string,
  ) => string
  private readonly generatePlayerId: () => string
  private readonly listeners: Set<GameSessionListener> = new Set()
  private localPlayerId: string | null = null
  /** Code of the online room this browser is in; null outside one. */
  private roomCode: string | null = null
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

  /** The code the host shares so guests can join; null outside an online room. */
  getRoomCode(): string | null {
    return this.roomCode
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

  /**
   * Rebuild API client when menu sets a host IP, or switch to the in-browser
   * game (solo) with its own push source.
   */
  rebindApi(
    api: FrontendApiClient,
    apiBaseUrl: string,
    connectSocket: (
      options: ConnectGameSocketOptions,
    ) => GameSocketConnection = connectGameSocket,
  ): void {
    this.disconnectSocket()
    this.api = api
    this.apiBaseUrl = apiBaseUrl
    this.connectSocket = connectSocket
  }

  subscribe(listener: GameSessionListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  applySocketPush(payload: GameSocketPush): void {
    setAiPlayers(payload.aiPlayers ?? [])
    this.syncOnlineBotPace(payload.state, payload.botStepDelaySeconds)
    if (payload.roomCode !== undefined) {
      this.roomCode = payload.roomCode
    }
    if (payload.state === null) {
      this.roomCode = null
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
      // A browser may watch a waiting lobby before it picks a faction.
      payload.state.status !== 'waiting' &&
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
   * `snapshotToLoad` replaces the server slot first (QA snapshot autoload).
   */
  async continueQaLoadedGame(snapshotToLoad?: unknown): Promise<void> {
    this.qaMode = true
    if (snapshotToLoad !== undefined) {
      await this.api.loadSnapshot(snapshotToLoad)
    }
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

  /**
   * Create game: open a new online room with an open lobby (no faction
   * decided). The browser watches it; it takes a seat by picking a faction.
   */
  async createOnlineRoom(): Promise<boolean> {
    return this.enterOnlineRoomWith(async (): Promise<void> => {
      await this.api.createGame({ factions: [], mode: 'online' })
    })
  }

  /** Join with code: watch the lobby of the room the host shared. */
  async enterOnlineRoom(roomCode: string): Promise<boolean> {
    return this.enterOnlineRoomWith(async (): Promise<void> => {
      await this.api.enterRoom(roomCode.trim())
    })
  }

  private async enterOnlineRoomWith(
    openOrEnterRoom: () => Promise<void>,
  ): Promise<boolean> {
    this.setLoading(true)
    this.qaMode = false
    try {
      // Already seated (reload, or left to the menu earlier): same seat back.
      if (await this.resumeOnlineGame()) {
        return true
      }
      // Bound first: the server finds the room by the id the request carries.
      const playerId: string = this.generatePlayerId()
      this.bindLocalPlayer(playerId)
      await openOrEnterRoom()
      this.connectLocalSocket(playerId)
      const game = await this.api.getGame()
      this.roomCode = game.roomCode
      this.publish({
        state: game.state,
        legalActions: [],
        historyLength: game.historyLength,
        log: [],
        error: null,
        loading: false,
      })
      return true
    } catch (error: unknown) {
      this.localPlayerId = null
      clearPlayerIdentity(
        this.identityStorage === undefined ? undefined : this.identityStorage,
      )
      this.setError(errorMessage(error))
      return false
    }
  }

  /** Open lobby: take a seat with `faction`, or change the pick already made. */
  async pickLobbyFaction(faction: string): Promise<boolean> {
    const playerId: string | null = this.localPlayerId
    if (playerId === null) {
      this.setError('Enter the lobby first')
      return false
    }
    try {
      const joined = await this.api.join(playerId, faction)
      this.publish({
        ...this.snapshot,
        state: joined.state,
        error: null,
        loading: false,
      })
      return true
    } catch (error: unknown) {
      this.setError(errorMessage(error))
      return false
    }
  }

  /** Open lobby, host only: free the seat of a human or AI player. */
  async expelLobbyPlayer(seat: number): Promise<boolean> {
    try {
      await this.api.expelPlayer(seat)
      return true
    } catch (error: unknown) {
      this.setError(errorMessage(error))
      return false
    }
  }

  /**
   * Online co-op game: the server paces the bots; the host may change the
   * pace, guests see it. Anything else: the pace stays this browser's own.
   */
  private syncOnlineBotPace(state: GameState | null, delaySeconds: number | undefined): void {
    if (state?.cooperative !== true || state.status === 'waiting' || delaySeconds === undefined) {
      setOnlineBotPace(null)
      return
    }
    setOnlineBotPace({
      delaySeconds,
      canChange: this.isOnlineHost(),
      requestDelaySeconds: (seconds: number): void => {
        if (!isBotStepDelaySeconds(seconds)) return
        this.api.setBotPace(seconds).catch((error: unknown): void => {
          this.setError(errorMessage(error))
        })
      },
    })
  }

  /** Open lobby, host only: play mode, bots and their settings; the push redraws. */
  async changeLobbyTable(change: LobbyTableChange): Promise<boolean> {
    try {
      if (change.kind === 'setPlayMode') await this.api.setPlayMode(change.playMode)
      if (change.kind === 'addBot') await this.api.addBot(change.faction)
      if (change.kind === 'setBotSettings') {
        await this.api.setBotSettings(change.faction, change.settings)
      }
      return true
    } catch (error: unknown) {
      this.setError(errorMessage(error))
      return false
    }
  }

  /**
   * Leave the lobby screen. A watcher or a seated guest walks away (the server
   * frees the guest's seat, and ends the room when its creator leaves before
   * anyone sat); the host goes through restart, which closes the room.
   */
  async leaveOnlineLobby(): Promise<void> {
    if (this.snapshot.state === null || this.isOnlineHost()) {
      await this.restart()
      return
    }
    // The room forgets the browser; a failed call only leaves it listed until the room ends.
    await this.api.leaveRoom().catch((): void => undefined)
    this.disconnectSocket()
    clearPlayerIdentity(
      this.identityStorage === undefined ? undefined : this.identityStorage,
    )
    this.localPlayerId = null
    this.roomCode = null
    this.publish({
      state: null,
      legalActions: [],
      historyLength: 0,
      log: [],
      error: null,
      loading: false,
    })
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
      // The server answers from the stored id's room: seated there, or still
      // watching its lobby, the browser goes back in (one game per player).
      // A string, not just non-null: an older server sends no code at all.
      const isWatchingLobby: boolean =
        typeof game.roomCode === 'string' && game.state.status === 'waiting'
      if (
        game.mode === 'online' &&
        (playerIdInState(game.state, stored.playerId) || isWatchingLobby) &&
        isResumableStatus(game.state.status)
      ) {
        this.qaMode = false
        this.roomCode = game.roomCode
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

  /**
   * Local hotseat from menu: replace slot, join every seat, start.
   * Follows current actor like QA (one device, all roles).
   */
  async startLocalParty(
    factions: readonly string[],
    botSettings: BotSettingsByFaction = {},
  ): Promise<boolean> {
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
        botSettings,
      })
      for (const faction of factions) {
        // A bot seat takes its place by itself (Rootbotics 2.6).
        if (isBotFaction(faction)) continue
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
      setAiPlayers(game.aiPlayers)
      this.syncOnlineBotPace(game.state, game.botStepDelaySeconds)
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
    // Once the action goes through, the legal actions held here are those of
    // the state before it: offer none until the new state is pushed, or a
    // click in between sends an action that is no longer legal. Emptied before
    // the request, as the push of the new state can land before its response.
    const legalActionsBeforeSubmit: ActionSpec[] = this.snapshot.legalActions
    const noLegalActions: ActionSpec[] = []
    this.publish({
      ...this.snapshot,
      legalActions: noLegalActions,
      loading: true,
      error: null,
    })
    try {
      await this.api.submitAction(action)
      this.publish({ ...this.snapshot, loading: false, error: null })
    } catch (error: unknown) {
      // Rejected action: the state did not change, its legal actions still hold.
      if (this.snapshot.legalActions === noLegalActions) {
        this.publish({
          ...this.snapshot,
          legalActions: legalActionsBeforeSubmit,
        })
      }
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

  /** Take back the latest action of the current turn (server checks the seat). */
  async undoTurnAction(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.undoTurnAction()
      this.publish({
        ...this.snapshot,
        loading: false,
        error: null,
      })
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /**
   * Online: this browser holds a seat that is not the host's. A guest cannot
   * end the game; it can only leave it.
   */
  isOnlineGuest(): boolean {
    const localSeat = this.getLocalSeat()
    return !this.qaMode && localSeat !== null && localSeat !== ONLINE_HOST_SEAT
  }

  /**
   * End game: delete server slot, clear identity, close socket.
   * An online guest only leaves: the game goes on, the stored join id is kept
   * so "Join online game" or a reload takes the seat back.
   */
  async restart(): Promise<void> {
    if (this.isOnlineGuest()) {
      this.disconnectSocket()
      this.localPlayerId = null
      this.publish({
        state: null,
        legalActions: [],
        historyLength: 0,
        log: [],
        error: null,
        loading: false,
      })
      return
    }
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

const FRIENDLY_API_ERRORS: Readonly<Record<string, string>> = {
  NOT_HOST: 'An online game is running — only its host can end it',
  NOT_YOUR_SEAT: 'Not your seat',
  ROOM_NOT_FOUND: 'No online game has this code',
  ROOM_LIMIT: 'The server is full — try again later',
}

/** `ALREADY_IN_GAME` detail: the room the player must finish or leave first. */
function blockingRoomCodeOf(error: ApiError): string | null {
  const detail: unknown = error.detail
  const roomCode: unknown =
    typeof detail === 'object' && detail !== null ? Reflect.get(detail, 'roomCode') : null
  return typeof roomCode === 'string' ? roomCode : null
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'ALREADY_IN_GAME') {
    const roomCode: string | null = blockingRoomCodeOf(error)
    return roomCode === null
      ? 'You are already in an online game'
      : `You are already in online game ${roomCode} — finish or leave it first`
  }
  if (error instanceof ApiError) {
    return FRIENDLY_API_ERRORS[error.code] ?? error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}
