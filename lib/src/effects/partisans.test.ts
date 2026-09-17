import { describe, expect, it, beforeEach } from 'vitest'
import './register.js'
import { defOf } from '../cards/Deck.js'
import { FALL } from '../map/fall.js'
import { resetPlaceIds } from '../rules/place.js'
import { buildRuleHooks } from '../triggers/buildHooks.js'
import { card, minimalState, player, withPieces } from '../test/fixtures.js'
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
    const ev: BattleEvent = {
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
    state.pending = [ev]
    const ctx = {
      map: FALL,
      rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
      emit: () => {},
      hooks: buildRuleHooks(state, FALL),
      grantedActions: () => [],
    }
    battleResolver.apply(state, ev, { type: 'resolveEvent', useEffect: true }, 0, ctx)
    expect(ev.hits.attacker).toBe(2)
    expect(state.players[0]!.hand.every((c) => defOf(c).suit === 'fox')).toBe(true)
  })
})
