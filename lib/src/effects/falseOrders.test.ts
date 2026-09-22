import { describe, expect, it } from 'vitest'
import './register.js'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { Game } from '../game/Game.js'
import { card } from '../test/fixtures.js'

describe('False Orders', () => {
  it('Rule: False Orders — discard self to force half enemy warriors to move ignoring rule', () => {
    const game = Game.create({ seed: 31 })
    game.join('a')
    game.join('b')
    game.start()
    game.apply({ type: 'resolveEvent', clearing: 0 })
    while (game.state.pending[0]?.type === 'placeStartingBuilding') {
      const clearings = game.legalActions()[0]?.params?.clearing
      if (clearings === undefined || clearings.length === 0) {
        throw new Error('no legal starting building clearings')
      }
      game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
    }
    game.apply({ type: 'resolveEvent', leader: 'builder' })

    const orders = card('ROOT-72')
    game.state.players[0]!.playArea.push(orders)

    // Enemy: 3 warriors in clearing 2; path to 5; neither ruled by enemy needed (ignore rule).
    const fromClearing = 2
    const toClearing = 5
    expect(FALL.isAdjacent(fromClearing, toClearing)).toBe(true)
    game.state.clearings[fromClearing]!.pieces = [
      { id: 'e1', kind: 'warrior', owner: 1 },
      { id: 'e2', kind: 'warrior', owner: 1 },
      { id: 'e3', kind: 'warrior', owner: 1 },
    ]
    game.state.clearings[toClearing]!.pieces = game.state.clearings[toClearing]!.pieces.filter(
      (piece) => piece.owner !== 1,
    )

    expect(game.legalActions().some((spec) => spec.type === 'falseOrders')).toBe(true)
    game.apply({
      type: 'falseOrders',
      target: 1,
      from: fromClearing,
      to: toClearing,
    })

    expect(game.state.players[0]!.playArea.some((playCard) => playCard.id === orders.id)).toBe(
      false,
    )
    expect(warriors(game.state, fromClearing, 1)).toBe(1) // ceil(3/2)=2 moved, 1 left
    expect(warriors(game.state, toClearing, 1)).toBe(2)
  })
})
