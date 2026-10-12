import type { ClearingGround, PathGround } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * The small stuff that gives the woodland floor its texture: leaf litter and
 * moss under the trees, trodden dirt, pebbles and grass tufts in the
 * clearings, ruts and hand-laid stones along the paths, ripples and bank
 * pebbles on the river. All painted, all from the same seeded dice.
 */
export type CanvasPoint = {
  x: number
  y: number
}

export type GroundBrush = {
  context: CanvasRenderingContext2D
  /** Canvas pixels per world unit. */
  scale: number
  random: () => number
  toCanvas: (ground: MapGroundPoint) => CanvasPoint
}

export type GroundBounds = {
  halfWidth: number
  halfDepth: number
}

type Dab = {
  center: MapGroundPoint
  radius: number
  color: string
  opacity: number
}

const FULL_TURN_RADIANS = Math.PI * 2
const HALF = 0.5

const MOSS_COLORS: readonly string[] = ['#4f5a3e', '#3a4234', '#5c6447']
const MOSS_DENSITY = 0.14
const LITTER_COLORS: readonly string[] = [
  '#6e3a30',
  '#7d6a46',
  '#5a4c36',
  '#353b2c',
  '#6c7350',
]
const LITTER_DENSITY = 1.6

const DIRT_COLORS: readonly string[] = ['#9c9474', '#c2ba9a', '#a8a080']
const DIRT_DABS_PER_CLEARING = 110
const PEBBLE_COLORS: readonly string[] = ['#dcd9c8', '#9c9884', '#c4c0ac']
const PEBBLE_OUTLINE_COLOR = '#5f5b4a'
const PEBBLES_PER_CLEARING = 14
const GRASS_COLORS: readonly string[] = ['#5f7350', '#748764', '#4f6246']
const GRASS_TUFTS_PER_CLEARING = 90
const GRASS_BLADE_COUNT = 4
const GRASS_BLADE_LENGTH = 0.55
const GRASS_BLADE_WIDTH = 0.09
/** Grass grows in from the edge of the sand, this far in (ratio of radius). */
const GRASS_INNER_RADIUS_RATIO = 0.78
const GRASS_OUTER_RADIUS_RATIO = 1.1

const PATH_HALF_WIDTH = 0.9
const PATH_PEBBLES_PER_UNIT = 4
/** Specks of the dirt itself: the path stays dirt, only its stones are pale. */
const PATH_PEBBLE_COLORS: readonly string[] = [
  '#858066',
  '#9a9478',
  '#8a846a',
  '#a39d80',
  '#7d785f',
]
const PATH_PEBBLE_SHADOW_COLOR = '#6a664f'
const PATH_PEBBLE_SHADOW_OFFSET = 0.03
const PATH_PEBBLE_MINIMUM_RADIUS = 0.06
const PATH_PEBBLE_RADIUS_SPREAD = 0.1
const PATH_STONE_SPACING = 0.42
const PATH_STONE_JITTER = 0.1
/** Stones lie this far either side of the middle of the path. */
const PATH_STONE_SIDE_SPREAD = 0.3
/** A stone is a slab with rounded corners, laid roughly along the path. */
const PATH_STONE_MINIMUM_LENGTH = 0.3
const PATH_STONE_LENGTH_SPREAD = 0.16
const PATH_STONE_MINIMUM_WIDTH = 0.2
const PATH_STONE_WIDTH_SPREAD = 0.1
/** Corner radius of a slab, as a share of its width. */
const PATH_STONE_CORNER_RATIO = 0.38
/** How far a slab may turn off the line of the path, radians. */
const PATH_STONE_MAXIMUM_TURN = 0.4
const PATH_STONE_SHADOW_COLOR = '#6a664f'
const PATH_STONE_SHADOW_OPACITY = 0.8
const PATH_STONE_SHADOW_OFFSET = 0.05

