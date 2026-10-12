import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Shape of a forest on the ground: its corners are the clearings round it,
 * its sides the paths between them.
 */
export type ForestGround = {
  forestIndex: number
  corners: readonly MapGroundPoint[]
}

export type ForestSide = {
  start: MapGroundPoint
  end: MapGroundPoint
}

/** The closed outline, corner to corner. */
export function forestSides(forest: ForestGround): ForestSide[] {
  return forest.corners.flatMap(
    (start: MapGroundPoint, index: number): ForestSide[] => {
      const end: MapGroundPoint | undefined =
        forest.corners[(index + 1) % forest.corners.length]
      return end === undefined ? [] : [{ start, end }]
    },
  )
}

/** Radius of the clearing a corner sits on; 0 where there is none. */
function clearingRadiusAt(
  corner: MapGroundPoint,
  clearings: readonly ClearingGround[],
): number {
  const clearing: ClearingGround | undefined = clearings.find(
    (candidate: ClearingGround): boolean =>
      groundDistance(candidate.center, corner) < candidate.radius,
  )
  return clearing?.radius ?? 0
}

/**
 * The sides as the paths show them: each from the rim of the clearing at
 * one end to the rim of the clearing at the other. A side its clearings
 * swallow whole is left out.
 */
export function forestPathSides(
  forest: ForestGround,
  clearings: readonly ClearingGround[],
): ForestSide[] {
  return forestSides(forest).flatMap((side: ForestSide): ForestSide[] => {
    const length: number = groundDistance(side.start, side.end)
    const startCut: number = clearingRadiusAt(side.start, clearings)
    const endCut: number = clearingRadiusAt(side.end, clearings)
    if (length <= startCut + endCut) {
      return []
    }
    const alongX: number = (side.end.x - side.start.x) / length
    const alongZ: number = (side.end.z - side.start.z) / length
    return [
      {
        start: {
          x: side.start.x + alongX * startCut,
          z: side.start.z + alongZ * startCut,
        },
        end: {
          x: side.end.x - alongX * endCut,
          z: side.end.z - alongZ * endCut,
        },
      },
    ]
  })
}

/** Even-odd rule: a line from the point crosses the outline an odd number of times. */
export function isInsideForest(
  point: MapGroundPoint,
  forest: ForestGround,
): boolean {
  const crossings: number = forestSides(forest).filter(
    (side: ForestSide): boolean =>
      side.start.z > point.z !== side.end.z > point.z &&
      point.x <
        ((side.end.x - side.start.x) * (point.z - side.start.z)) /
          (side.end.z - side.start.z) +
          side.start.x,
  ).length
  return crossings % 2 === 1
}
