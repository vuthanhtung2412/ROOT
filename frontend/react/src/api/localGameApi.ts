/**
 * In-browser game slot: the `GameApi` surface over a `lib` `Game` held in
 * memory. Solo mode plays against the bots with no server at all.
 */
import {
  formatGameView,
  formatTurnLog,
  FALL_LAYOUT,
  Game,
  RuleError,
  type Action,
  type FactionId,
  type GameSnapshot,
} from '@root/lib'
import {
  ApiError,
  isGameSnapshot as isApiGameSnapshot,
  parseFactionIds,
  parseGameState,
  type ActionResult,
  type CreateGameInput,
  type ExplainedActionsResponse,
  type FallLayout,
  type GameApi,
  type GameSnapshot as ApiGameSnapshot,
  type GameState,
  type LegalActionsResponse,
  type LobbyMode,
} from '@root/web-client/game-api'
import type {
  ConnectGameSocketOptions,
  GameSocketConnection,
  GameSocketHandlers,
} from '#api/gameSocket.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'

/** Saved solo game: survives a page reload. */
const SAVED_GAME_STORAGE_KEY = 'root.react.soloGame'
/** One device plays every human seat, like a hotseat server slot. */
const LOCAL_LOBBY_MODE: LobbyMode = 'hotseat'
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_NOT_FOUND = 404
const HTTP_STATUS_NOT_IMPLEMENTED = 501
const SEED_RANGE = 1_000_000_000

type LocalGameView = Awaited<ReturnType<GameApi['getGame']>>

export type LocalGame = {
  api: GameApi
  /** Stands in for the game WebSocket: pushes after every change. */
  connectSocket: (options: ConnectGameSocketOptions) => GameSocketConnection
  /** Put the saved game back in memory (page reload). False when none. */
  restoreSavedGame: () => boolean
}

function defaultStorage(): PlayerIdentityStorage | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  return localStorage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Engine actions are checked by `Game.apply`; only the shape is read here. */
function isEngineAction(value: unknown): value is Action {
  return isRecord(value) && typeof value.type === 'string'
}

/** Snapshot shape (state, history, log, rng); `Game.fromJSON` checks the rest. */
function isEngineSnapshot(value: unknown): value is GameSnapshot {
  return (
    isRecord(value) &&
    isRecord(value.state) &&
    Array.isArray(value.history) &&
    value.history.every(isEngineAction) &&
    Array.isArray(value.log) &&
    isRecord(value.rng) &&
    typeof value.rng.seed === 'number' &&
    typeof value.rng.cursor === 'number'
  )
}

function unsupported(feature: string): ApiError {
  return new ApiError(HTTP_STATUS_NOT_IMPLEMENTED, {
    code: 'LOCAL_UNSUPPORTED',
    detail: `${feature} needs the game server`,
  })
}

/** Engine rule errors read like the server's error bodies. */
function runEngine<Result>(work: () => Result): Result {
  try {
    return work()
  } catch (error: unknown) {
    if (error instanceof RuleError) {
      throw new ApiError(HTTP_STATUS_BAD_REQUEST, {
        code: error.code,
        detail: error.detail,
      })
    }
    throw error
  }
}

/** A detached copy: the UI never holds the engine's live objects. */
function stateCopy(game: Game): GameState {
  return parseGameState(structuredClone(game.state))
}

