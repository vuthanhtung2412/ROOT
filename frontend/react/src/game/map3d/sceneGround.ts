import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import {
  paintClearingDetail,
  paintForestFloorDetail,
  paintPathDetail,
  paintPathStones,
  paintRiverDetail,
  type CanvasPoint,
  type GroundBrush,
} from '#game/map3d/groundDetail.ts'
import type { ClearingGround, MapTerrain } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * The woodland floor, painted here from the terrain: forest floor, sandy
 * clearings, stone-dotted paths and the river.
 */
const GROUND_TEXTURE_WIDTH_PIXELS = 4096
/** The forest floor: dark olive earth under the trees. */
const GROUND_COLOR = '#565a44'
const FOREST_FLOOR_PATCH_COLORS: readonly string[] = [
  '#5f634b',
  '#4c503c',
  '#535742',
]
const FOREST_FLOOR_PATCH_COUNT = 900
const FOREST_FLOOR_PATCH_OPACITY = 0.35
/** Clearing soil is pale khaki, fading into the dark forest floor. */
const CLEARING_SOIL_COLOR = '#b3ab8a'
const CLEARING_SOIL_FADED_COLOR = 'rgba(179, 171, 138, 0)'
/** Share of the clearing's radius that is solid soil before the fade. */
const CLEARING_SOIL_SOLID_RATIO = 0.55
/** A path is little more than its line of stones (as in the digital game). */
const PATH_WIDTH = 1.15
/** Paths are bare dirt, the clearings' khaki, under their stones. */
const PATH_GRAVEL_COLOR = '#a39b7c'
const RIVER_WATER_COLOR = '#5fa9c4'
const RIVER_WATER_WIDTH = 3
const RIVER_SHALLOW_COLOR = '#8fcbd9'
const RIVER_SHALLOW_WIDTH = 1.5
/** The clearing's sand spreads a little past its ring. */
const CLEARING_SAND_RADIUS_RATIO = 1.12
const GROUND_SEED = 607
const GROUND_DETAIL_SEED = 2203
const FULL_TURN_RADIANS = Math.PI * 2
const QUARTER_TURN_RADIANS = Math.PI / 2
const HALF = 0.5
const DOUBLE = 2

type GroundPainter = {
  context: CanvasRenderingContext2D
  /** Canvas pixels per world unit. */
  scale: number
  terrain: MapTerrain
}

function canvasX(painter: GroundPainter, ground: MapGroundPoint): number {
  const halfWidth: number =
    painter.terrain.worldSize.width * HALF + painter.terrain.marginX
  return (ground.x + halfWidth) * painter.scale
}

function canvasY(painter: GroundPainter, ground: MapGroundPoint): number {
  const halfDepth: number =
    painter.terrain.worldSize.depth * HALF + painter.terrain.marginZ
  return (ground.z + halfDepth) * painter.scale
}

function strokeLine(
  painter: GroundPainter,
  points: readonly MapGroundPoint[],
  style: { color: string; width: number; dash?: readonly number[] },
): void {
  const { context, scale } = painter
  context.beginPath()
  points.forEach((point: MapGroundPoint, index: number): void => {
    if (index === 0) {
      context.moveTo(canvasX(painter, point), canvasY(painter, point))
    } else {
      context.lineTo(canvasX(painter, point), canvasY(painter, point))
    }
  })
  context.strokeStyle = style.color
  context.lineWidth = style.width * scale
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.setLineDash(
    (style.dash ?? []).map((length: number): number => length * scale),
  )
  context.stroke()
  context.setLineDash([])
}

function paintForestFloor(painter: GroundPainter): void {
  const { context } = painter
  const random: () => number = createSeededRandom(GROUND_SEED)
  context.fillStyle = GROUND_COLOR
  context.fillRect(0, 0, context.canvas.width, context.canvas.height)
  context.globalAlpha = FOREST_FLOOR_PATCH_OPACITY
  for (let patch = 0; patch < FOREST_FLOOR_PATCH_COUNT; patch += 1) {
    context.fillStyle =
      FOREST_FLOOR_PATCH_COLORS[patch % FOREST_FLOOR_PATCH_COLORS.length] ??
      GROUND_COLOR
    context.beginPath()
    context.arc(
      random() * context.canvas.width,
      random() * context.canvas.height,
      (1 + random() * 4) * painter.scale,
      0,
      FULL_TURN_RADIANS,
    )
    context.fill()
  }
  context.globalAlpha = 1
}

function paintClearing(painter: GroundPainter, clearing: ClearingGround): void {
  const { context, scale } = painter
  const x: number = canvasX(painter, clearing.center)
  const y: number = canvasY(painter, clearing.center)
  const radius: number = clearing.radius * CLEARING_SAND_RADIUS_RATIO * scale
  const soil: CanvasGradient = context.createRadialGradient(x, y, 0, x, y, radius)
  soil.addColorStop(0, CLEARING_SOIL_COLOR)
  soil.addColorStop(CLEARING_SOIL_SOLID_RATIO, CLEARING_SOIL_COLOR)
  soil.addColorStop(1, CLEARING_SOIL_FADED_COLOR)
  context.fillStyle = soil
  context.beginPath()
  context.arc(x, y, radius, 0, FULL_TURN_RADIANS)
  context.fill()
}

function paintGround(painter: GroundPainter): void {
  const { terrain } = painter
  const brush: GroundBrush = {
    context: painter.context,
    scale: painter.scale,
    random: createSeededRandom(GROUND_DETAIL_SEED),
    toCanvas: (ground: MapGroundPoint): CanvasPoint => ({
      x: canvasX(painter, ground),
      y: canvasY(painter, ground),
    }),
  }
  paintForestFloor(painter)
  paintForestFloorDetail(brush, {
    halfWidth: terrain.worldSize.width * HALF + terrain.marginX,
    halfDepth: terrain.worldSize.depth * HALF + terrain.marginZ,
  })
  for (const path of terrain.paths) {
    strokeLine(painter, [path.start, path.end], {
      color: PATH_GRAVEL_COLOR,
      width: PATH_WIDTH,
    })
  }
  for (const clearing of terrain.clearings) {
    paintClearing(painter, clearing)
  }
  for (const path of terrain.paths) {
    paintPathDetail(brush, path)
  }
  for (const clearing of terrain.clearings) {
    paintClearingDetail(brush, clearing)
  }
  strokeLine(painter, terrain.river, {
    color: RIVER_WATER_COLOR,
    width: RIVER_WATER_WIDTH,
  })
  strokeLine(painter, terrain.river, {
    color: RIVER_SHALLOW_COLOR,
    width: RIVER_SHALLOW_WIDTH,
  })
  paintRiverDetail(brush, terrain.river)
  // Stones last: where a path meets the river they read as stepping stones.
  for (const path of terrain.paths) {
    paintPathStones(brush, path)
  }
}

export function createGround(terrain: MapTerrain): Mesh {
  const width: number = terrain.worldSize.width + terrain.marginX * DOUBLE
  const depth: number = terrain.worldSize.depth + terrain.marginZ * DOUBLE
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = GROUND_TEXTURE_WIDTH_PIXELS
  canvas.height = Math.round((GROUND_TEXTURE_WIDTH_PIXELS * depth) / width)
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    paintGround({
      context,
      scale: GROUND_TEXTURE_WIDTH_PIXELS / width,
      terrain,
    })
  }
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  const ground: Mesh = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshStandardMaterial({ map: texture, roughness: 1 }),
  )
  ground.rotation.x = -QUARTER_TURN_RADIANS
  ground.receiveShadow = true
  return ground
}

