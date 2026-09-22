import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { FALL } from '#map/fall.js'
import { Game } from '#game/Game.js'
import { card } from '#test/fixtures.js'

describe('Eyrie Émigré', () => {
  it('Rule: Eyrie Émigré — discard at end of Birdsong if move+battle not taken', () => {
    const game = Game.create({ seed: 37 })
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
    const game = Game.create({ seed: 41 })
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
