import { describe, expect, it } from 'vitest'
import { forecastMarquise } from '#factions/marquise/workshopForecast.js'
import { FALL } from '#map/fall.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'
import { minimalState, testContext, withPieces } from '#test/fixtures.js'

const MARQUISE_SEAT: Seat = 0
const RULED_CLEARING = 0
const WARRIOR: Piece = { id: 'warrior', kind: 'warrior', owner: MARQUISE_SEAT }
const WOOD: Piece = { id: 'wood', kind: 'token', type: 'wood', owner: MARQUISE_SEAT }
const UNUSED_WORKSHOP: Piece = {
  id: 'workshop',
  kind: 'building',
  type: 'workshop',
  owner: MARQUISE_SEAT,
  used: false,
}
const RECRUITER: Piece = {
  id: 'recruiter',
  kind: 'building',
  type: 'recruiter',
  owner: MARQUISE_SEAT,
}

function forecast(state: GameState): ReturnType<typeof forecastMarquise> {
  return forecastMarquise(state, MARQUISE_SEAT, testContext({ state }))
}

describe('forecastMarquise', () => {
  it('Rule: 6.5.4.II — the next building of each type costs and scores by its track', () => {
    const state = withPieces(minimalState(), RULED_CLEARING, [WARRIOR, WOOD])

    const result = forecast(state)

    // Fixture board: five buildings left per track, so the second column is next.
    expect(result.buildings).toEqual([
      {
        building: 'sawmill',
        leftOnBoard: 5,
        woodCost: 1,
        victoryPoints: 1,
        buildableIn: [RULED_CLEARING],
      },
      {
        building: 'workshop',
        leftOnBoard: 5,
        woodCost: 1,
        victoryPoints: 2,
        buildableIn: [RULED_CLEARING],
      },
      {
        building: 'recruiter',
        leftOnBoard: 5,
        woodCost: 1,
        victoryPoints: 1,
        buildableIn: [RULED_CLEARING],
      },
    ])
    expect(result.ruledClearings).toEqual([
      { clearing: RULED_CLEARING, woodInReach: 1 },
    ])
  })

  it('Rule: 6.5.4.II — no wood in reach, nothing can be built', () => {
    const state = withPieces(minimalState(), RULED_CLEARING, [WARRIOR])

    const result = forecast(state)

    expect(result.ruledClearings).toEqual([
      { clearing: RULED_CLEARING, woodInReach: 0 },
    ])
    for (const building of result.buildings) {
      expect(building.buildableIn).toEqual([])
    }
  })

  it('lists the unused workshops by suit and the recruiter clearings', () => {
    const state = withPieces(minimalState(), RULED_CLEARING, [
      WARRIOR,
      UNUSED_WORKSHOP,
      RECRUITER,
    ])

    const result = forecast(state)

    expect(result.unusedWorkshopSuits).toEqual([
      FALL.clearings[RULED_CLEARING]?.suit,
    ])
    expect(result.recruiterClearings).toEqual([RULED_CLEARING])
    expect(result.woodInSupply).toBe(8)
    expect(result.warriorsInSupply).toBe(25)
  })
})
