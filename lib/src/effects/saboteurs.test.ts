import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Saboteurs', () => {
  it('Rule: Saboteurs — discard self to discard enemy crafted card', () => {
    const game = createPlayingGame({ seed: 29 })

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
