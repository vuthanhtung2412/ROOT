import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { Game } from '#game/Game.js'
import { card } from '#test/fixtures.js'

describe('Saboteurs', () => {
  it('Rule: Saboteurs — discard self to discard enemy crafted card', () => {
    const game = Game.create({ seed: 29 })
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

    const saboteur = card('ROOT-93')
    const enemyCraft = card('ROOT-57')
    game.state.players[0]!.playArea.push(saboteur)
    game.state.players[1]!.playArea.push(enemyCraft)

    expect(game.state.phase).toBe('birdsong')
    expect(game.legalActions().some((spec) => spec.type === 'saboteurs')).toBe(true)
    game.apply({ type: 'saboteurs', target: 1, cardId: enemyCraft.id })

    expect(game.state.players[0]!.playArea.some((playCard) => playCard.id === saboteur.id)).toBe(
      false,
    )
    expect(game.state.players[1]!.playArea.some((playCard) => playCard.id === enemyCraft.id)).toBe(
      false,
    )
    expect(game.state.deck.discard.some((discardCard) => discardCard.id === saboteur.id)).toBe(
      true,
    )
    expect(game.state.deck.discard.some((discardCard) => discardCard.id === enemyCraft.id)).toBe(
      true,
    )
  })
})
