import { describe, expect, it } from 'vitest'
import type { MapTerrain } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import {
  placeMountains,
  type MountainPlacement,
} from '#game/map3d/mountainPlacement.ts'

const WORLD_WIDTH = 100
const WORLD_DEPTH = 70
const MARGIN = 30
const SEED = 41
const MODEL_COUNT = 2
const RIVER_POINT_COUNT = 60
const RIVER_SOURCE_X = 12
const HALF = 0.5
/** How near a corner a mountain centre must stand to count as reaching it. */
const CORNER_REACH = 1

/** A river straight down the woodland from past its top edge, at `x`. */
function riverFixture(x: number): MapGroundPoint[] {
  const top: number = -WORLD_DEPTH * HALF - MARGIN
  return Array.from(
    { length: RIVER_POINT_COUNT + 1 },
    (_, index: number): MapGroundPoint => ({
      x,
      z: top + ((WORLD_DEPTH + MARGIN * 2) * index) / RIVER_POINT_COUNT,
    }),
  )
}

function terrainFixture(river: readonly MapGroundPoint[]): MapTerrain {
  return {
    worldSize: { width: WORLD_WIDTH, depth: WORLD_DEPTH },
    marginX: MARGIN,
    marginZ: MARGIN,
    clearings: [],
    paths: [],
    river,
  }
}

function isOnTopBorder(placement: MountainPlacement): boolean {
  const topBorder: number = -WORLD_DEPTH * HALF - MARGIN
  return Math.abs(placement.position.z - topBorder) < CORNER_REACH
}

describe('placeMountains', () => {
  const terrain: MapTerrain = terrainFixture(riverFixture(RIVER_SOURCE_X))
  const mountains: MountainPlacement[] = placeMountains(
    terrain,
    SEED,
    MODEL_COUNT,
  )
  const topBorder: number = -WORLD_DEPTH * HALF - MARGIN
  const leftBorder: number = -WORLD_WIDTH * HALF - MARGIN
  const rightBorder: number = WORLD_WIDTH * HALF + MARGIN

  it('stands every mountain on the top border of the map', () => {
    expect(mountains.length).toBeGreaterThan(0)
    for (const mountain of mountains) {
      expect(isOnTopBorder(mountain)).toBe(true)
    }
  })

  it('reaches the top-left and top-right corners', () => {
    expect(
      mountains.some(
        (mountain: MountainPlacement): boolean =>
          Math.hypot(
            mountain.position.x - leftBorder,
            mountain.position.z - topBorder,
          ) < CORNER_REACH,
      ),
    ).toBe(true)
    expect(
      mountains.some(
        (mountain: MountainPlacement): boolean =>
          Math.hypot(
            mountain.position.x - rightBorder,
            mountain.position.z - topBorder,
          ) < CORNER_REACH,
      ),
    ).toBe(true)
  })

  it('uses every mountain model', () => {
    const modelIndexes: Set<number> = new Set<number>(
      mountains.map(
        (mountain: MountainPlacement): number => mountain.modelIndex,
      ),
    )
    expect(modelIndexes.size).toBe(MODEL_COUNT)
  })
})