const RIVER_HALF_WIDTH = 1.4
const RIVER_BANK_PEBBLE_STEP = 3
const RIVER_RIPPLE_COLOR = '#e3f5f6'
const RIVER_RIPPLE_WIDTH = 0.12
const RIVER_RIPPLE_OFFSETS: readonly number[] = [-0.85, -0.25, 0.3, 0.9]
const RIVER_RIPPLE_LENGTH_POINTS = 5
const RIVER_RIPPLE_GAP_POINTS = 9
const RIVER_DEEP_COLOR = '#3f87a6'
const RIVER_DEEP_DAB_OPACITY = 0.22

function pick(brush: GroundBrush, colors: readonly string[]): string {
  return colors[Math.floor(brush.random() * colors.length)] ?? '#000000'
}

function dab(brush: GroundBrush, mark: Dab): void {
  const { context, scale } = brush
  const center: CanvasPoint = brush.toCanvas(mark.center)
  context.globalAlpha = mark.opacity
  context.fillStyle = mark.color
  context.beginPath()
  context.arc(center.x, center.y, mark.radius * scale, 0, FULL_TURN_RADIANS)
  context.fill()
  context.globalAlpha = 1
}

type SlabShape = {
  length: number
  width: number
  /** Turn of the slab on the canvas, radians. */
  turn: number
}

type Slab = {
  center: MapGroundPoint
  shape: SlabShape
  color: string
  opacity: number
}

/** A rectangle with rounded corners, turned its own way. */
function slab(brush: GroundBrush, mark: Slab): void {
  const { context, scale } = brush
  const center: CanvasPoint = brush.toCanvas(mark.center)
  const length: number = mark.shape.length * scale
  const width: number = mark.shape.width * scale
  context.save()
  context.translate(center.x, center.y)
  context.rotate(mark.shape.turn)
  context.globalAlpha = mark.opacity
  context.fillStyle = mark.color
  context.beginPath()
  context.roundRect(
    -length * HALF,
    -width * HALF,
    length,
    width,
    width * PATH_STONE_CORNER_RATIO,
  )
  context.fill()
  context.restore()
}

/** A point at a random spot of a disc, evenly spread over its area. */
function randomPointInRing(
  brush: GroundBrush,
  center: MapGroundPoint,
  ring: { innerRadius: number; outerRadius: number },
): MapGroundPoint {
  const angle: number = brush.random() * FULL_TURN_RADIANS
  const innerSquared: number = ring.innerRadius * ring.innerRadius
  const outerSquared: number = ring.outerRadius * ring.outerRadius
  const radius: number = Math.sqrt(
    innerSquared + brush.random() * (outerSquared - innerSquared),
  )
  return {
    x: center.x + Math.cos(angle) * radius,
    z: center.z + Math.sin(angle) * radius,
  }
}

/** Moss patches and leaf litter under the trees. */
export function paintForestFloorDetail(
  brush: GroundBrush,
  bounds: GroundBounds,
): void {
  const area: number = bounds.halfWidth * bounds.halfDepth * 4
  const randomSpot = (): MapGroundPoint => ({
    x: (brush.random() - HALF) * bounds.halfWidth * 2,
    z: (brush.random() - HALF) * bounds.halfDepth * 2,
  })
  for (let patch = 0; patch < area * MOSS_DENSITY; patch += 1) {
    dab(brush, {
      center: randomSpot(),
      radius: 0.8 + brush.random() * 3.4,
      color: pick(brush, MOSS_COLORS),
      opacity: 0.3,
    })
  }
  for (let leaf = 0; leaf < area * LITTER_DENSITY; leaf += 1) {
    dab(brush, {
      center: randomSpot(),
      radius: 0.07 + brush.random() * 0.16,
      color: pick(brush, LITTER_COLORS),
      opacity: 0.75,
    })
  }
}

function paintGrassTuft(brush: GroundBrush, root: MapGroundPoint): void {
  const { context, scale } = brush
  const start: CanvasPoint = brush.toCanvas(root)
  context.strokeStyle = pick(brush, GRASS_COLORS)
  context.lineWidth = GRASS_BLADE_WIDTH * scale
  context.lineCap = 'round'
  for (let blade = 0; blade < GRASS_BLADE_COUNT; blade += 1) {
    // Blades fan out upwards (towards the back of the map).
    const lean: number = (brush.random() - HALF) * 1.6
    const length: number =
      GRASS_BLADE_LENGTH * (0.6 + brush.random() * 0.7) * scale
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(start.x + Math.sin(lean) * length, start.y - length)
    context.stroke()
  }
}

