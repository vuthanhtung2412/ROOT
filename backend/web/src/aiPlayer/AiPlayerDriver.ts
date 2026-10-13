import type { Game, PlayerState } from '@root/lib'
import {
  buildAiPlayerSystemPrompt,
  buildReactionMessage,
  buildResumeMessage,
  buildTurnStartMessage,
} from '#aiPlayer/aiPlayerPrompt.js'
import type {
  AiPlayerSeatActivity,
  AiPlayerSessionActivity,
} from '#aiPlayer/AiPlayerActivityFeed.js'
import { AI_PLAYER_TOOL_DEFINITIONS } from '#aiPlayer/aiPlayerTools.js'
import { AiPlayerSession } from '#aiPlayer/AiPlayerSession.js'
import {
  parseModelIdentifier,
  type ModelProviderName,
} from '#aiPlayer/modelIdentifier.js'
import type { ModelProvider } from '#aiPlayer/ModelProvider.js'
import type { RuleSection } from '#aiPlayer/rulebook.js'
import {
  store,
  type AiPlayerSeat,
  type AiPlayerStatus,
} from '#store/GameStore.js'
import { listPlayerLegalActions } from '#view/playerView.js'

export type AiPlayerDriverDependencies = {
  /** Null when the server cannot reach that provider (no API key). */
  createProvider: (providerName: ModelProviderName) => ModelProvider | null
  loadRulebook: () => readonly RuleSection[]
  wait: (milliseconds: number) => Promise<void>
  /** Save the slot and push it to viewers (an AI seat acted). */
  publishGameChange: () => void
  /** Push the slot to viewers (an AI seat changed status). */
  publishStatusChange: () => void
  /** Show observers what an AI seat is doing (message, reply, tool call). */
  publishActivity: (activity: AiPlayerSeatActivity) => void
}

const NO_USABLE_MODEL_FAILURE = 'no usable model'

function failureActivity(reason: string): AiPlayerSessionActivity {
  return { kind: 'failure', toolName: null, text: reason, isError: true }
}

/** The game turn a session plays, or null for one off-turn decision. */
type SessionScope = number | null

type ActiveSession = {
  session: AiPlayerSession
  scope: SessionScope
  abortController: AbortController
  /** Reports an activity of this session under its seat and model. */
  reportActivity: (activity: AiPlayerSessionActivity) => void
}

/**
 * Plays the AI seats of the game in the store. One session (= one context
 * window) per AI turn: opened when the turn reaches the seat, continued after
 * another seat answers, dropped when the turn passes on. A decision an AI seat
 * owes outside its turn (ambush, setup choice) gets a short session of its own.
 */
export class AiPlayerDriver {
  private readonly dependencies: AiPlayerDriverDependencies
  private readonly providers = new Map<ModelProviderName, ModelProvider | null>()
  private readonly sessions = new Map<string, ActiveSession>()
  /** Sessions whose model is working right now. */
  private readonly runningSessions = new Set<ActiveSession>()
  private readonly stuckPlayerIds = new Set<string>()
  private observedGame: Game | null = null
  private observedHistoryLength = 0

  constructor(dependencies: AiPlayerDriverDependencies) {
    this.dependencies = dependencies
  }

  /** Call after every change of the game slot. */
  handleGameChanged(): void {
    const game = store.game
    const wasRewound =
      game !== this.observedGame ||
      (game !== null && game.history.length < this.observedHistoryLength)
    if (wasRewound) {
      // Undo or a new game: what the sessions know no longer holds.
      this.dropAllSessions()
    }
    this.observedGame = game
    this.observedHistoryLength = game?.history.length ?? 0
    if (game !== null) {
      for (const seat of store.aiPlayers) {
        this.advanceSeat(game, seat)
      }
    }
    this.publishStatuses()
  }

  /**
   * Drop the seat's session and start a fresh one from the current game
   * state. False when no AI player sits at that seat.
   */
  restart(seat: number): boolean {
    const game = store.game
    const player = game?.state.players.find(
      (candidate: PlayerState): boolean => candidate.seat === seat,
    )
    const isAiSeat = store.aiPlayers.some(
      (aiSeat: AiPlayerSeat): boolean => aiSeat.playerId === player?.playerId,
    )
    if (player === undefined || !isAiSeat) {
      return false
    }
    this.dropSession(player.playerId)
    this.handleGameChanged()
    return true
  }

