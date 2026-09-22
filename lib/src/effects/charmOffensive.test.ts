import { describe, expect, it } from 'vitest'
import './register.js'
import { Game } from '../game/Game.js'
import { card } from '../test/fixtures.js'

describe('Charm Offensive', () => {
  it('Rule: Charm Offensive — Evening may draw and give another player one VP', () => {
    const game = Game.create({ seed: 11 })
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

    // Advance seat 0 to Evening draw.
    game.apply({ type: 'endPhase' }) // birdsong → daylight craft
    game.apply({ type: 'endPhase' }) // craft → actions
    game.apply({ type: 'endPhase' }) // actions → evening (auto draw)

    game.state.players[0]!.playArea.push(card('ROOT-59'))
    game.state.deck.draw.push(card('ROOT-209', 9))
    const handBefore = game.state.players[0]!.hand.length
    const targetVpBefore = game.state.players[1]!.vp

    expect(game.state.phase).toBe('evening')
    expect(game.legalActions().some((spec) => spec.type === 'charmOffensive')).toBe(true)
    game.apply({ type: 'charmOffensive', target: 1 })

    expect(game.state.turnScratch.charmOffensiveUsed).toBe(true)
    expect(game.state.players[0]!.hand.length).toBe(handBefore + 1)
    expect(game.state.players[1]!.vp).toBe(targetVpBefore + 1)
    expect(game.legalActions().some((spec) => spec.type === 'charmOffensive')).toBe(false)
  })
})