export function createLocalGame(
  storage: PlayerIdentityStorage | null = defaultStorage(),
): LocalGame {
  let game: Game | null = null
  const socketHandlers: Set<GameSocketHandlers> = new Set()

  const requireGame = (): Game => {
    if (game === null) {
      throw new ApiError(HTTP_STATUS_NOT_FOUND, {
        code: 'NO_GAME',
        detail: null,
      })
    }
    return game
  }

  const saveGame = (): void => {
    if (game === null) {
      storage?.removeItem(SAVED_GAME_STORAGE_KEY)
      return
    }
    storage?.setItem(SAVED_GAME_STORAGE_KEY, JSON.stringify(game.toJSON()))
  }

  /** Save, then wake every listener on the next tick, like a server push. */
  const publishChange = (): void => {
    saveGame()
    const changedGame: Game | null = game
    queueMicrotask((): void => {
      for (const handlers of socketHandlers) {
        handlers.onPush({
          state: changedGame === null ? null : stateCopy(changedGame),
          historyLength: changedGame?.history.length ?? 0,
          legalActions: changedGame?.legalActions() ?? [],
          log: changedGame === null ? [] : [...changedGame.log],
        })
      }
    })
  }

  const applyAction = (action: Action): ActionResult => {
    const engine: Game = requireGame()
    const result = runEngine(() => engine.apply(action))
    publishChange()
    return { state: stateCopy(engine), log: [...result.log] }
  }

  const replaceGame = (nextGame: Game): void => {
    game = nextGame
    publishChange()
  }

  const api: GameApi = {
    async createGame(
      input: CreateGameInput = {},
    ): Promise<{ state: GameState; mode: LobbyMode }> {
      const seed: number = Math.floor(Math.random() * SEED_RANGE)
      const factions: FactionId[] | undefined =
        input.factions === undefined ? undefined : parseFactionIds(input.factions)
      const created: Game = runEngine(() =>
        Game.create({
          seed,
          ...(factions === undefined ? {} : { factions }),
          ...(input.botSettings === undefined ? {} : { botSettings: input.botSettings }),
        }),
      )
      replaceGame(created)
      return { state: stateCopy(created), mode: LOCAL_LOBBY_MODE }
    },
    async join(playerId: string, faction?: string): Promise<ActionResult> {
      return applyAction({
        type: 'join',
        playerId,
        ...(faction === undefined ? {} : { faction: parseFactionIds([faction])[0]! }),
      })
    },
    async expelPlayer(): Promise<void> {
      throw unsupported('Expelling a player')
    },
    async start(): Promise<ActionResult> {
      return applyAction({ type: 'start' })
    },
    async getGame(): Promise<LocalGameView> {
      const engine: Game = requireGame()
      return {
        state: stateCopy(engine),
        historyLength: engine.history.length,
        mode: LOCAL_LOBBY_MODE,
        aiPlayers: [],
      }
    },
    async gameView(): Promise<string> {
      const engine: Game = requireGame()
      return formatGameView(engine.state, {
        historyLength: engine.history.length,
      })
    },
    async getSnapshot(): Promise<ApiGameSnapshot> {
      const snapshot: unknown = structuredClone(requireGame().toJSON())
      if (!isApiGameSnapshot(snapshot)) {
        throw new Error('invalid game snapshot')
      }
      return snapshot
    },
    async loadSnapshot(snapshot: unknown): Promise<{ state: GameState }> {
      if (!isEngineSnapshot(snapshot)) {
        throw new ApiError(HTTP_STATUS_BAD_REQUEST, {
          code: 'BAD_SNAPSHOT',
          detail: 'invalid snapshot shape',
        })
      }
      const loaded: Game = runEngine(() => Game.fromJSON(snapshot))
      replaceGame(loaded)
      return { state: stateCopy(loaded) }
    },
    async legalActions(): Promise<LegalActionsResponse> {
      return { actions: requireGame().legalActions() }
    },
    async explainedActions(): Promise<ExplainedActionsResponse> {
      throw unsupported('Explained actions')
    },
    async submitAction(action: unknown): Promise<ActionResult> {
      if (!isEngineAction(action)) {
        throw new ApiError(HTTP_STATUS_BAD_REQUEST, {
          code: 'BAD_ACTION',
          detail: 'invalid action shape',
        })
      }
      return applyAction(action)
    },
    async gameLog(): Promise<{ log: unknown[] }> {
      return { log: [...requireGame().log] }
    },
    async formattedGameLog(): Promise<string> {
      const engine: Game = requireGame()
      return formatTurnLog(engine.log, engine.state)
    },
    async undo(): Promise<{ state: GameState }> {
      const engine: Game = requireGame()
      runEngine(() => engine.undo())
      publishChange()
      return { state: stateCopy(engine) }
    },
    async undoTurnAction(): Promise<{ state: GameState }> {
      const engine: Game = requireGame()
      runEngine(() => engine.undoTurnAction())
      publishChange()
      return { state: stateCopy(engine) }
    },
    async fallLayout(): Promise<FallLayout> {
      return FALL_LAYOUT
    },
    async deleteGame(): Promise<void> {
      game = null
      publishChange()
    },
  }

  return {
    api,
    connectSocket(options: ConnectGameSocketOptions): GameSocketConnection {
      const handlers: GameSocketHandlers = options.handlers
      socketHandlers.add(handlers)
      return {
        close(): void {
          socketHandlers.delete(handlers)
        },
      }
    },
    restoreSavedGame(): boolean {
      const saved: string | null =
        storage?.getItem(SAVED_GAME_STORAGE_KEY) ?? null
      if (saved === null) {
        return false
      }
      const snapshot: unknown = JSON.parse(saved)
      if (!isEngineSnapshot(snapshot)) {
        storage?.removeItem(SAVED_GAME_STORAGE_KEY)
        return false
      }
      game = Game.fromJSON(snapshot)
      return true
    },
  }
}