/** Trodden dirt, pebbles, and grass creeping in from the edge. */
export function paintClearingDetail(
  brush: GroundBrush,
  clearing: ClearingGround,
): void {
  const whole: { innerRadius: number; outerRadius: number } = {
    innerRadius: 0,
    outerRadius: clearing.radius,
  }
  for (let index = 0; index < DIRT_DABS_PER_CLEARING; index += 1) {
    dab(brush, {
      center: randomPointInRing(brush, clearing.center, whole),
      radius: 0.3 + brush.random() * 1.1,
      color: pick(brush, DIRT_COLORS),
      opacity: 0.28,
    })
  }
  for (let index = 0; index < PEBBLES_PER_CLEARING; index += 1) {
    const center: MapGroundPoint = randomPointInRing(
      brush,
      clearing.center,
      whole,
    )
    const radius: number = 0.09 + brush.random() * 0.15
    dab(brush, {
      center: { x: center.x + 0.04, z: center.z + 0.05 },
      radius,
      color: PEBBLE_OUTLINE_COLOR,
      opacity: 0.7,
    })
    dab(brush, {
      center,
      radius,
      color: pick(brush, PEBBLE_COLORS),
      opacity: 1,
    })
  }
  for (let index = 0; index < GRASS_TUFTS_PER_CLEARING; index += 1) {
    paintGrassTuft(
      brush,
      randomPointInRing(brush, clearing.center, {
        innerRadius: clearing.radius * GRASS_INNER_RADIUS_RATIO,
        outerRadius: clearing.radius * GRASS_OUTER_RADIUS_RATIO,
      }),
    )
  }
}

/** A point of a path: `along` 0..1 from start to end, `aside` to its left. */
function pathPoint(
  path: PathGround,
  along: number,
  aside: number,
): MapGroundPoint {
  const length: number = groundDistance(path.start, path.end)
  const directionX: number = (path.end.x - path.start.x) / length
  const directionZ: number = (path.end.z - path.start.z) / length
  return {
    x: path.start.x + (path.end.x - path.start.x) * along - directionZ * aside,
    z: path.start.z + (path.end.z - path.start.z) * along + directionX * aside,
  }
}

/** Specks in the dirt of the path, each with a sliver of shadow. */
export function paintPathDetail(brush: GroundBrush, path: PathGround): void {
  const length: number = groundDistance(path.start, path.end)
  for (let index = 0; index < length * PATH_PEBBLES_PER_UNIT; index += 1) {
    const center: MapGroundPoint = pathPoint(
      path,
      brush.random(),
      (brush.random() - HALF) * PATH_HALF_WIDTH * 2,
    )
    const radius: number =
      PATH_PEBBLE_MINIMUM_RADIUS + brush.random() * PATH_PEBBLE_RADIUS_SPREAD
    dab(brush, {
      center: {
        x: center.x + PATH_PEBBLE_SHADOW_OFFSET,
        z: center.z + PATH_PEBBLE_SHADOW_OFFSET,
      },
      radius,
      color: PATH_PEBBLE_SHADOW_COLOR,
      opacity: 0.8,
    })
    dab(brush, {
      center,
      radius,
      color: pick(brush, PATH_PEBBLE_COLORS),
      opacity: 1,
    })
  }
}

