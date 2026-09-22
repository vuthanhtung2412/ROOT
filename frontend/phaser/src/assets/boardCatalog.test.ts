import { describe, expect, it } from 'vitest'
import {
  EYRIE_ROOST_TRACK,
  EYRIE_ROOST_TRACK_SLOT_COUNT,
} from '#assets/eyrieBoardCatalog.ts'
import {
  MARQUISE_BUILDING_TRACK,
  MARQUISE_TRACK_SLOT_COUNT,
} from '#assets/marquiseBoardCatalog.ts'

describe('marquiseBoardCatalog', () => {
  it('has six columns matching board costs and VP', () => {
    expect(MARQUISE_BUILDING_TRACK).toHaveLength(MARQUISE_TRACK_SLOT_COUNT)
    expect(MARQUISE_BUILDING_TRACK.map((column) => column.woodCost)).toEqual([
      0, 1, 2, 3, 3, 4,
    ])
    expect(
      MARQUISE_BUILDING_TRACK.map((column) => column.sawmillVictoryPoints),
    ).toEqual([0, 1, 2, 3, 4, 5])
    expect(
      MARQUISE_BUILDING_TRACK.map((column) => column.workshopVictoryPoints),
    ).toEqual([0, 2, 2, 3, 4, 5])
    expect(
      MARQUISE_BUILDING_TRACK.map((column) => column.recruiterVictoryPoints),
    ).toEqual([0, 1, 2, 3, 3, 4])
    expect(
      MARQUISE_BUILDING_TRACK.map((column) => column.recruiterDrawBonus),
    ).toEqual([0, 0, 1, 0, 1, 0])
  })
})

describe('eyrieBoardCatalog', () => {
  it('has seven roost slots matching Evening VP and draw', () => {
    expect(EYRIE_ROOST_TRACK).toHaveLength(EYRIE_ROOST_TRACK_SLOT_COUNT)
    expect(EYRIE_ROOST_TRACK.map((column) => column.eveningVictoryPoints)).toEqual([
      0, 1, 2, 3, 4, 4, 5,
    ])
    expect(EYRIE_ROOST_TRACK.map((column) => column.drawBonus)).toEqual([
      0, 0, 1, 0, 0, 1, 0,
    ])
  })
})
