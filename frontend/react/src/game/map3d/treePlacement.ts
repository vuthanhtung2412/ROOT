import type { ClearingLayoutPoint } from '#game/boardLayout.ts'
import type {
  MapNaturalSize,
  NormalizedMapPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Where the 3D trees stand: read off the map art, so a pine grows where a
 * pine is painted and paths, rivers and clearings stay open.
 */

export type RgbColor = {
  red: number
  green: number
  blue: number
}

export type TreeKind = 'pine' | 'leafy'

export type TreePlacement = {
  kind: TreeKind
  position: NormalizedMapPoint
  /** Size multiplier, so the forest is not a wall of clones. */
  scale: number
  /** Turn around the trunk, radians. */
  rotation: number
}

/** Colour of the map art at a point (0..1 from the left / top edge). */
export type MapColorSampler = (point: NormalizedMapPoint) => RgbColor

export type TreePlacementInput = {
  sampleColor: MapColorSampler
  mapNaturalSize: MapNaturalSize
  clearings: readonly ClearingLayoutPoint[]
  /** Trees per map width; rows follow from the map shape. */
  columnCount: number
  seed: number
}

/** Painted pines are dark and never redder than green. */
const PINE_MAXIMUM_BRIGHTNESS = 100
/** Painted leafy crowns are bright and clearly more green than blue. */
const LEAFY_MINIMUM_BRIGHTNESS = 105
const LEAFY_MINIMUM_GREEN_OVER_BLUE = 40
const COLOR_CHANNEL_COUNT = 3

/** Pieces stand in the middle of a clearing: keep that part free of trees. */
const CLEARING_TREE_FREE_RADIUS_RATIO = 0.8
/** Leafy trees are sparser in the art than the pine carpet. */
const LEAFY_KEEP_PROBABILITY = 0.35
/** The score track and its border are not woodland. */
const SCORE_TRACK_TOP_RATIO = 0.925

const MINIMUM_TREE_SCALE = 0.75
const TREE_SCALE_SPREAD = 0.6
const FULL_TURN_RADIANS = Math.PI * 2
const CELL_CENTER_OFFSET = 0.5

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

export function treeKindForColor(color: RgbColor): TreeKind | null {
  const brightness: number =
    (color.red + color.green + color.blue) / COLOR_CHANNEL_COUNT
  if (color.green < color.red) {
    return null
  }
  if (brightness <= PINE_MAXIMUM_BRIGHTNESS && color.green >= color.blue) {
    return 'pine'
  }
  if (
    brightness >= LEAFY_MINIMUM_BRIGHTNESS &&
    color.green - color.blue >= LEAFY_MINIMUM_GREEN_OVER_BLUE
  ) {
    return 'leafy'
  }
  return null
}

function isInsideClearing(
  point: NormalizedMapPoint,
  input: TreePlacementInput,
): boolean {
  const shorterSide: number = Math.min(
    input.mapNaturalSize.width,
    input.mapNaturalSize.height,
  )
  return input.clearings.some((clearing: ClearingLayoutPoint): boolean => {
    const distanceX: number =
      (point.x - clearing.x) * input.mapNaturalSize.width
    const distanceY: number =
      (point.y - clearing.y) * input.mapNaturalSize.height
    const freeRadius: number =
      clearing.r * shorterSide * CLEARING_TREE_FREE_RADIUS_RATIO
    return Math.hypot(distanceX, distanceY) < freeRadius
  })
}

/** One candidate per grid cell, jittered inside the cell. */
export function placeTrees(input: TreePlacementInput): TreePlacement[] {
  const random: () => number = createSeededRandom(input.seed)
  const rowCount: number = Math.round(
    (input.columnCount * input.mapNaturalSize.height) /
      input.mapNaturalSize.width,
  )
  const placements: TreePlacement[] = []
  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < input.columnCount; column += 1) {
      const position: NormalizedMapPoint = {
        x: (column + CELL_CENTER_OFFSET + (random() - CELL_CENTER_OFFSET)) /
          input.columnCount,
        y: (row + CELL_CENTER_OFFSET + (random() - CELL_CENTER_OFFSET)) /
          rowCount,
      }
      const scale: number = MINIMUM_TREE_SCALE + random() * TREE_SCALE_SPREAD
      const rotation: number = random() * FULL_TURN_RADIANS
      const keepRoll: number = random()
      if (position.y >= SCORE_TRACK_TOP_RATIO) {
        continue
      }
      const kind: TreeKind | null = treeKindForColor(
        input.sampleColor(position),
      )
      if (kind === null || isInsideClearing(position, input)) {
        continue
      }
      if (kind === 'leafy' && keepRoll > LEAFY_KEEP_PROBABILITY) {
        continue
      }
      placements.push({ kind, position, scale, rotation })
    }
  }
  return placements
}
