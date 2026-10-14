import { describe, expect, it } from 'vitest'
import {
  controlMargin,
  suggestWoodClearings,
} from '#factions/marquise/woodPayment.js'
import type { ClearingId } from '#map/types.js'
import { FALL } from '#map/fall.js'
import { minimalState, player, withPieces } from '#test/fixtures.js'
import { defaultRuleHooks } from '#triggers/hooks.js'
import type { Ctx } from '#game/ctx.js'

const MARQUISE_SEAT = 0
const EYRIE_SEAT = 1

function silentContext(): Ctx {
  return {
    map: FALL,
    hooks: defaultRuleHooks(FALL),
    emit: (): void => {},
    rng: {
      roll: (): 0 => 0,
      toJSON: () => ({ seed: 0, cursor: 0 }),
    },
    grantedActions: () => [],
  }
}

describe('suggestWoodClearings', () => {
  it('greedily spends wood from lowest control margin clearings', () => {
    const available: ClearingId[] = [4, 4, 5, 7, 7]
    const marginByClearing = new Map<ClearingId, number>([
      [4, 2],
      [5, -1],
      [7, 0],
    ])
    expect(
      suggestWoodClearings({
        availableWoodClearings: available,
        amount: 3,
        marginForClearing: (clearing: ClearingId): number =>
          marginByClearing.get(clearing) ?? 0,
      }),
    ).toEqual([5, 7, 7])
  })

  it('returns empty when cost is zero', () => {
    expect(
      suggestWoodClearings({
        availableWoodClearings: [4, 5],
        amount: 0,
        marginForClearing: (): number => 0,
      }),
    ).toEqual([])
  })
})

describe('controlMargin', () => {
  it('is own rule strength minus the strongest other seat', () => {
    const state = withPieces(
      minimalState({
        players: [player(MARQUISE_SEAT, 'marquise'), player(EYRIE_SEAT, 'eyrie')],
      }),
      4,
      [
        { id: 'cat-w1', kind: 'warrior', owner: MARQUISE_SEAT },
        { id: 'cat-w2', kind: 'warrior', owner: MARQUISE_SEAT },
        { id: 'cat-saw', kind: 'building', owner: MARQUISE_SEAT, type: 'sawmill' },
        { id: 'bird-w1', kind: 'warrior', owner: EYRIE_SEAT },
      ],
    )
    // Marquise 3 − Eyrie 1 = 2
    expect(controlMargin(state, 4, MARQUISE_SEAT, silentContext())).toBe(2)
  })
})
