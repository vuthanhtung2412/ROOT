import type { MapTerrain, PathGround } from '#game/map3d/mapTerrain.ts'
import {
  distanceToSegment,
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Where the trees stand: pines carpet the woodland, clearings, paths and the
 * river stay open, and leafy trees gather round clearings and along the water.
 */
export type TreeKind = 'pine' | 'leafy'

export type TreePlacement = {
  kind: TreeKind
  position: MapGroundPoint
  /** Size multiplier, so the forest is not a wall of clones. */
  scale: number
  /** Turn around the trunk, radians. */
  rotation: number
}

/** Distance between neighbouring trees, before jitter. */
const TREE_SPACING = 1.3
/** A few gaps keep the carpet from looking combed. */
const PINE_KEEP_PROBABILITY = 0.93
const PATH_FREE_HALF_WIDTH = 2.6
const RIVER_FREE_HALF_WIDTH = 3.1
/** Leafy trees stand in this band round a clearing (ratios of its radius). */
const CLEARING_RIM_OUTER_RATIO = 1.3
const RIM_LEAFY_PROBABILITY = 0.4
/** … and in this band along the river bank. */
const RIVER_BANK_OUTER_DISTANCE = 4.6
const BANK_LEAFY_PROBABILITY = 0.3

const MINIMUM_TREE_SCALE = 0.75
const TREE_SCALE_SPREAD = 0.6
const FULL_TURN_RADIANS = Math.PI * 2
const HALF = 0.5

const UINT32_RANGE = 4294967296
const MULBERRY_INCREMENT = 0x6d2b79f5

/** Small seeded generator (mulberry32): same seed, same forest. */
export function createSeededRandom(seed: number): () => number {
  let state: number = seed >>> 0
  return (): number => {
    state = (state + MULBERRY_INCREMENT) >>> 0
    let mixed: number = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE
  }
}

function distanceToRiver(point: MapGroundPoint, terrain: MapTerrain): number {
  let nearest: number = Number.POSITIVE_INFINITY
  for (let index = 1; index < terrain.river.length; index += 1) {
    const start: MapGroundPoint | undefined = terrain.river[index - 1]
    const end: MapGroundPoint | undefined = terrain.river[index]
    if (start !== undefined && end !== undefined) {
      nearest = Math.min(nearest, distanceToSegment(point, start, end))
    }
  }
  return nearest
}

/** What may grow at a point: nothing, a pine, or a leafy tree. */
function treeKindAt(
  point: MapGroundPoint,
  terrain: MapTerrain,
  roll: number,
): TreeKind | null {
  let onClearingRim = false
  for (const clearing of terrain.clearings) {
    const distance: number = groundDistance(point, clearing.center)
    if (distance < clearing.radius) {
      return null
    }
    if (distance < clearing.radius * CLEARING_RIM_OUTER_RATIO) {
      onClearingRim = true
    }
  }
  const onPath: boolean = terrain.paths.some(
    (path: PathGround): boolean =>
      distanceToSegment(point, path.start, path.end) < PATH_FREE_HALF_WIDTH,
  )
  if (onPath) {
    return null
  }
  const riverDistance: number = distanceToRiver(point, terrain)
  if (riverDistance < RIVER_FREE_HALF_WIDTH) {
    return null
  }
  if (onClearingRim) {
    return roll < RIM_LEAFY_PROBABILITY ? 'leafy' : null
  }
  if (riverDistance < RIVER_BANK_OUTER_DISTANCE) {
    return roll < BANK_LEAFY_PROBABILITY ? 'leafy' : 'pine'
  }
  return roll < PINE_KEEP_PROBABILITY ? 'pine' : null
}

/** One candidate per grid cell, jittered inside the cell. */
export function placeTrees(terrain: MapTerrain, seed: number): TreePlacement[] {
  const random: () => number = createSeededRandom(seed)
  const halfWidth: number = terrain.worldSize.width * HALF + terrain.margin
  const halfDepth: number = terrain.worldSize.depth * HALF + terrain.margin
  const placements: TreePlacement[] = []
  for (let z = -halfDepth; z < halfDepth; z += TREE_SPACING) {
    for (let x = -halfWidth; x < halfWidth; x += TREE_SPACING) {
      const position: MapGroundPoint = {
        x: x + random() * TREE_SPACING,
        z: z + random() * TREE_SPACING,
      }
      const scale: number = MINIMUM_TREE_SCALE + random() * TREE_SCALE_SPREAD
      const rotation: number = random() * FULL_TURN_RADIANS
      const kind: TreeKind | null = treeKindAt(position, terrain, random())
      if (kind !== null) {
        placements.push({ kind, position, scale, rotation })
      }
    }
  }
  return placements
}
