import type { MapTerrain } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * Where the mountains stand: a range along the top border of the whole map
 * (playable woodland plus its margin), left corner to right corner.
 */
export type MountainPlacement = {
  position: MapGroundPoint
  /** Turn around the vertical, radians: 0 faces the viewer (+z). */
  rotation: number
  /** Size multiplier of `MOUNTAIN_WIDTH`, so the range is not a row of clones. */
  scale: number
  /** Which of the mountain models stands here. */
  modelIndex: number
}

/** Side to side, world units, at scale 1. */
export const MOUNTAIN_WIDTH = 20
/** Centre to centre along the range: less than a width, so they overlap. */
const MOUNTAIN_SPACING = 13
const MINIMUM_SCALE = 0.85
const SCALE_SPREAD = 0.35
const ROTATION_JITTER_RADIANS = 0.35
const HALF = 0.5

/** The line the range follows: top-left to top-right of the full map. */
function rangeLine(terrain: MapTerrain): MapGroundPoint[] {
  const halfWidth: number = terrain.worldSize.width * HALF + terrain.marginX
  const halfDepth: number = terrain.worldSize.depth * HALF + terrain.marginZ
  const top: number = -halfDepth
  return [
    { x: -halfWidth, z: top },
    { x: halfWidth, z: top },
  ]
}

type RangeStop = {
  position: MapGroundPoint
  /** Faces away from the outside of the line, into the woodland. */
  rotation: number
}

/** A stop every `MOUNTAIN_SPACING` along the line, corners included. */
function rangeStops(line: readonly MapGroundPoint[]): RangeStop[] {
  const stops: RangeStop[] = []
  for (let index = 1; index < line.length; index += 1) {
    const start: MapGroundPoint | undefined = line[index - 1]
    const end: MapGroundPoint | undefined = line[index]
    if (start === undefined || end === undefined) {
      continue
    }
    const length: number = Math.hypot(end.x - start.x, end.z - start.z)
    const rotation: number = -Math.atan2(end.z - start.z, end.x - start.x)
    const stepCount: number = Math.round(length / MOUNTAIN_SPACING)
    // Each segment leaves its last stop to the next one, but the last segment.
    const lastStep: number =
      index === line.length - 1 ? stepCount : stepCount - 1
    for (let step = 0; step <= lastStep; step += 1) {
      const along: number = step / stepCount
      stops.push({
        position: {
          x: start.x + (end.x - start.x) * along,
          z: start.z + (end.z - start.z) * along,
        },
        rotation,
      })
    }
  }
  return stops
}

export function placeMountains(
  terrain: MapTerrain,
  seed: number,
  modelCount: number,
): MountainPlacement[] {
  const random: () => number = createSeededRandom(seed)
  return rangeStops(rangeLine(terrain)).map(
    (stop: RangeStop, index: number): MountainPlacement => ({
      position: stop.position,
      rotation: stop.rotation + (random() - HALF) * 2 * ROTATION_JITTER_RADIANS,
      scale: MINIMUM_SCALE + random() * SCALE_SPREAD,
      modelIndex: index % modelCount,
    }),
  )
}
