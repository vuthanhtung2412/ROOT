import { CatmullRomCurve3, Vector3 } from 'three'
import { FALL_PATHS } from '@root/lib/fall-metadata'
import type { BoardLayout, ClearingLayoutPoint } from '#game/boardLayout.ts'
import {
  mapWorldSizeForView,
  normalizedToGround,
  type MapGroundPoint,
  type MapViewFrame,
  type MapWorldSize,
  type NormalizedMapPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * The lie of the Autumn woodland, built from the game's own data: clearings
 * and paths from the layout, the river drawn through the clearings it links.
 * Nothing of the painted 2D map is used.
 */
export type ClearingGround = {
  clearingId: number
  center: MapGroundPoint
  radius: number
}

export type PathGround = {
  start: MapGroundPoint
  end: MapGroundPoint
}

export type MapTerrain = {
  worldSize: MapWorldSize
  /** How far the woodland runs on past the playable area, left and right. */
  marginX: number
  /** … and behind and in front. */
  marginZ: number
  clearings: readonly ClearingGround[]
  paths: readonly PathGround[]
  /** The river as a dense line of points, source to mouth. */
  river: readonly MapGroundPoint[]
}

/** Clearing radius in world units: room for three slots and three armies. */
const CLEARING_RADIUS = 5.8
/** Woodland past the playable area when the view shows nothing but it. */
const BASE_MARGIN_RATIO = 0.3
/**
 * Extra woodland per unit the view is larger than its focus (the map fills
 * the whole screen, the playable area only the middle of it). More than 0.5
 * a side, because the far edge of a tilted view takes in more ground.
 */
const COVER_MARGIN_RATIO = 0.95
const RIVER_POINT_COUNT = 220

/**
 * Course of the river (0..1 across the clearing layout). It runs through
 * clearings 4, 9, 10, 6 and 3 (`FALL_RIVERS`) and off both edges.
 */
const RIVER_COURSE: readonly NormalizedMapPoint[] = [
  { x: 0.62, y: -0.4 },
  { x: 0.585, y: -0.08 },
  { x: 0.548, y: 0.097 },
  { x: 0.5, y: 0.17 },
  { x: 0.437, y: 0.294 },
  { x: 0.5, y: 0.37 },
  { x: 0.6, y: 0.4 },
  { x: 0.645, y: 0.497 },
  { x: 0.6, y: 0.6 },
  { x: 0.583, y: 0.78 },
  { x: 0.47, y: 0.74 },
  { x: 0.35, y: 0.7 },
  { x: 0.22, y: 0.74 },
  { x: 0.104, y: 0.819 },
  { x: -0.08, y: 0.9 },
  { x: -0.4, y: 0.95 },
]

function riverGround(worldSize: MapWorldSize): MapGroundPoint[] {
  const curve: CatmullRomCurve3 = new CatmullRomCurve3(
    RIVER_COURSE.map((point: NormalizedMapPoint): Vector3 => {
      const ground: MapGroundPoint = normalizedToGround(point, worldSize)
      return new Vector3(ground.x, 0, ground.z)
    }),
  )
  return curve
    .getPoints(RIVER_POINT_COUNT)
    .map((point: Vector3): MapGroundPoint => ({ x: point.x, z: point.z }))
}

export function createMapTerrain(
  layout: BoardLayout,
  frame: MapViewFrame,
): MapTerrain {
  const worldSize: MapWorldSize = mapWorldSizeForView(frame.focus)
  const clearings: ClearingGround[] = Object.entries(layout.clearings).map(
    ([clearingId, point]: [string, ClearingLayoutPoint]): ClearingGround => ({
      clearingId: Number(clearingId),
      center: normalizedToGround(point, worldSize),
      radius: CLEARING_RADIUS,
    }),
  )
  const centerById: Map<number, MapGroundPoint> = new Map<
    number,
    MapGroundPoint
  >(
    clearings.map((clearing: ClearingGround): [number, MapGroundPoint] => [
      clearing.clearingId,
      clearing.center,
    ]),
  )
  const paths: PathGround[] = FALL_PATHS.flatMap(
    ([left, right]: readonly [number, number]): PathGround[] => {
      const start: MapGroundPoint | undefined = centerById.get(left)
      const end: MapGroundPoint | undefined = centerById.get(right)
      return start === undefined || end === undefined ? [] : [{ start, end }]
    },
  )
  return {
    worldSize,
    marginX:
      worldSize.width *
      (BASE_MARGIN_RATIO +
        (frame.view.width / frame.focus.width - 1) * COVER_MARGIN_RATIO),
    marginZ:
      worldSize.depth *
      (BASE_MARGIN_RATIO +
        (frame.view.height / frame.focus.height - 1) * COVER_MARGIN_RATIO),
    clearings,
    paths,
    river: riverGround(worldSize),
  }
}
