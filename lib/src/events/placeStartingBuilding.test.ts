import { describe, expect, it, beforeEach } from 'vitest'
import { keepCornerFor, startingBuildingZone } from '#factions/Marquise.js'
import type { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import { resetPlaceIds } from '#rules/place.js'
import { createLobbyGame } from '#test/fixtures.js'

function placeAllStartingBuildings(game: Game): void {
  while (game.state.pending[0]?.type === 'placeStartingBuilding') {
    const specs = game.legalActions()
    const clearings = specs[0]?.params?.clearing
    if (clearings === undefined || clearings.length === 0) {
      throw new Error('no legal starting building clearings')
    }
    game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
  }
}

describe('placeStartingBuilding', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Marquise > Setup 4 — after keep, pending sawmill in keep∪adjacent', () => {
    const game = createLobbyGame()
    game.start()
    const keep = FALL.corners[0]!
    game.apply({ type: 'resolveEvent', clearing: keep })
    expect(game.state.pending[0]?.type).toBe('placeStartingBuilding')
    const pending = game.state.pending[0]
    if (pending?.type !== 'placeStartingBuilding') {
      throw new Error('expected placeStartingBuilding')
    }
    expect(pending.building).toBe('sawmill')
    const specs = game.legalActions()
    expect(specs[0]?.params?.building).toEqual(['sawmill'])
    expect(specs[0]?.params?.clearing).toEqual(
      startingBuildingZone(game.state, 0).filter((id) =>
        specs[0]!.params!.clearing!.includes(id),
      ),
    )
    const zone = startingBuildingZone(game.state, 0)
    for (const clearing of specs[0]!.params!.clearing!) {
      expect(zone).toContain(clearing)
    }
  })

  it('Rule: Marquise > Setup 4 — place three buildings then chooseLeader', () => {
    const game = createLobbyGame()
    game.start()
    const keep = FALL.corners[0]!
    game.apply({ type: 'resolveEvent', clearing: keep })
    placeAllStartingBuildings(game)
    expect(game.state.pending[0]?.type).toBe('chooseLeader')
    const board = game.state.players[0]!.board
    if (board.kind !== 'marquise') throw new Error('expected marquise')
    expect(board.tracks.sawmill.placed).toBe(5)
    const buildings = game.state.clearings.flatMap((clearing) =>
      clearing.pieces.filter(
        (piece) =>
          piece.kind === 'building' &&
          piece.owner === 0 &&
          (piece.type === 'sawmill' ||
            piece.type === 'workshop' ||
            piece.type === 'recruiter'),
      ),
    )
    const types = buildings.map((piece) => {
      if (piece.kind !== 'building') {
        throw new Error('expected building')
      }
      return piece.type
    })
    expect(types.sort()).toEqual(['recruiter', 'sawmill', 'workshop'])
    expect(keepCornerFor(game.state, 0)).toBe(keep)
  })

  it('rejects clearing outside keep∪adjacent', () => {
    const game = createLobbyGame()
    game.start()
    const keep = FALL.corners[0]!
    game.apply({ type: 'resolveEvent', clearing: keep })
    const zone = new Set(startingBuildingZone(game.state, 0))
    const outside = Array.from({ length: 12 }, (_, id) => id).find(
      (id) => !zone.has(id),
    )
    expect(outside).toBeDefined()
    expect(() =>
      game.apply({ type: 'resolveEvent', clearing: outside! }),
    ).toThrow()
  })
})
