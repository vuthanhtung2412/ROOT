import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#actions/types.js'
import { Game } from '#game/Game.js'
import type { FactionId } from '#pieces/types.js'
import { RuleError } from '#rules/RuleError.js'
import type { PlayerState } from '#state/types.js'

const SEED = 7

/** A game created with no faction set: players pick when they join. */
function openLobby(): Game {
  return Game.create({ seed: SEED, factions: [] })
}

function factionsOfPlayers(game: Game): FactionId[] {
  return game.state.players.map((player: PlayerState): FactionId => player.faction)
}

function legalTypes(game: Game): string[] {
  return game.legalActions().map((spec: ActionSpec): string => spec.type)
}

describe('open lobby: players choose their faction', () => {
  it('starts with no faction and no seat taken', () => {
    const game: Game = openLobby()

    expect(game.state.openLobby).toBe(true)
    expect(game.state.factions).toEqual([])
    expect(legalTypes(game)).toEqual(['join'])
  })

  it('each player joins with the faction they picked, in join order', () => {
    const game: Game = openLobby()

    game.apply({ type: 'join', playerId: 'first', faction: 'eyrie' })
    game.apply({ type: 'join', playerId: 'second', faction: 'lizard' })

    expect(game.state.factions).toEqual(['eyrie', 'lizard'])
    expect(factionsOfPlayers(game)).toEqual(['eyrie', 'lizard'])
    expect(game.state.players[1]!.board.kind).toBe('lizard')
  })

  it('a faction already taken cannot be picked', () => {
    const game: Game = openLobby()
    game.apply({ type: 'join', playerId: 'first', faction: 'eyrie' })

    expect(() =>
      game.apply({ type: 'join', playerId: 'second', faction: 'eyrie' }),
    ).toThrow(expect.objectContaining({ code: 'FACTION_TAKEN' }))
    expect(game.state.players).toHaveLength(1)
  })

  it('joining needs a faction', () => {
    const game: Game = openLobby()

    expect(() => game.apply({ type: 'join', playerId: 'first' })).toThrow(
      expect.objectContaining({ code: 'MISSING_FACTION' }),
    )
  })

  it('a seated player may pick another faction and keeps the seat', () => {
    const game: Game = openLobby()
    game.apply({ type: 'join', playerId: 'first', faction: 'eyrie' })
    game.apply({ type: 'join', playerId: 'second', faction: 'lizard' })

    game.apply({ type: 'join', playerId: 'first', faction: 'marquise' })

    expect(game.state.factions).toEqual(['marquise', 'lizard'])
    expect(game.state.players[0]).toMatchObject({
      playerId: 'first',
      seat: 0,
      faction: 'marquise',
    })
    expect(game.state.players[0]!.board.kind).toBe('marquise')
  })

  it('holds at most four players', () => {
    const game: Game = openLobby()
    const picks: FactionId[] = ['marquise', 'eyrie', 'alliance', 'vagabond']
    picks.forEach((faction: FactionId, index: number): void => {
      game.apply({ type: 'join', playerId: `player-${String(index)}`, faction })
    })

    expect(legalTypes(game)).toEqual(['start'])
    expect(() =>
      game.apply({ type: 'join', playerId: 'fifth', faction: 'lizard' }),
    ).toThrow(expect.objectContaining({ code: 'LOBBY_FULL' }))
  })

  it('starts once two players have picked', () => {
    const game: Game = openLobby()
    game.apply({ type: 'join', playerId: 'first', faction: 'marquise' })
    expect(() => game.apply({ type: 'start' })).toThrow(RuleError)

    game.apply({ type: 'join', playerId: 'second', faction: 'eyrie' })
    game.apply({ type: 'start' })

    expect(game.state.status).toBe('setup')
    expect(game.state.factions).toEqual(['marquise', 'eyrie'])
  })

  it('undo rebuilds the open lobby from its joins', () => {
    const game: Game = openLobby()
    game.apply({ type: 'join', playerId: 'first', faction: 'marquise' })
    const afterFirstJoin = structuredClone(game.state)
    game.apply({ type: 'join', playerId: 'second', faction: 'eyrie' })

    game.undo()

    expect(game.state).toEqual(afterFirstJoin)
  })
})

describe('preset lobby: seats keep their decided faction', () => {
  it('rejects a pick that is not the faction of the next seat', () => {
    const game: Game = Game.create({ seed: SEED, factions: ['marquise', 'eyrie'] })

    expect(() =>
      game.apply({ type: 'join', playerId: 'first', faction: 'eyrie' }),
    ).toThrow(expect.objectContaining({ code: 'WRONG_FACTION' }))
    game.apply({ type: 'join', playerId: 'first', faction: 'marquise' })

    expect(factionsOfPlayers(game)).toEqual(['marquise'])
  })
})
