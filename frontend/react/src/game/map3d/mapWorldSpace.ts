/**
 * World space of the 3D map: the painted map lies flat on the ground (y = 0),
 * centred on the origin, x to the right and z towards the viewer.
 */

/** World units across the map, left edge to right edge. */
export const MAP_WORLD_WIDTH = 100

const MAP_CENTER_RATIO = 0.5

export type MapNaturalSize = {
  width: number
  height: number
}

export type MapWorldSize = {
  width: number
  depth: number
}

/** A point on the map art: 0..1 from the left / top edge. */
export type NormalizedMapPoint = {
  x: number
  y: number
}

/** A point on the ground of the 3D scene. */
export type MapGroundPoint = {
  x: number
  z: number
}

export function mapWorldSize(naturalSize: MapNaturalSize): MapWorldSize {
  return {
    width: MAP_WORLD_WIDTH,
    depth: (MAP_WORLD_WIDTH * naturalSize.height) / naturalSize.width,
  }
}

export function normalizedToGround(
  point: NormalizedMapPoint,
  worldSize: MapWorldSize,
): MapGroundPoint {
  return {
    x: (point.x - MAP_CENTER_RATIO) * worldSize.width,
    z: (point.y - MAP_CENTER_RATIO) * worldSize.depth,
  }
}

/**
 * Clearing radius is a ratio of the shorter map side (same rule as the flat
 * map, see `layoutToPixelHitTargets`).
 */
export function normalizedRadiusToWorld(
  radiusRatio: number,
  worldSize: MapWorldSize,
): number {
  return radiusRatio * Math.min(worldSize.width, worldSize.depth)
}
