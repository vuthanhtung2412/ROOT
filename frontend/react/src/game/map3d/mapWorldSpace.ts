/**
 * World space of the 3D map: the woodland lies on the ground (y = 0),
 * centred on the origin, x to the right and z towards the viewer.
 */

/** World units across the playable woodland, left edge to right edge. */
export const MAP_WORLD_WIDTH = 100

const MAP_CENTER_RATIO = 0.5
/**
 * The woodland is as deep as the part of the screen it is shown in: a tall
 * map area gets a deep woodland, a wide one a shallow woodland.
 */
const MINIMUM_DEPTH_RATIO = 0.6
const MAXIMUM_DEPTH_RATIO = 1.15
/** The turn banner and the hand cover the top and bottom of the map area. */
const VIEW_HEIGHT_FOR_MAP_RATIO = 0.86
/** Steps of the shape, so dragging a window edge does not rebuild each pixel. */
const DEPTH_RATIO_STEP = 0.05

export type MapViewSize = {
  width: number
  height: number
}

/**
 * The view the map is drawn in, and its focus: the part of it, centred,
 * that the playable woodland must fit (the rest lies under the HUD).
 */
export type MapViewFrame = {
  view: MapViewSize
  focus: MapViewSize
  /**
   * Pixels the focus centre sits right of the view centre (negative: left),
   * for a HUD that covers more of one side than of the other.
   */
  focusOffsetX: number
}

export type MapWorldSize = {
  width: number
  depth: number
}

/** A point of the clearing layout: 0..1 from the left / top edge. */
export type NormalizedMapPoint = {
  x: number
  y: number
}

/** A point on the ground of the 3D scene. */
export type MapGroundPoint = {
  x: number
  z: number
}

export function mapWorldSizeForView(viewSize: MapViewSize): MapWorldSize {
  const viewRatio: number =
    (viewSize.height * VIEW_HEIGHT_FOR_MAP_RATIO) / viewSize.width
  const depthRatio: number = Math.min(
    Math.max(
      Math.round(viewRatio / DEPTH_RATIO_STEP) * DEPTH_RATIO_STEP,
      MINIMUM_DEPTH_RATIO,
    ),
    MAXIMUM_DEPTH_RATIO,
  )
  return { width: MAP_WORLD_WIDTH, depth: MAP_WORLD_WIDTH * depthRatio }
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

export function groundDistance(
  left: MapGroundPoint,
  right: MapGroundPoint,
): number {
  return Math.hypot(left.x - right.x, left.z - right.z)
}

/** Distance from a point to the segment between two ground points. */
export function distanceToSegment(
  point: MapGroundPoint,
  start: MapGroundPoint,
  end: MapGroundPoint,
): number {
  const segmentX: number = end.x - start.x
  const segmentZ: number = end.z - start.z
  const lengthSquared: number = segmentX * segmentX + segmentZ * segmentZ
  if (lengthSquared === 0) {
    return groundDistance(point, start)
  }
  const along: number = Math.min(
    Math.max(
      ((point.x - start.x) * segmentX + (point.z - start.z) * segmentZ) /
        lengthSquared,
      0,
    ),
    1,
  )
  return groundDistance(point, {
    x: start.x + segmentX * along,
    z: start.z + segmentZ * along,
  })
}
