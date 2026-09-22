import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { canMove } from '#queries/move.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { card, minimalState, player, withPieces } from '#test/fixtures.js'

describe('Tunnels', () => {
  it('Rule: Tunnels — clearings with crafting pieces count as adjacent', () => {
    // Clearings 0 and 2 are not path-adjacent; both have owner workshops + warriors.
    expect(FALL.isAdjacent(0, 2)).toBe(false)
    const state = withPieces(
      withPieces(
        minimalState({
          players: [
            player(0, 'marquise', { playArea: [card('ROOT-108')] }),
            player(1, 'marquise'),
          ],
        }),
        0,
        [
          { id: 'w0', kind: 'warrior', owner: 0 },
          { id: 'ws0', kind: 'building', owner: 0, type: 'workshop', used: false },
        ],
      ),
      2,
      [
        { id: 'w2', kind: 'warrior', owner: 0 },
        { id: 'ws2', kind: 'building', owner: 0, type: 'workshop', used: false },
      ],
    )
    const hooks = buildRuleHooks(state, FALL)
    expect(canMove(state, { seat: 0, from: 0, to: 2 }, hooks)).toBe(true)
  })

  it('Rule: Tunnels — without crafting piece at destination, no tunnel', () => {
    const state = withPieces(
      withPieces(
        minimalState({
          players: [
            player(0, 'marquise', { playArea: [card('ROOT-108')] }),
            player(1, 'marquise'),
          ],
        }),
        0,
        [
          { id: 'w0', kind: 'warrior', owner: 0 },
          { id: 'ws0', kind: 'building', owner: 0, type: 'workshop', used: false },
        ],
      ),
      2,
      [{ id: 'w2', kind: 'warrior', owner: 0 }],
    )
    const hooks = buildRuleHooks(state, FALL)
    expect(canMove(state, { seat: 0, from: 0, to: 2 }, hooks)).toBe(false)
  })
})
