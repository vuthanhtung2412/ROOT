import type {
  ActionSpec,
  GameState,
  PhaserApiClient,
} from '../api/client.ts'

export type GameSessionSnapshot = {
  state: GameState | null
  legalActions: ActionSpec[]
  historyLength: number
  log: unknown[]
  error: string | null
  loading: boolean
}

export type GameSessionListener = (snapshot: GameSessionSnapshot) => void

export type StartHotSeatGameInput = {
  factions: string[]
  playerIds: string[]
}

/**
 * Client-side GP2 session: refresh after create / action / undo.
 * Phaser never mutates engine state — only reads + submits Actions.
 */
export class GameSession {
  private readonly api: PhaserApiClient
  private readonly listeners: Set<GameSessionListener> = new Set()
  private snapshot: GameSessionSnapshot = {
    state: null,
    legalActions: [],
    historyLength: 0,
    log: [],
    error: null,
    loading: false,
  }

  constructor(api: PhaserApiClient) {
    this.api = api
  }

  getSnapshot(): GameSessionSnapshot {
    return this.snapshot
  }

  subscribe(listener: GameSessionListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
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

  /** Create GP2 lobby, join seats, start — then refresh. */
  async startHotSeatGame(input: StartHotSeatGameInput): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.createGame({
        factions: input.factions,
        replace: true,
      })
      for (const playerId of input.playerIds) {
        await this.api.join(playerId)
      }
      await this.api.start()
      await this.refreshAfterMutation()
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  async submitAction(action: unknown): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.submitAction(action)
      await this.refreshAfterMutation()
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  async undo(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.undo()
      await this.refreshAfterMutation()
    } catch (error: unknown) {
      this.setError(errorMessage(error))
    }
  }

  /** Restart: delete server game and clear local snapshot. */
  async restart(): Promise<void> {
    this.setLoading(true)
    try {
      await this.api.deleteGame()
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

  private async refreshAfterMutation(): Promise<void> {
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
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}
