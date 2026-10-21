import { describe, expect, it } from 'vitest'
import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { isBotFaction } from '#factions/bots/botFactions.js'
import { Game } from '#game/Game.js'
import type { FactionId, Seat } from '#pieces/types.js'
import { WINNING_VICTORY_POINTS } from '#rules/cooperativeVictory.js'
import { finishSetup } from '#test/fixtures.js'

const COOPERATIVE_TABLE: readonly FactionId[] = ['marquise', 'alliance', 'vagabond', 'electricEyrie']
const HUMAN_SEATS: readonly Seat[] = [0, 1, 2]
const BOT_SEAT: Seat = 3
const SEED = 7

function lobbyGame(isCooperative: boolean): Game {
  const game = Game.create({ seed: SEED, factions: [...COOPERATIVE_TABLE], cooperative: isCooperative })
  for (const faction of COOPERATIVE_TABLE) {
    if (!isBotFaction(faction)) game.join(`human-${faction}`)
  }
  return game
}

/** Started game, the given seats already at 30 VP. */
function playingGame(isCooperative: boolean, seatsAtWinningScore: readonly Seat[] = []): Game {
  const game = lobbyGame(isCooperative)
  game.start()
  finishSetup(game)
  for (const seat of seatsAtWinningScore) game.state.players[seat]!.vp = WINNING_VICTORY_POINTS
  return game
}

function everyCardOf(game: Game): Card[] {
  return [
    ...game.state.deck.draw,
    ...game.state.deck.discard,
    ...game.state.dominanceAvailable,
    ...game.state.players.flatMap((seated) => seated.hand),
  ]
}

describe('cooperative victory (Rootbotics 3.5.1)', () => {
  it('humans win when every human reaches 30 VP', () => {
    const game = playingGame(true, HUMAN_SEATS)

    game.apply({ type: 'endPhase' })

    expect(game.state.status).toBe('finished')
    expect(game.state.winningTeam).toBe('humans')
    expect(game.state.winner).toBe(0)
    expect(game.state.coWinners).toEqual([1, 2])
  })

  it('one human at 30 VP does not end the game', () => {
    const game = playingGame(true, [0])

    game.apply({ type: 'endPhase' })

    expect(game.state.status).toBe('playing')
    expect(game.state.winningTeam).toBeUndefined()
  })

  it('the bots win when a bot reaches 30 VP first', () => {
    const game = playingGame(true, [0, 1, BOT_SEAT])

    game.apply({ type: 'endPhase' })

    expect(game.state.winningTeam).toBe('bots')
    expect(game.state.winner).toBe(BOT_SEAT)
    expect(game.state.coWinners).toEqual([])
  })

  it('both teams at 30 VP at once: the team of the current player wins', () => {
    const game = playingGame(true, [...HUMAN_SEATS, BOT_SEAT])

    game.apply({ type: 'endPhase' })

    expect(game.state.winningTeam).toBe('humans')
  })

  it('free-for-all: the first player at 30 VP wins alone', () => {
    const game = playingGame(false, [0])

    game.apply({ type: 'endPhase' })

    expect(game.state.winner).toBe(0)
    expect(game.state.winningTeam).toBeUndefined()
  })

  it('removes dominance cards even with three humans', () => {
    const cooperative = playingGame(true)
    const freeForAll = playingGame(false)

    const isDominance = (card: Card): boolean => defOf(card).type === 'dominance'
    expect(everyCardOf(cooperative).some(isDominance)).toBe(false)
    expect(everyCardOf(freeForAll).some(isDominance)).toBe(true)
  })

  it('is switched in the lobby only and kept by undo', () => {
    const game = lobbyGame(false)
    game.setCooperative(true)
    game.start()
    game.undo()

    expect(game.state.cooperative).toBe(true)
    game.setCooperative(false)
    expect(game.state.cooperative).toBeUndefined()
    game.start()
    expect(() => game.setCooperative(true)).toThrow()
  })
})
