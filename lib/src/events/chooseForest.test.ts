import { describe, expect, it } from 'vitest'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import { boardOf } from '#factions/vagabond/items.js'
import { finishSetup } from '#test/fixtures.js'

describe('chooseForest', () => {
  it('Rule: Vagabond > Setup 2 — pending after leader; any forest legal', () => {
    const game = Game.create({
      seed: 7,
      factions: ['marquise', 'eyrie', 'alliance', 'vagabond'],
    })
    game.join('a')
    game.join('b')
    game.join('c')
    game.join('d')
    game.start()
    game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
    while (game.state.pending[0]?.type === 'placeStartingBuilding') {
      const clearings = game.legalActions()[0]?.params?.clearing
      if (clearings === undefined || clearings.length === 0) {
        throw new Error('no legal starting building clearings')
      }
      game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
    }
    expect(game.state.pending[0]?.type).toBe('chooseLeader')
    game.apply({ type: 'resolveEvent', leader: 'builder' })
    expect(game.state.pending[0]?.type).toBe('chooseForest')
    const forests = game.legalActions()[0]?.params?.forests
    expect(forests).toEqual(FALL.forests.map((_, index) => index))
    const chosenForest = 0
    game.apply({ type: 'resolveEvent', forest: chosenForest })
    expect(game.state.status).toBe('playing')
    expect(boardOf(game.state, 3).forest).toBe(chosenForest)
  })

  it('finishSetup drains chooseForest with default forest', () => {
    const game = Game.create({
      seed: 11,
      factions: ['marquise', 'vagabond'],
    })
    game.join('a')
    game.join('b')
    game.start()
    finishSetup(game)
    expect(game.state.status).toBe('playing')
    expect(boardOf(game.state, 1).forest).toBe(FALL.vagabondForest)
  })
})
