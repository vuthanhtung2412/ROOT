import { describe, expect, it } from 'vitest'
import {
  forestPathSides,
  forestSides,
  isInsideForest,
  type ForestGround,
  type ForestSide,
} from '#game/map3d/forestOutline.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'

const FOREST_SIZE = 20
const CLEARING_RADIUS = 4

/** A square forest with a corner on the origin. */
function forestFixture(): ForestGround {
  return {
    forestIndex: 0,
    corners: [
      { x: 0, z: 0 },
      { x: FOREST_SIZE, z: 0 },
      { x: FOREST_SIZE, z: FOREST_SIZE },
      { x: 0, z: FOREST_SIZE },
    ],
  }
}

function clearingFixture(center: MapGroundPoint): ClearingGround {
  return { clearingId: 0, center, radius: CLEARING_RADIUS }
}

describe('forestSides', () => {
  it('closes the outline back onto its first corner', () => {
    const sides: ForestSide[] = forestSides(forestFixture())
    expect(sides).toHaveLength(4)
    expect(sides.at(-1)).toEqual({
      start: { x: 0, z: FOREST_SIZE },
      end: { x: 0, z: 0 },
    })
  })
})

describe('forestPathSides', () => {
  it('cuts a side back to the rims of the clearings at its ends', () => {
    const sides: ForestSide[] = forestPathSides(forestFixture(), [
      clearingFixture({ x: 0, z: 0 }),
      clearingFixture({ x: FOREST_SIZE, z: 0 }),
    ])
    expect(sides[0]).toEqual({
      start: { x: CLEARING_RADIUS, z: 0 },
      end: { x: FOREST_SIZE - CLEARING_RADIUS, z: 0 },
    })
  })

  it('leaves an end with no clearing on its corner', () => {
    const sides: ForestSide[] = forestPathSides(forestFixture(), [
      clearingFixture({ x: 0, z: 0 }),
    ])
    expect(sides[1]).toEqual({
      start: { x: FOREST_SIZE, z: 0 },
      end: { x: FOREST_SIZE, z: FOREST_SIZE },
    })
  })

  it('drops a side its clearings cover from end to end', () => {
    const wideClearing: ClearingGround = {
      clearingId: 0,
      center: { x: 0, z: 0 },
      radius: FOREST_SIZE,
    }
    const sides: ForestSide[] = forestPathSides(forestFixture(), [wideClearing])
    expect(sides).toHaveLength(2)
  })
})

describe('isInsideForest', () => {
  it('tells a point in the forest from one outside it', () => {
    const middle: number = FOREST_SIZE / 2
    expect(isInsideForest({ x: middle, z: middle }, forestFixture())).toBe(true)
    expect(isInsideForest({ x: -1, z: middle }, forestFixture())).toBe(false)
  })
})
