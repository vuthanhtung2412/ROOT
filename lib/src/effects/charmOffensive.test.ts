import { describe, expect, it } from 'vitest'
import '#effects/register.js'
import { card, createPlayingGame } from '#test/fixtures.js'

describe('Charm Offensive', () => {
  it('Rule: Charm Offensive — Evening may draw and give another player one VP', () => {
    const game = createPlayingGame({ seed: 11 })

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
