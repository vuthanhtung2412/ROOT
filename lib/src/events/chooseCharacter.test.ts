import { describe, expect, it } from 'vitest'
import { boardOf } from '#factions/vagabond/items.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import { RuleError } from '#rules/RuleError.js'
import { VAGABOND_CHARACTERS } from '#state/boards.js'
import { finishSetup } from '#test/fixtures.js'

function startTwoPlayerVagabondGame(): Game {
  const game = Game.create({ seed: 11, factions: ['marquise', 'vagabond'] })
  game.join('a')
  game.join('b')
  game.start()
  game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  while (game.state.pending[0]?.type === 'placeStartingBuilding') {
    const clearings = game.legalActions()[0]?.params?.clearing
    if (clearings === undefined || clearings.length === 0) {
      throw new Error('no legal starting building clearings')
    }
    game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
  }
  return game
}

describe('chooseCharacter', () => {
  it('Rule: Vagabond > Setup 1 — pending before the forest; three characters legal', () => {
    const game = startTwoPlayerVagabondGame()

    expect(game.state.pending.map((event) => event.type)).toEqual([
      'chooseCharacter',
      'chooseForest',
    ])
    expect(game.legalActions()[0]?.params?.characters).toEqual([
      ...VAGABOND_CHARACTERS,
    ])
  })

  it('Rule: D.2.1 — choosing the Tinker gives the Tinker starting items', () => {
    const game = startTwoPlayerVagabondGame()

    game.apply({ type: 'resolveEvent', character: 'tinker' })

    const board = boardOf(game.state, 1)
    expect(board.character).toBe('tinker')
    expect(board.satchel.map((item) => item.type).sort()).toEqual([
      'boot',
      'hammer',
      'torch',
    ])
    expect(board.tracks.bag.map((item) => item.type)).toEqual(['bag'])
    expect(game.state.pending[0]?.type).toBe('chooseForest')
  })

  it('rejects a forest choice while the character is still pending', () => {
    const game = startTwoPlayerVagabondGame()

    expect(() => {
      game.apply({ type: 'resolveEvent', forest: FALL.vagabondForest })
    }).toThrow(RuleError)
  })

  it('finishSetup takes the requested character', () => {
    const game = Game.create({ seed: 11, factions: ['marquise', 'vagabond'] })
    game.join('a')
    game.join('b')
    game.start()

    finishSetup(game, { character: 'ranger' })

    expect(game.state.status).toBe('playing')
    expect(boardOf(game.state, 1).character).toBe('ranger')
  })
})
