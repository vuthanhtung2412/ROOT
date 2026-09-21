import { describe, expect, it } from 'vitest'
import './register.js'
import { Game } from '../game/Game.js'
import { card } from '../test/fixtures.js'
describe('Swap Meet', () => {
  it('Rule: Swap Meet — granted once per Birdsong', () => {
    const game = Game.create({ seed: 5 })
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
    game.state.players[0]!.playArea.push(card('ROOT-103'))
    game.state.players[0]!.hand.push(card('ROOT-209'))
    game.state.players[1]!.hand = [card('ROOT-211', 2)]

    expect(game.legalActions().some((a) => a.type === 'swapMeet')).toBe(true)
    game.apply({ type: 'swapMeet', target: 1, giveCardId: 'ROOT-209#1' })
    expect(game.state.turnScratch.swapMeetUsed).toBe(true)
    expect(game.legalActions().some((a) => a.type === 'swapMeet')).toBe(false)
    expect(game.state.players[0]!.hand.some((c) => c.id === 'ROOT-211#2')).toBe(true)
    expect(game.state.players[1]!.hand.some((c) => c.id === 'ROOT-209#1')).toBe(true)
  })
})
