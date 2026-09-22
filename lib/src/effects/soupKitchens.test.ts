import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { ruleStrength } from '#queries/pieces.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { card, minimalState, player, withPieces } from '#test/fixtures.js'

describe('Soup Kitchens', () => {
  it('Rule: Soup Kitchens — tokens count twice toward rule', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', { playArea: [card('ROOT-97')] }),
          player(1, 'marquise'),
        ],
      }),
      4,
      [
        { id: 'w0', kind: 'warrior', owner: 0 },
        { id: 'wood', kind: 'token', owner: 0, type: 'wood' },
      ],
    )
    const hooks = buildRuleHooks(state, FALL)
    expect(ruleStrength(state, 4, 0, hooks)).toBe(3)
  })
})
