import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { Game } from '#game/Game.js'
import { RuleError } from '#rules/RuleError.js'
import { card, createPlayingGame, finishSetup } from '#test/fixtures.js'

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

describe('Informants — legal payloads', () => {
  it('lists each ambush card of the discard pile, and no other card', () => {
    const game = createPlayingGame({ seed: 17 })
    game.state.players[0]!.playArea.push(card('ROOT-79'))
    const foxAmbush = card('ROOT-202')
    const birdAmbush = card('ROOT-200')
    game.state.deck.discard.push(foxAmbush, card('ROOT-204'), birdAmbush)
    game.apply({ type: 'endPhase' })
    game.apply({ type: 'endPhase' })
    game.apply({ type: 'endPhase' })

    const spec = game
      .legalActions()
      .find((candidate) => candidate.type === 'informantsTakeAmbush')

    expect(spec?.params?.options).toEqual([
      { cardId: foxAmbush.id },
      { cardId: birdAmbush.id },
    ])
  })
})

describe('Informants — "you may instead": the normal draw stays possible', () => {
  const MAX_PHASES = 12
  const ALLIANCE_SEAT = 1

  /** Woodland Alliance (its Evening draw is automatic) at its draw step. */
  function allianceAtEveningDraw(): Game {
    const game: Game = Game.create({ seed: 5, factions: ['marquise', 'alliance'] })
    game.join('marquise')
    game.join('alliance')
    game.start()
    finishSetup(game)
    let phases = 0
    while (game.state.currentSeat !== ALLIANCE_SEAT && phases++ < MAX_PHASES) {
      game.apply({ type: 'endPhase' })
    }
    game.state.players[ALLIANCE_SEAT]!.playArea.push(card('ROOT-79'))
    game.state.deck.discard.push(card('ROOT-200'))
    phases = 0
    while (
      !(game.state.phase === 'evening' && game.state.step === 'draw') &&
      phases++ < MAX_PHASES
    ) {
      game.apply({ type: 'endPhase' })
    }
    return game
  }

  it('offers the held Evening draw as an action of its own', () => {
    const game: Game = allianceAtEveningDraw()

    const types: string[] = game.legalActions().map((spec) => spec.type)

    expect(game.state.turnScratch.eveningDrawDone).toBe(false)
    expect(types).toContain('informantsTakeAmbush')
    expect(types).toContain('eveningDraw')
  })

  it('the draw is not optional: the phase cannot end before it', () => {
    const game: Game = allianceAtEveningDraw()

    expect(game.legalActions().map((spec) => spec.type)).not.toContain('endPhase')
    expect(() => game.apply({ type: 'endPhase' })).toThrow(RuleError)
  })

  it('drawing by hand draws from the deck and ends the Informants offer', () => {
    const game: Game = allianceAtEveningDraw()
    const handBefore: number = game.state.players[ALLIANCE_SEAT]!.hand.length

    game.apply({ type: 'eveningDraw' })

    expect(game.state.players[ALLIANCE_SEAT]!.hand.length).toBeGreaterThan(handBefore)
    expect(
      game.legalActions().some((spec) => spec.type === 'informantsTakeAmbush'),
    ).toBe(false)
  })
})
