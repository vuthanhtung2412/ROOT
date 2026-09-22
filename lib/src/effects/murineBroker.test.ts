import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { craftCard } from '#rules/craft.js'
import { card, minimalState, player, withPieces } from '#test/fixtures.js'
import { buildCraftContext } from '#effects/utils.js'

describe('Murine Broker', () => {
  it('Rule: Murine Broker — other player crafts item → draw', () => {
    const hammer = card('ROOT-204')
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { hand: [hammer] }),
          player(1, 'marquise', { hand: [], playArea: [card('ROOT-85')] }),
        ],
        deck: { draw: [card('ROOT-209', 9)], discard: [] },
      }),
      0,
      [{ id: 'ws', kind: 'building', owner: 0, type: 'workshop', used: false }],
    )
    craftCard(state, 0, hammer.id, buildCraftContext(state))
    expect(state.players[1]!.hand).toHaveLength(1)
  })
})
