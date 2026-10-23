import type { Game, LogEntry } from '@root/lib'
import type { GameRoom } from '#store/GameStore.js'

const MILLISECONDS_PER_SECOND = 1000

/** Phase ends: the turn banner already tells the step. */
const SILENT_ACTION_TYPES: ReadonlySet<string> = new Set<string>(['endPhase'])

export type BotStepDriverDependencies = {
  /** The slot whose bots this driver plays. */
  room: GameRoom
  wait: (milliseconds: number) => Promise<void>
  /** Save the slot and push it to viewers (a bot acted). */
  publishGameChange: (stepLog: readonly LogEntry[]) => void
  reportFailure: (error: unknown) => void
}

/** An action the game log shows: players get a pause to read it. */
function isWatchedLogEntry(entry: LogEntry): boolean {
  return entry.t === 'action' && !SILENT_ACTION_TYPES.has(entry.action.type)
}

function isBotAnswerPending(game: Game): boolean {
  return game.state.pending.length > 0 && game.botHasWork()
}

/**
 * Online games: bots play one action at a time, each pushed to the players,
 * then the host's pace (`room.botStepDelaySeconds`) before the next one.
 * Hotseat games keep resolving bot turns in one go.
 */
export class BotStepDriver {
  private playingGame: Game | null = null

  constructor(private readonly dependencies: BotStepDriverDependencies) {}

  /** After every change of the slot: pace the online game and play its bots. */
  handleGameChanged(): void {
    const room: GameRoom = this.dependencies.room
    const game: Game | null = room.game
    if (game === null || room.mode !== 'online') return
    game.setBotPacing(true)
    if (this.playingGame === game || !game.botHasWork()) return
    this.playingGame = game
    this.playBotSteps(game)
      .catch((error: unknown): void => {
        this.dependencies.reportFailure(error)
      })
      .finally((): void => {
        if (this.playingGame === game) this.playingGame = null
      })
  }

  private isStillPlaying(game: Game): boolean {
    return this.dependencies.room.game === game && game.botHasWork()
  }

  private async playBotSteps(game: Game): Promise<void> {
    let unshownLog: LogEntry[] = []
    while (this.isStillPlaying(game)) {
      const stepLog: LogEntry[] = game.stepBot().log
      unshownLog = [...unshownLog, ...stepLog]
      // A prompt a bot answers itself (a battle between bots) is never shown:
      // the step shows once it is answered.
      if (unshownLog.some(isWatchedLogEntry) && !isBotAnswerPending(game)) {
        this.dependencies.publishGameChange(unshownLog)
        unshownLog = []
        await this.dependencies.wait(
          this.dependencies.room.botStepDelaySeconds * MILLISECONDS_PER_SECOND,
        )
      }
    }
    if (this.dependencies.room.game === game && unshownLog.length > 0) {
      this.dependencies.publishGameChange(unshownLog)
    }
  }
}
