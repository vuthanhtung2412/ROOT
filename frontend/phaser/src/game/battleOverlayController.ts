import type { GameState } from '#api/client.ts'
import {
  battleResultFlashDurationMs,
  buildBattleOverlayViewModel,
  buildFinishedBattleOverlayViewModel,
  updateBattleTracker,
  type BattleTrackerState,
  type FinishedBattleOutcome,
} from '#game/battleOverlayModel.ts'
import type { BattleOverlay } from '#ui/BattleOverlay.ts'

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

  constructor(
    private readonly clock: BattleOverlaySyncClock,
    private readonly getOverlay: () => BattleOverlay | null,
    private readonly getState: () => GameState | null | undefined,
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
      return
    }
    const trackerUpdate = updateBattleTracker(this.battleTracker, state)
    this.battleTracker = trackerUpdate.tracker
    if (trackerUpdate.finishedOutcome !== null) {
      this.beginResultFlash(trackerUpdate.finishedOutcome)
    }
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
