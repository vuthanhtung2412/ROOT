import { describe, expect, it, beforeEach } from 'vitest'
import { Game } from '../game/Game.js'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { keepOwner } from '../queries/place.js'
import { resetPlaceIds } from '../rules/place.js'
import { eyrieStartClearing } from '../factions/Eyrie.js'
import { keepCornerFor } from '../factions/Marquise.js'

function lobbyTwo(seed = 42): Game {
  const game = Game.create({ seed })
  game.join('a')
  game.join('b')
  return game
}

describe('chooseKeep', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Marquise > Setup 2 — start leaves chooseKeep pending', () => {
    const game = lobbyTwo()
    game.start()
    expect(game.state.status).toBe('setup')
    expect(game.state.pending[0]?.type).toBe('chooseKeep')
    const specs = game.legalActions()
    expect(specs).toHaveLength(1)
    expect(specs[0]!.params?.clearing).toEqual([...FALL.corners])
  })

  it('Rule: Marquise > Setup 2 — each corner places keep + garrison', () => {
    for (const corner of FALL.corners) {
      resetPlaceIds()
      const game = lobbyTwo(corner + 10)
      game.start()
      game.apply({ type: 'resolveEvent', clearing: corner })
      expect(game.state.status).toBe('setup')
      expect(game.state.pending[0]?.type).toBe('chooseLeader')
      game.apply({ type: 'resolveEvent', leader: 'builder' })
      expect(game.state.status).toBe('playing')
      expect(keepOwner(game.state, corner)).toBe(0)
      expect(keepCornerFor(game.state, 0)).toBe(corner)
      const opposite = FALL.opposite(corner)
      expect(warriors(game.state, opposite, 0)).toBe(0)
      expect(eyrieStartClearing(game.state)).toBe(opposite)
      expect(
        game.state.clearings[opposite]!.pieces.some(
          (piece) => piece.kind === 'building' && piece.type === 'roost',
        ),
      ).toBe(true)
    }
  })

  it('rejects non-corner keep', () => {
    const game = lobbyTwo()
    game.start()
    expect(() => game.apply({ type: 'resolveEvent', clearing: 4 })).toThrow()
  })
})
