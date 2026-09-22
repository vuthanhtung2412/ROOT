import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { canMove } from '#queries/move.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { card, minimalState, player, withPieces } from '#test/fixtures.js'

describe('Boat Builders', () => {
  it('Rule: Boat Builders — rivers count as paths for owner', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { playArea: [card('ROOT-57')] }),
          player(1, 'marquise'),
        ],
      }),
      3,
      [{ id: 'w0', kind: 'warrior', owner: 0 }],
    )
    const hooks = buildRuleHooks(state, FALL)
    expect(FALL.isAdjacent(3, 6)).toBe(false)
    expect(canMove(state, { seat: 0, from: 3, to: 6 }, hooks)).toBe(true)
  })
})
