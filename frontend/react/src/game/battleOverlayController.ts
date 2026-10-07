import type { GameState } from '#api/client.ts'
import { logEntriesAddedSince } from '#game/boardEffects.ts'
import {
  battleResultFlashDurationMs,
  buildBattleMark,
  type BattleMark,
  buildBattleOverlayViewModel,
  buildFinishedBattleOverlayViewModel,
  finishedBattleOutcomeFromLog,
  hasPendingBattle,
  updateBattleTracker,
  type BattleTrackerState,
  type FinishedBattleOutcome,
} from '#game/battleOverlayModel.ts'
import type { BattleOverlayViewModel } from '#ui/BattleOverlay.ts'

export type BattleOverlaySyncTarget = {
  sync: (viewModel: BattleOverlayViewModel | null) => void
  /** The two sides shown on the battle clearing; null when no battle is on. */
  syncMark?: (mark: BattleMark | null) => void
}

export type BattleOverlaySyncClock = {
  delayedCall: (
    delayMs: number,
    callback: () => void,
  ) => { remove: (dispatchCallback?: boolean) => void }
}

/**
 * Keeps battle overlay + post-battle result flash in sync with snapshot.
 */
export class BattleOverlayController {
  private battleTracker: BattleTrackerState | null = null
  private resultFlashOutcome: FinishedBattleOutcome | null = null
  private resultFlashTimer: { remove: (dispatchCallback?: boolean) => void } | null =
    null
  private onResultFlashEnded: (() => void) | null = null
  /** Length of the game log at the last sync: later entries are new. */
  private seenLogLength = 0

  constructor(
    private readonly clock: BattleOverlaySyncClock,
    private readonly getOverlay: () => BattleOverlaySyncTarget | null,
    private readonly getState: () => GameState | null | undefined,
    private readonly getLog: () => readonly unknown[] = () => [],
  ) {}

  setOnResultFlashEnded(callback: (() => void) | null): void {
    this.onResultFlashEnded = callback
  }

  isResultFlashActive(): boolean {
    return this.resultFlashOutcome !== null
  }

  /** End post-battle banner early (outside click). No-op if flash inactive. */
  dismissResultFlash(): void {
    if (this.resultFlashOutcome === null) {
      return
    }
    this.endResultFlash()
  }

  sync(prompt: string | null = null): void {
    const overlay = this.getOverlay()
    const state = this.getState()
    if (state === null || state === undefined) {
      overlay?.sync(null)
      overlay?.syncMark?.(null)
      return
    }
    const previousTracker = this.battleTracker
    const trackerUpdate = updateBattleTracker(previousTracker, state)
    this.battleTracker = trackerUpdate.tracker
    const log = this.getLog()
    const finishedOutcome =
      trackerUpdate.finishedOutcome ??
      (hasPendingBattle(state)
        ? null
        : this.finishedOutcomeFromLog(previousTracker, log))
    this.seenLogLength = log.length
    if (finishedOutcome !== null) {
      this.beginResultFlash(finishedOutcome)
    }
    // The clearing wears the two sides from the first step of the battle
    // (ambush included) until its result leaves the screen.
    const markedBattle = this.resultFlashOutcome ?? this.battleTracker
    overlay?.syncMark?.(
      markedBattle === null ? null : buildBattleMark(state, markedBattle),
    )
    if (this.resultFlashOutcome !== null) {
      overlay?.sync(
        buildFinishedBattleOverlayViewModel(state, this.resultFlashOutcome),
      )
      return
    }
    overlay?.sync(buildBattleOverlayViewModel(state, prompt))
  }

  destroy(): void {
    this.resultFlashTimer?.remove(false)
    this.resultFlashTimer = null
    this.resultFlashOutcome = null
    this.battleTracker = null
    this.onResultFlashEnded = null
  }

  /**
   * A battle whose dice were never pending here still ended: read it from the
   * log, so its result shows as long as any other (a 0–0 battle included).
   * Tracked without dice (seen in ambush only): the whole log, same battle.
   * Never tracked (opened and ended in one update): the entries just added.
   */
  private finishedOutcomeFromLog(
    previousTracker: BattleTrackerState | null,
    log: readonly unknown[],
  ): FinishedBattleOutcome | null {
    if (previousTracker === null) {
      return finishedBattleOutcomeFromLog(
        logEntriesAddedSince(this.seenLogLength, log),
      )
    }
    const outcome = finishedBattleOutcomeFromLog(log)
    const sameBattle =
      outcome !== null &&
      outcome.clearing === previousTracker.clearing &&
      outcome.attacker === previousTracker.attacker &&
      outcome.defender === previousTracker.defender
    return sameBattle ? outcome : null
  }

  private beginResultFlash(outcome: FinishedBattleOutcome): void {
    this.resultFlashOutcome = outcome
    this.resultFlashTimer?.remove(false)
    this.resultFlashTimer = this.clock.delayedCall(
      battleResultFlashDurationMs(),
      () => {
        this.endResultFlash()
      },
    )
  }

  private endResultFlash(): void {
    this.resultFlashTimer?.remove(false)
    this.resultFlashTimer = null
    this.resultFlashOutcome = null
    this.sync()
    this.onResultFlashEnded?.()
  }
}