  private advanceSeat(game: Game, seat: AiPlayerSeat): void {
    const player = game.state.players.find(
      (candidate: PlayerState): boolean => candidate.playerId === seat.playerId,
    )
    if (player === undefined) {
      return
    }
    const scope = this.currentScope(game, player)
    const mayAct = listPlayerLegalActions(game, seat.playerId).length > 0
    const active = this.sessions.get(seat.playerId)
    if (active !== undefined && this.runningSessions.has(active)) {
      return
    }
    if (active !== undefined && (active.scope !== scope || !this.isOpen(scope, mayAct))) {
      this.sessions.delete(seat.playerId)
    }
    if (!mayAct || this.stuckPlayerIds.has(seat.playerId)) {
      return
    }
    const continued = this.sessions.get(seat.playerId)
    if (continued !== undefined) {
      this.run(seat.playerId, continued, buildResumeMessage())
      return
    }
    const opened = this.openSession(game, player, seat)
    if (opened === null) {
      this.stuckPlayerIds.add(seat.playerId)
      return
    }
    this.sessions.set(seat.playerId, opened)
    this.run(
      seat.playerId,
      opened,
      scope === null ? buildReactionMessage() : buildTurnStartMessage(scope),
    )
  }

  private currentScope(game: Game, player: PlayerState): SessionScope {
    const isOwnTurn =
      game.state.status === 'playing' && game.state.currentSeat === player.seat
    return isOwnTurn ? game.state.turn : null
  }

  /** A turn session stays open all turn; a decision session only while owed. */
  private isOpen(scope: SessionScope, mayAct: boolean): boolean {
    return scope !== null || mayAct
  }

  private openSession(
    game: Game,
    player: PlayerState,
    seat: AiPlayerSeat,
  ): ActiveSession | null {
    const reportActivity = (activity: AiPlayerSessionActivity): void => {
      this.dependencies.publishActivity({
        ...activity,
        seat: player.seat,
        model: seat.model,
      })
    }
    const model = parseModelIdentifier(seat.model)
    const provider = model === null ? null : this.providerFor(model.provider)
    if (model === null || provider === null) {
      console.error(`AI player: no usable model for "${seat.model}"`)
      reportActivity(failureActivity(NO_USABLE_MODEL_FAILURE))
      return null
    }
    const scope = this.currentScope(game, player)
    const abortController = new AbortController()
    const session = new AiPlayerSession({
      conversation: provider.startConversation({
        modelId: model.modelId,
        systemPrompt: buildAiPlayerSystemPrompt({
          seat: player.seat,
          faction: player.faction,
        }),
        tools: AI_PLAYER_TOOL_DEFINITIONS,
      }),
      toolContext: {
        game,
        playerId: seat.playerId,
        rulebook: this.dependencies.loadRulebook(),
        onGameChanged: (): void => {
          this.dependencies.publishGameChange()
          this.handleGameChanged()
        },
      },
      abortSignal: abortController.signal,
      wait: this.dependencies.wait,
      isInScope: (): boolean => this.currentScope(game, player) === scope,
      onActivity: reportActivity,
    })
    return { session, scope, abortController, reportActivity }
  }

  private providerFor(providerName: ModelProviderName): ModelProvider | null {
    const known = this.providers.get(providerName)
    if (known !== undefined) {
      return known
    }
    const created = this.dependencies.createProvider(providerName)
    this.providers.set(providerName, created)
    return created
  }

  private run(playerId: string, active: ActiveSession, message: string): void {
    const settle = (failure: Error | null): void => {
      this.runningSessions.delete(active)
      // An aborted session was replaced or dropped: its outcome means nothing.
      if (active.abortController.signal.aborted) {
        return
      }
      if (failure !== null) {
        console.error(`AI player session failed: ${failure.message}`)
        active.reportActivity(failureActivity(failure.message))
        this.sessions.delete(playerId)
        this.stuckPlayerIds.add(playerId)
      }
      this.handleGameChanged()
    }
    this.runningSessions.add(active)
    active.session.play(message).then(
      (): void => settle(null),
      (error: Error): void => settle(error),
    )
  }

  private dropSession(playerId: string): void {
    this.sessions.get(playerId)?.abortController.abort()
    this.sessions.delete(playerId)
    this.stuckPlayerIds.delete(playerId)
  }

  private dropAllSessions(): void {
    for (const playerId of [...this.sessions.keys(), ...this.stuckPlayerIds]) {
      this.dropSession(playerId)
    }
  }

  private statusOf(playerId: string): AiPlayerStatus {
    if (this.stuckPlayerIds.has(playerId)) {
      return 'stuck'
    }
    const active = this.sessions.get(playerId)
    return active !== undefined && this.runningSessions.has(active)
      ? 'thinking'
      : 'idle'
  }

  private publishStatuses(): void {
    const updated = store.aiPlayers.map(
      (seat: AiPlayerSeat): AiPlayerSeat => ({
        ...seat,
        status: this.statusOf(seat.playerId),
      }),
    )
    const hasChanged = updated.some(
      (seat: AiPlayerSeat, index: number): boolean =>
        seat.status !== store.aiPlayers[index]?.status,
    )
    if (hasChanged) {
      store.aiPlayers = updated
      this.dependencies.publishStatusChange()
    }
  }
}
