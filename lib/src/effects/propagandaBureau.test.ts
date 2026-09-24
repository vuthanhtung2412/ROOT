import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { warriors } from '#queries/pieces.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Propaganda Bureau', () => {
  it('Rule: Propaganda Bureau — spend matching card to replace enemy warrior', () => {
    const game = createPlayingGame({ seed: 23 })

    game.apply({ type: 'endPhase' })
    game.apply({ type: 'endPhase' })

    const seat = game.state.currentSeat
    const enemy = seat === 0 ? 1 : 0
    game.state.players[seat]!.playArea.push(card('ROOT-86'))

    // Fox clearing 0: place enemy warrior; give owner a fox card.
    const foxClearing = 0
    expect(FALL.clearings[foxClearing]!.suit).toBe('fox')
    game.state.clearings[foxClearing]!.pieces.push({
      id: 'enemy-w',
      kind: 'warrior',
      owner: enemy,
    })
    const foxCard = card('ROOT-72')
    game.state.players[seat]!.hand.push(foxCard)

    expect(game.legalActions().some((spec) => spec.type === 'propagandaBureau')).toBe(true)
    const ownerBefore = warriors(game.state, foxClearing, seat)
    game.apply({
      type: 'propagandaBureau',
      cardId: foxCard.id,
      clearing: foxClearing,
      pieceId: 'enemy-w',
    })

    expect(game.state.turnScratch.propagandaUsed).toBe(true)
    expect(
      game.state.clearings[foxClearing]!.pieces.some((piece) => piece.id === 'enemy-w'),
    ).toBe(false)
    expect(warriors(game.state, foxClearing, seat)).toBe(ownerBefore + 1)
    expect(game.state.players[seat]!.hand.some((handCard) => handCard.id === foxCard.id)).toBe(
      false,
    )
  })
})
