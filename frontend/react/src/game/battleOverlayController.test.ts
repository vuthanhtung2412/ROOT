import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '#api/client.ts'
import {
  BattleOverlayController,
  type BattleOverlaySyncTarget,
} from '#game/battleOverlayController.ts'
import type { BattleOverlayViewModel } from '#ui/BattleOverlay.ts'

function makeState(pending: unknown[]): GameState {
  return {
    id: 'g',
    seed: 1,
    status: 'playing',
    turn: 1,
    currentSeat: 1,
    phase: 'daylight',
    step: 'decree',
    factions: ['marquise', 'eyrie'],
    players: [
      { playerId: 'm', seat: 0, faction: 'marquise', vp: 0, hand: [] },
      { playerId: 'e', seat: 1, faction: 'eyrie', vp: 0, hand: [] },
    ],
    clearings: [],
    pending,
  }
}

describe('BattleOverlayController', () => {
  it('dismissResultFlash clears post-battle banner before timer', () => {
    const timers: Array<{
      callback: () => void
      remove: ReturnType<typeof vi.fn>
    }> = []
    const overlaySync = vi.fn()
    const overlay: BattleOverlaySyncTarget = {
      sync: (viewModel: BattleOverlayViewModel | null): void => {
        overlaySync(viewModel)
      },
    }
    let state: GameState = makeState([
      {
        type: 'battle',
        clearing: 3,
        stage: 'removeDefender',
        attacker: 0,
        defender: 1,
        rolls: [2, 1],
        hits: { attacker: 1, defender: 0 },
      },
    ])

    const controller = new BattleOverlayController(
      {
        delayedCall: (delayMs, callback) => {
          const remove = vi.fn()
          timers.push({ callback, remove })
          expect(delayMs).toBeGreaterThan(0)
          return { remove }
        },
      },
      () => overlay,
      () => state,
    )
    const onEnded = vi.fn()
    controller.setOnResultFlashEnded(onEnded)

    controller.sync()
    state = makeState([])
    controller.sync()

    expect(controller.isResultFlashActive()).toBe(true)
    expect(overlaySync).toHaveBeenCalledWith(
      expect.objectContaining({ outcomeMessage: expect.any(String) }),
    )

    controller.dismissResultFlash()

    expect(controller.isResultFlashActive()).toBe(false)
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(overlaySync).toHaveBeenLastCalledWith(null)
    expect(timers[0]?.remove).toHaveBeenCalledWith(false)
  })

  it('dismissResultFlash no-ops when flash inactive', () => {
    const controller = new BattleOverlayController(
      {
        delayedCall: () => ({ remove: vi.fn() }),
      },
      () => null,
      () => null,
    )
    const onEnded = vi.fn()
    controller.setOnResultFlashEnded(onEnded)

    controller.dismissResultFlash()

    expect(onEnded).not.toHaveBeenCalled()
  })
})
