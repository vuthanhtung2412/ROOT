import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Informants', () => {
  it('Rule: Informants — Evening may take ambush from discard instead of draw', () => {
    const game = createPlayingGame({ seed: 17 })

    game.state.players[0]!.playArea.push(card('ROOT-79'))
    const ambush = card('ROOT-200')
    game.state.deck.discard.push(ambush)
    // Empty draw so normal draw would yield nothing; ambush path still works.
    game.state.deck.draw = []

    game.apply({ type: 'endPhase' }) // birdsong → daylight craft
    game.apply({ type: 'endPhase' }) // craft → actions
    game.apply({ type: 'endPhase' }) // actions → evening draw (auto blocked)

    expect(game.state.phase).toBe('evening')
    expect(game.state.turnScratch.eveningDrawDone).toBe(false)
    expect(game.legalActions().some((spec) => spec.type === 'informantsTakeAmbush')).toBe(
      true,
    )
    expect(game.legalActions().some((spec) => spec.type === 'eveningDraw')).toBe(true)

    const handBefore = game.state.players[0]!.hand.length
    game.apply({ type: 'informantsTakeAmbush', cardId: ambush.id })

    expect(game.state.turnScratch.eveningDrawDone).toBe(true)
    expect(game.state.players[0]!.hand.some((handCard) => handCard.id === ambush.id)).toBe(
      true,
    )
    expect(game.state.players[0]!.hand.length).toBe(handBefore + 1)
    expect(game.state.deck.discard.some((discardCard) => discardCard.id === ambush.id)).toBe(
      false,
    )
  })
})
