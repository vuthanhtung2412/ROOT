import { describe, expect, it } from 'vitest'
import { defOf } from '#cards/Deck.js'
import { Game } from '#game/Game.js'
import {
  COALITION_MIN_PLAYER_COUNT,
  DOMINANCE_ACTIVATE_MIN_VP,
} from '#rules/dominance.js'
import { card, createPlayingGame, finishSetup } from '#test/fixtures.js'

describe('dominance take / activate', () => {
  it('Rule: Dominance 3.3.4 — take available by spending matching suit', () => {
    const game = createPlayingGame()
    const dominance = card('ROOT-214') // mouse dominance
    game.state.dominanceAvailable = [dominance]
    game.state.players[0]!.hand = [card('ROOT-1')] // need a mouse-matching card
    // Use a mouse suit spend card from EP deck — ROOT mouse cards.
    const mouseCard = game.state.deck.draw.find((entry) => defOf(entry).suit === 'mouse')
      ?? card('ROOT-205')
    game.state.players[0]!.hand = [mouseCard]
    game.state.phase = 'daylight'
    game.state.step = 'actions'
    game.state.currentSeat = 0

    const legal = game.legalActions().filter((spec) => spec.type === 'takeDominance')
    expect(legal.length).toBeGreaterThan(0)

    game.apply({ type: 'takeDominance', cardId: mouseCard.id })
    expect(game.state.dominanceAvailable).toHaveLength(0)
    expect(game.state.players[0]!.hand.some((entry) => entry.id === dominance.id)).toBe(
      true,
    )
  })

  it('Rule: Dominance 3.3.1 — activate at 10+ VP; stop scoring', () => {
    const game = createPlayingGame()
    const dominance = card('ROOT-213') // fox
    game.state.players[0]!.hand.push(dominance)
    game.state.players[0]!.vp = DOMINANCE_ACTIVATE_MIN_VP
    game.state.phase = 'daylight'
    game.state.step = 'actions'
    game.state.currentSeat = 0

    game.apply({ type: 'activateDominance', cardId: dominance.id })
    expect(game.state.players[0]!.activatedDominance?.id).toBe(dominance.id)
    expect(game.state.players[0]!.scoresVictoryPoints).toBe(false)
    expect(game.state.players[0]!.hand.some((entry) => entry.id === dominance.id)).toBe(
      false,
    )
  })

  it('Rule: Vagabond 9.2.8 — activate forms coalition in 4p+', () => {
    const game = Game.create({
      seed: 7,
      factions: ['marquise', 'eyrie', 'alliance', 'vagabond'],
    })
    game.join('a')
    game.join('b')
    game.join('c')
    game.join('d')
    expect(game.state.players.length).toBe(COALITION_MIN_PLAYER_COUNT)
    game.start()
    finishSetup(game)

    const vagabond = game.state.players.find((entry) => entry.faction === 'vagabond')
    expect(vagabond).toBeDefined()
    if (vagabond === undefined) return

    // Ensure quests already drawn during setup path if vagabond setup ran.
    const dominance = card('ROOT-211')
    vagabond.hand.push(dominance)
    vagabond.vp = DOMINANCE_ACTIVATE_MIN_VP
    game.state.players[0]!.vp = 5
    game.state.players[1]!.vp = 3
    game.state.players[2]!.vp = 8
    game.state.currentSeat = vagabond.seat
    game.state.phase = 'daylight'
    game.state.step = 'actions'
    game.state.status = 'playing'

    game.apply({
      type: 'activateDominance',
      cardId: dominance.id,
      coalitionTarget: 1,
    })
    expect(vagabond.coalitionWith).toBe(1)
    expect(vagabond.scoresVictoryPoints).toBe(false)
  })
})