/** The white stones down the middle of a path, laid one by one. */
export function paintPathStones(brush: GroundBrush, path: PathGround): void {
  const length: number = groundDistance(path.start, path.end)
  const stoneCount: number = Math.floor(length / PATH_STONE_SPACING)
  // On the canvas, x runs with the world's x and y with its z.
  const pathTurn: number = Math.atan2(
    path.end.z - path.start.z,
    path.end.x - path.start.x,
  )
  for (let stone = 1; stone < stoneCount; stone += 1) {
    const center: MapGroundPoint = pathPoint(
      path,
      stone / stoneCount + ((brush.random() - HALF) * PATH_STONE_JITTER) / length,
      (brush.random() - HALF) * PATH_STONE_SIDE_SPREAD * 2,
    )
    const shape: SlabShape = {
      length:
        PATH_STONE_MINIMUM_LENGTH + brush.random() * PATH_STONE_LENGTH_SPREAD,
      width:
        PATH_STONE_MINIMUM_WIDTH + brush.random() * PATH_STONE_WIDTH_SPREAD,
      turn:
        pathTurn + (brush.random() - HALF) * PATH_STONE_MAXIMUM_TURN * 2,
    }
    slab(brush, {
      center: {
        x: center.x + PATH_STONE_SHADOW_OFFSET,
        z: center.z + PATH_STONE_SHADOW_OFFSET,
      },
      shape,
      color: PATH_STONE_SHADOW_COLOR,
      opacity: PATH_STONE_SHADOW_OPACITY,
    })
    slab(brush, {
      center,
      shape,
      color: pick(brush, PEBBLE_COLORS),
      opacity: 1,
    })
  }
}

/** A point `aside` of the river line at one of its points. */
function riverPoint(
  river: readonly MapGroundPoint[],
  index: number,
  aside: number,
): MapGroundPoint | null {
  const here: MapGroundPoint | undefined = river[index]
  const next: MapGroundPoint | undefined = river[index + 1] ?? river[index - 1]
  if (here === undefined || next === undefined) {
    return null
  }
  const length: number = groundDistance(here, next)
  if (length === 0) {
    return here
  }
  return {
    x: here.x - ((next.z - here.z) / length) * aside,
    z: here.z + ((next.x - here.x) / length) * aside,
  }
}

/** Deeper pools, short ripples in several lanes, pebbles on both banks. */
export function paintRiverDetail(
  brush: GroundBrush,
  river: readonly MapGroundPoint[],
): void {
  const { context, scale } = brush
  for (let index = 0; index < river.length; index += 1) {
    const pool: MapGroundPoint | null = riverPoint(
      river,
      index,
      (brush.random() - HALF) * RIVER_HALF_WIDTH,
    )
    if (pool !== null) {
      dab(brush, {
        center: pool,
        radius: 0.5 + brush.random() * 0.9,
        color: RIVER_DEEP_COLOR,
        opacity: RIVER_DEEP_DAB_OPACITY,
      })
    }
    if (index % RIVER_BANK_PEBBLE_STEP === 0) {
      for (const side of [-1, 1]) {
        const bank: MapGroundPoint | null = riverPoint(
          river,
          index,
          side * (RIVER_HALF_WIDTH + brush.random() * 0.7),
        )
        if (bank !== null) {
          dab(brush, {
            center: bank,
            radius: 0.12 + brush.random() * 0.2,
            color: pick(brush, PEBBLE_COLORS),
            opacity: 0.95,
          })
        }
      }
    }
  }
  context.strokeStyle = RIVER_RIPPLE_COLOR
  context.lineWidth = RIVER_RIPPLE_WIDTH * scale
  context.lineCap = 'round'
  context.globalAlpha = 0.8
  const rippleStride: number = RIVER_RIPPLE_LENGTH_POINTS + RIVER_RIPPLE_GAP_POINTS
  RIVER_RIPPLE_OFFSETS.forEach((offset: number, lane: number): void => {
    // Each lane starts its ripples at a different point of the river.
    const firstIndex: number = Math.floor(
      (lane * rippleStride) / RIVER_RIPPLE_OFFSETS.length,
    )
    for (let index = firstIndex; index < river.length; index += rippleStride) {
      context.beginPath()
      for (let step = 0; step <= RIVER_RIPPLE_LENGTH_POINTS; step += 1) {
        const point: MapGroundPoint | null = riverPoint(
          river,
          index + step,
          offset,
        )
        if (point === null) {
          continue
        }
        const canvasPoint: CanvasPoint = brush.toCanvas(point)
        if (step === 0) {
          context.moveTo(canvasPoint.x, canvasPoint.y)
        } else {
          context.lineTo(canvasPoint.x, canvasPoint.y)
        }
      }
      context.stroke()
    }
  })
  context.globalAlpha = 1
}
