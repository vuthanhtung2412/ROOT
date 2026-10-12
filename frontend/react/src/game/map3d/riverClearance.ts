import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Keeps building slots on dry land: a slot whose spot falls in the river is
 * moved to the nearest free spot of its clearing, clear of the water and of
 * the slots already laid out.
 */
export type SlotSite = {
  clearing: ClearingGround
  /** The river as a dense line of points, source to mouth. */
  river: readonly MapGroundPoint[]
}

/** Centre of a slot to the middle of the river: half the water, half a plot. */
const RIVER_CLEARANCE = 2.8
/** Centres of two slots, so their plots do not overlap. */
const SLOT_MINIMUM_SPACING = 2.3
/** Slots stay this far inside the clearing (ratio of its radius). */
const SLOT_REACH_RATIO = 0.85
/** Grid the free spots are searched on. */
const SEARCH_STEP = 0.3
/** River points further than this from the clearing cannot matter. */
const RIVER_REACH_RATIO = 2

function isFree(
  ground: MapGroundPoint,
  river: readonly MapGroundPoint[],
  taken: readonly MapGroundPoint[],
): boolean {
  return (
    river.every(
      (point: MapGroundPoint): boolean =>
        groundDistance(ground, point) >= RIVER_CLEARANCE,
    ) &&
    taken.every(
      (slot: MapGroundPoint): boolean =>
        groundDistance(ground, slot) >= SLOT_MINIMUM_SPACING,
    )
  )
}

/** Spots of the back half of the clearing (the front is for the armies). */
function backHalfGrounds(clearing: ClearingGround): MapGroundPoint[] {
  const reach: number = clearing.radius * SLOT_REACH_RATIO
  const stepCount: number = Math.floor(reach / SEARCH_STEP)
  const grounds: MapGroundPoint[] = []
  for (let stepX = -stepCount; stepX <= stepCount; stepX += 1) {
    for (let stepZ = -stepCount; stepZ <= 0; stepZ += 1) {
      const ground: MapGroundPoint = {
        x: clearing.center.x + stepX * SEARCH_STEP,
        z: clearing.center.z + stepZ * SEARCH_STEP,
      }
      if (groundDistance(ground, clearing.center) <= reach) {
        grounds.push(ground)
      }
    }
  }
  return grounds
}

/**
 * `desired` when it is dry and free, else the nearest free spot of the
 * clearing. `taken` are the slots already laid out in this clearing.
 */
export function groundClearOfRiver(
  desired: MapGroundPoint,
  site: SlotSite,
  taken: readonly MapGroundPoint[],
): MapGroundPoint {
  const river: MapGroundPoint[] = site.river.filter(
    (point: MapGroundPoint): boolean =>
      groundDistance(point, site.clearing.center) <=
      site.clearing.radius * RIVER_REACH_RATIO,
  )
  if (isFree(desired, river, taken)) {
    return desired
  }
  return backHalfGrounds(site.clearing)
    .filter((ground: MapGroundPoint): boolean => isFree(ground, river, taken))
    .reduce(
      (nearest: MapGroundPoint | null, ground: MapGroundPoint) =>
        nearest === null ||
        groundDistance(ground, desired) < groundDistance(nearest, desired)
          ? ground
          : nearest,
      null,
    ) ?? desired
}
