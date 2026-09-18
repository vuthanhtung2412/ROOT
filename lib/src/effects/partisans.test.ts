import { describe, expect, it, beforeEach } from 'vitest'
import './register.js'
import { defOf } from '../cards/Deck.js'
import { resetPlaceIds } from '../rules/place.js'
import { card, minimalState, player, testContext, withPieces } from '../test/fixtures.js'
import { battleResolver } from '../events/battle.js'
import type { BattleEvent } from '../events/types.js'

describe('Fox Partisans', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Fox Partisans — extra hit in fox clearing battle', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise', {
            playArea: [card('ROOT-77')],
            hand: [card('ROOT-206'), card('ROOT-202', 3)],
          }),
          player(1, 'marquise'),
        ],
      }),
      0,
      [
        { id: 'a1', kind: 'warrior', owner: 0 },
        { id: 'd1', kind: 'warrior', owner: 1 },
      ],
    )
    const event: BattleEvent = {
      type: 'battle',
      clearing: 0,
      attacker: 0,
      defender: 1,
      stage: 'effects',
      rolls: [3, 1],
      hits: { attacker: 1, defender: 1 },
      effectsOrder: [0, 1],
      effectsUsed: {},
    }
    state.pending = [event]
    const context = testContext({ state })
    battleResolver.apply(state, { event: event, action: { type: 'resolveEvent', useEffect: true }, actor: 0 }, context)
    expect(event.hits.attacker).toBe(2)
    expect(state.players[0]!.hand.every((handCard) => defOf(handCard).suit === 'fox')).toBe(true)
  })
})
