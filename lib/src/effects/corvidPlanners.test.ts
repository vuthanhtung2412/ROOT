import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { canMove } from '#queries/move.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { card, minimalState, player, withPieces } from '#test/fixtures.js'

describe('Corvid Planners', () => {
  it('Rule: Corvid Planners — while moving, ignore rule', () => {
    // Path 1–5; enemy rules both ends so mover lacks rule without the card.
    const state = withPieces(
      withPieces(
        minimalState({
          players: [
            player(0, 'marquise', { playArea: [card('ROOT-64')] }),
            player(1, 'marquise'),
          ],
        }),
        1,
        [
          { id: 'w0', kind: 'warrior', owner: 0 },
          { id: 'w1a', kind: 'warrior', owner: 1 },
          { id: 'w1b', kind: 'warrior', owner: 1 },
        ],
      ),
      5,
      [
        { id: 'w1c', kind: 'warrior', owner: 1 },
        { id: 'w1d', kind: 'warrior', owner: 1 },
      ],
    )
    const hooks = buildRuleHooks(state, FALL)
    expect(FALL.isAdjacent(1, 5)).toBe(true)
    expect(canMove(state, { seat: 0, from: 1, to: 5 }, hooks)).toBe(true)
  })

  it('Rule: Corvid Planners — without card, still need rule', () => {
    const state = withPieces(
      withPieces(
        minimalState({
          players: [player(0, 'marquise'), player(1, 'marquise')],
        }),
        1,
        [
          { id: 'w0', kind: 'warrior', owner: 0 },
          { id: 'w1a', kind: 'warrior', owner: 1 },
          { id: 'w1b', kind: 'warrior', owner: 1 },
        ],
      ),
      5,
      [
        { id: 'w1c', kind: 'warrior', owner: 1 },
        { id: 'w1d', kind: 'warrior', owner: 1 },
      ],
    )
    const hooks = buildRuleHooks(state, FALL)
    expect(canMove(state, { seat: 0, from: 1, to: 5 }, hooks)).toBe(false)
  })
})