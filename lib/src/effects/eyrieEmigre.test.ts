import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Eyrie Émigré', () => {
  it('Rule: Eyrie Émigré — discard at end of Birdsong if move+battle not taken', () => {
    const game = createPlayingGame({ seed: 37 })

    const emigre = card('ROOT-71')
    game.state.players[0]!.playArea.push(emigre)
    expect(game.state.phase).toBe('birdsong')

    game.apply({ type: 'endPhase' }) // birdsong → daylight; phase.end should discard

    expect(game.state.players[0]!.playArea.some((playCard) => playCard.id === emigre.id)).toBe(
      false,
    )
    expect(game.state.deck.discard.some((discardCard) => discardCard.id === emigre.id)).toBe(
      true,
    )
  })

  it('Rule: Eyrie Émigré — move then battle keeps card', () => {
    const game = createPlayingGame({ seed: 41 })

    const emigre = card('ROOT-71')
    game.state.players[0]!.playArea.push(emigre)

    // Seat 0 warriors at 0; enemy at adjacent 4 (path 0-4).
    expect(FALL.isAdjacent(0, 4)).toBe(true)
    game.state.clearings[4]!.pieces.push({ id: 'enemy', kind: 'warrior', owner: 1 })
    // Ensure seat 0 has a warrior at 0.
    if (!game.state.clearings[0]!.pieces.some((piece) => piece.kind === 'warrior' && piece.owner === 0)) {
      game.state.clearings[0]!.pieces.push({ id: 'ow', kind: 'warrior', owner: 0 })
    }

    expect(game.legalActions().some((spec) => spec.type === 'eyrieEmigre')).toBe(true)
    game.apply({
      type: 'eyrieEmigre',
      from: 0,
      to: 4,
      count: 1,
      defender: 1,
    })

    expect(game.state.turnScratch.eyrieEmigreCompleted).toBe(true)
    expect(game.state.players[0]!.playArea.some((playCard) => playCard.id === emigre.id)).toBe(
      true,
    )
    expect(game.state.pending.some((event) => event.type === 'battle')).toBe(true)
  })
})
