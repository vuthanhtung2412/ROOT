import type { GameState } from '#api/client.ts'
import {
  buildBattleOverlayViewModel,
  buildZeroHitBattleOverlayViewModel,
  updateBattleTracker,
  zeroHitFlashDurationMs,
  type BattleTrackerState,
  type ZeroHitBattleOutcome,
} from '#game/battleOverlayModel.ts'
import type { BattleOverlay } from '#ui/BattleOverlay.ts'

export type BattleOverlaySyncClock = {
  delayedCall: (
    delayMs: number,
    callback: () => void,
  ) => { remove: (dispatchCallback?: boolean) => void }
}

/**
 * Keeps battle overlay + zero-hit flash in sync with snapshot pending.
 */
export class BattleOverlayController {
  private battleTracker: BattleTrackerState | null = null
  private zeroHitFlashOutcome: ZeroHitBattleOutcome | null = null
  private zeroHitFlashTimer: { remove: (dispatchCallback?: boolean) => void } | null =
    null

  constructor(
    private readonly clock: BattleOverlaySyncClock,
    private readonly getOverlay: () => BattleOverlay | null,
    private readonly getState: () => GameState | null | undefined,
  ) {}

  sync(prompt: string | null = null): void {
    const overlay = this.getOverlay()
    const state = this.getState()
    if (state === null || state === undefined) {
      overlay?.sync(null)
      return
    }
    const trackerUpdate = updateBattleTracker(this.battleTracker, state)
    this.battleTracker = trackerUpdate.tracker
    if (trackerUpdate.zeroHitOutcome !== null) {
      this.beginZeroHitFlash(trackerUpdate.zeroHitOutcome)
    }
    if (this.zeroHitFlashOutcome !== null) {
      overlay?.sync(
        buildZeroHitBattleOverlayViewModel(state, this.zeroHitFlashOutcome),
      )
      return
    }
    overlay?.sync(buildBattleOverlayViewModel(state, prompt))
  }

  destroy(): void {
    this.zeroHitFlashTimer?.remove(false)
    this.zeroHitFlashTimer = null
    this.zeroHitFlashOutcome = null
    this.battleTracker = null
  }

  private beginZeroHitFlash(outcome: ZeroHitBattleOutcome): void {
    this.zeroHitFlashOutcome = outcome
    this.zeroHitFlashTimer?.remove(false)
    this.zeroHitFlashTimer = this.clock.delayedCall(
      zeroHitFlashDurationMs(),
      () => {
        this.zeroHitFlashOutcome = null
        this.zeroHitFlashTimer = null
        this.sync()
      },
    )
  }
}
