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
    game.state.players[0]!.playArea.push(card('ROOT-103'))
    game.state.players[0]!.hand.push(card('ROOT-209'))
    game.state.players[1]!.hand.push(card('ROOT-211', 2), card('ROOT-72'))

    expect(game.legalActions().some((a) => a.type === 'swapMeet')).toBe(true)
    game.apply({ type: 'swapMeet', target: 1, giveCardId: 'ROOT-209#1' })
    expect(game.state.turnScratch.swapMeetUsed).toBe(true)
    expect(game.legalActions().some((a) => a.type === 'swapMeet')).toBe(false)
    expect(game.state.players[0]!.hand.some((c) => c.id === 'ROOT-211#2')).toBe(true)
  })
})
