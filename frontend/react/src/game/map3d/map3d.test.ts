import { describe, expect, it } from 'vitest'
import type { ClearingLayoutPoint } from '#game/boardLayout.ts'
import {
  MAP_WORLD_WIDTH,
  mapWorldSize,
  normalizedRadiusToWorld,
  normalizedToGround,
  type MapNaturalSize,
  type MapWorldSize,
  type NormalizedMapPoint,
} from '#game/map3d/mapWorldSpace.ts'
import {
  placeTrees,
  treeKindForColor,
  type MapColorSampler,
  type RgbColor,
  type TreePlacement,
  type TreePlacementInput,
} from '#game/map3d/treePlacement.ts'

const PINE_COLOR: RgbColor = { red: 60, green: 80, blue: 60 }
const LEAFY_COLOR: RgbColor = { red: 128, green: 157, blue: 80 }
const PATH_COLOR: RgbColor = { red: 182, green: 166, blue: 135 }
const ROCK_COLOR: RgbColor = { red: 88, green: 78, blue: 70 }
const RIVER_COLOR: RgbColor = { red: 154, green: 185, blue: 180 }

const WIDE_MAP: MapNaturalSize = { width: 2000, height: 1000 }
const MAP_MIDDLE = 0.5

function makeUniformSampler(color: RgbColor): MapColorSampler {
  return (): RgbColor => color
}

/** Pines on the left half of the map, open path on the right half. */
function makeHalfForestSampler(): MapColorSampler {
  return (point: NormalizedMapPoint): RgbColor =>
    point.x < MAP_MIDDLE ? PINE_COLOR : PATH_COLOR
}

function makeClearing(
  overrides: Partial<ClearingLayoutPoint> = {},
): ClearingLayoutPoint {
  return { x: 0.25, y: 0.5, r: 0.2, ...overrides }
}

function makePlacementInput(
  overrides: Partial<TreePlacementInput> = {},
): TreePlacementInput {
  return {
    sampleColor: makeUniformSampler(PINE_COLOR),
    mapNaturalSize: WIDE_MAP,
    clearings: [],
    columnCount: 20,
    seed: 7,
    ...overrides,
  }
}

describe('mapWorldSpace', () => {
  it('keeps the map shape and centres it on the origin', () => {
    const worldSize: MapWorldSize = mapWorldSize(WIDE_MAP)
    expect(worldSize).toEqual({
      width: MAP_WORLD_WIDTH,
      depth: MAP_WORLD_WIDTH / 2,
    })
    expect(normalizedToGround({ x: 0.5, y: 0.5 }, worldSize)).toEqual({
      x: 0,
      z: 0,
    })
    expect(normalizedToGround({ x: 0, y: 1 }, worldSize)).toEqual({
      x: -MAP_WORLD_WIDTH / 2,
      z: MAP_WORLD_WIDTH / 4,
    })
  })

  it('sizes a clearing against the shorter map side', () => {
    expect(normalizedRadiusToWorld(0.1, mapWorldSize(WIDE_MAP))).toBeCloseTo(
      (MAP_WORLD_WIDTH / 2) * 0.1,
    )
  })
})

describe('treeKindForColor', () => {
  it('reads the painted colours of the Autumn map', () => {
    expect(treeKindForColor(PINE_COLOR)).toBe('pine')
    expect(treeKindForColor(LEAFY_COLOR)).toBe('leafy')
    expect(treeKindForColor(PATH_COLOR)).toBeNull()
    expect(treeKindForColor(ROCK_COLOR)).toBeNull()
    expect(treeKindForColor(RIVER_COLOR)).toBeNull()
  })
})

describe('placeTrees', () => {
  it('grows pines only where pines are painted', () => {
    const placements: TreePlacement[] = placeTrees(
      makePlacementInput({ sampleColor: makeHalfForestSampler() }),
    )
    expect(placements.length).toBeGreaterThan(0)
    expect(
      placements.every(
        (placement: TreePlacement): boolean =>
          placement.kind === 'pine' && placement.position.x < MAP_MIDDLE,
      ),
    ).toBe(true)
  })

  it('leaves the middle of a clearing free for the pieces', () => {
    const clearing: ClearingLayoutPoint = makeClearing()
    const placements: TreePlacement[] = placeTrees(
      makePlacementInput({ clearings: [clearing] }),
    )
    const clearingCenterDistances: number[] = placements.map(
      (placement: TreePlacement): number =>
        Math.hypot(
          (placement.position.x - clearing.x) * WIDE_MAP.width,
          (placement.position.y - clearing.y) * WIDE_MAP.height,
        ),
    )
    const clearingRadiusPixels: number = clearing.r * WIDE_MAP.height
    expect(Math.min(...clearingCenterDistances)).toBeGreaterThan(
      clearingRadiusPixels / 2,
    )
  })

  it('is the same forest for the same seed', () => {
    expect(placeTrees(makePlacementInput())).toEqual(
      placeTrees(makePlacementInput()),
    )
    expect(placeTrees(makePlacementInput({ seed: 8 }))).not.toEqual(
      placeTrees(makePlacementInput()),
    )
  })

  it('thins out leafy trees and keeps the score track bare', () => {
    const pines: TreePlacement[] = placeTrees(makePlacementInput())
    const leafyTrees: TreePlacement[] = placeTrees(
      makePlacementInput({ sampleColor: makeUniformSampler(LEAFY_COLOR) }),
    )
    expect(leafyTrees.length).toBeLessThan(pines.length)
    expect(
      pines.every(
        (placement: TreePlacement): boolean => placement.position.y < 0.925,
      ),
    ).toBe(true)
  })
})
