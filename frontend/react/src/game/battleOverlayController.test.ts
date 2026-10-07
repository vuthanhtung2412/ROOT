import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '#api/client.ts'
import {
  BattleOverlayController,
  type BattleOverlaySyncTarget,
} from '#game/battleOverlayController.ts'
import {
  ZERO_HIT_BATTLE_MESSAGE,
  type BattleMark,
} from '#game/battleOverlayModel.ts'
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

  it('marks the battle clearing from the ambush step until the result leaves', () => {
    const marks: Array<BattleMark | null> = []
    const overlay: BattleOverlaySyncTarget = {
      sync: (): void => undefined,
      syncMark: (mark: BattleMark | null): void => {
        marks.push(mark)
      },
    }
    const battle = (stage: string, rolls?: [number, number]): unknown => ({
      type: 'battle',
      clearing: 3,
      stage,
      attacker: 0,
      defender: 1,
      rolls,
      hits: { attacker: 0, defender: 0 },
    })
    let state: GameState = makeState([battle('ambush')])
    const controller = new BattleOverlayController(
      { delayedCall: () => ({ remove: vi.fn() }) },
      () => overlay,
      () => state,
    )
    const expectedMark: BattleMark = {
      clearing: 3,
      attackerFaction: 'marquise',
      defenderFaction: 'eyrie',
    }

    // Ambush step: no battle panel yet, the clearing is marked already.
    controller.sync()
    expect(marks.at(-1)).toEqual(expectedMark)

    state = makeState([battle('removeDefender', [2, 1])])
    controller.sync()
    expect(marks.at(-1)).toEqual(expectedMark)

    // Battle over: the mark stays for as long as the result shows.
    state = makeState([])
    controller.sync()
    expect(controller.isResultFlashActive()).toBe(true)
    expect(marks.at(-1)).toEqual(expectedMark)

    controller.dismissResultFlash()
    expect(marks.at(-1)).toBeNull()
  })

  it('shows the result of a battle that opened and ended in one update', () => {
    const shown: Array<BattleOverlayViewModel | null> = []
    const overlay: BattleOverlaySyncTarget = {
      sync: (viewModel: BattleOverlayViewModel | null): void => {
        shown.push(viewModel)
      },
    }
    const state: GameState = makeState([])
    const earlierLog: unknown[] = [{ t: 'start' }]
    let log: unknown[] = earlierLog
    const controller = new BattleOverlayController(
      { delayedCall: () => ({ remove: vi.fn() }) },
      () => overlay,
      () => state,
      () => log,
    )

    controller.sync()
    expect(controller.isResultFlashActive()).toBe(false)

    // Nobody had a choice: the battle is only ever in the log, already over.
    log = [
      ...earlierLog,
      {
        t: 'event',
        event: {
          type: 'battle',
          clearing: 3,
          stage: 'removeAttacker',
          attacker: 0,
          defender: 1,
          rolls: [0, 0],
          hits: { attacker: 0, defender: 0 },
        },
      },
    ]
    controller.sync()

    expect(controller.isResultFlashActive()).toBe(true)
    expect(shown.at(-1)).toMatchObject({
      clearing: 3,
      rolls: [0, 0],
      hits: { attacker: 0, defender: 0 },
      outcomeMessage: ZERO_HIT_BATTLE_MESSAGE,
    })

    // The same log again is old news once the result was dismissed.
    controller.dismissResultFlash()
    controller.sync()
    expect(controller.isResultFlashActive()).toBe(false)
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
