import { describe, expect, it } from 'vitest'
import { defOf } from '#cards/Deck.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import {
  COALITION_MIN_PLAYER_COUNT,
  DOMINANCE_ACTIVATE_MIN_VP,
  checkActivatedDominanceWin,
  finishGameWithWinner,
} from '#rules/dominance.js'
import {
  card,
  createPlayingGame,
  finishSetup,
  testContext,
  withPieces,
} from '#test/fixtures.js'

describe('dominance take / activate', () => {
  it('Rule: Dominance 3.3.4 — take available by spending matching suit', () => {
    const game = createPlayingGame()
    const dominance = card('ROOT-214') // mouse dominance
    game.state.dominanceAvailable = [dominance]
    const mouseCard =
      game.state.deck.draw.find((entry) => defOf(entry).suit === 'mouse') ??
      card('ROOT-205')
    game.state.players[0]!.hand = [mouseCard]
    game.state.phase = 'daylight'
    game.state.step = 'actions'
    game.state.currentSeat = 0

    const legal = game
      .legalActions()
      .filter((spec) => spec.type === 'takeDominance')
    expect(legal.length).toBeGreaterThan(0)

    game.apply({ type: 'takeDominance', cardId: mouseCard.id })
    expect(game.state.dominanceAvailable).toHaveLength(0)
    expect(
      game.state.players[0]!.hand.some((entry) => entry.id === dominance.id),
    ).toBe(true)
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
    expect(
      game.state.players[0]!.hand.some((entry) => entry.id === dominance.id),
    ).toBe(false)
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

    const vagabond = game.state.players.find(
      (entry) => entry.faction === 'vagabond',
    )
    expect(vagabond).toBeDefined()
    if (vagabond === undefined) return

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

  it('Rule: Dominance 3.3.1.I — Birdsong win on 3 matching clearings', () => {
    let state = createPlayingGame().state
    const dominance = card('ROOT-213') // fox
    state.players[0]!.activatedDominance = dominance
    state.players[0]!.scoresVictoryPoints = false
    state.currentSeat = 0
    state.phase = 'birdsong'
    state.step = 'wood'
    const foxClearings = FALL.clearings
      .filter((clearing) => clearing.suit === 'fox')
      .map((clearing) => clearing.id)
      .slice(0, 3)
    for (const clearingId of foxClearings) {
      state = withPieces(state, clearingId, [
        { id: `w-${String(clearingId)}`, kind: 'warrior', owner: 0 },
      ])
    }
    const logs = checkActivatedDominanceWin(state, testContext({ state }))
    expect(logs.some((entry) => entry.t === 'win')).toBe(true)
    expect(state.winner).toBe(0)
    expect(state.status).toBe('finished')
  })

  it('Rule: Vagabond 9.2.8 — coalition partner win lists Vagabond coWinner', () => {
    const state = createPlayingGame({
      seed: 11,
      playerIds: ['a', 'b'],
    }).state
    // Force vagabond as seat 1 for coalition field.
    state.players[1]!.faction = 'vagabond'
    state.players[1]!.board = {
      kind: 'vagabond',
      character: 'thief',
      satchel: [],
      tracks: { tea: [], coin: [], bag: [] },
      damaged: [],
      completedQuests: [],
      relationships: {
        marquise: 0,
        eyrie: 0,
        alliance: 0,
        vagabond: 0,
        lizard: 0,
        riverfolk: 0,
        mechanicalMarquise: 0,
        electricEyrie: 0,
      },
      forest: null,
    }
    state.players[1]!.coalitionWith = 0
    state.players[1]!.scoresVictoryPoints = false
    const logs = finishGameWithWinner(state, 0)
    expect(logs[0]).toEqual({ t: 'win', winner: 0 })
    expect(state.coWinners).toEqual([1])
  })
})
