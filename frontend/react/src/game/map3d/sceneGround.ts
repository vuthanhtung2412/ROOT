import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
} from 'three'
import type {
  ClearingGround,
  MapTerrain,
  PathGround,
} from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * The woodland floor, painted here from the terrain: forest floor, sandy
 * clearings, stone-dotted paths and the river. Then the daylight over it.
 */
const GROUND_TEXTURE_WIDTH_PIXELS = 4096
const FOREST_FLOOR_COLOR = '#4a5636'
const FOREST_FLOOR_PATCH_COLORS: readonly string[] = [
  '#55623c',
  '#3f4a30',
  '#5d6740',
]
const FOREST_FLOOR_PATCH_COUNT = 900
const FOREST_FLOOR_PATCH_OPACITY = 0.35
const OPEN_GROUND_COLOR = '#c2a871'
const OPEN_GROUND_EDGE_COLOR = '#8d8452'
const CLEARING_CENTER_COLOR = '#d6bf88'
const PATH_WIDTH = 4.6
const PATH_EDGE_WIDTH = 6.4
const PATH_STONE_COLOR = '#f1e9d2'
const PATH_STONE_WIDTH = 0.75
const PATH_STONE_GAP = 1.5
const RIVER_BANK_COLOR = '#7b7a4c'
const RIVER_BANK_WIDTH = 7.2
const RIVER_WATER_COLOR = '#5fa9c4'
const RIVER_WATER_WIDTH = 5
const RIVER_SHALLOW_COLOR = '#8fcbd9'
const RIVER_SHALLOW_WIDTH = 2.6
const RIVER_RIPPLE_COLOR = '#d9f1f3'
const RIVER_RIPPLE_WIDTH = 0.3
const RIVER_RIPPLE_DASH: readonly number[] = [2.2, 3.4]
/** The clearing's sand spreads a little past its ring. */
const CLEARING_SAND_RADIUS_RATIO = 1.12
const GROUND_SEED = 607
const FULL_TURN_RADIANS = Math.PI * 2
const QUARTER_TURN_RADIANS = Math.PI / 2
const HALF = 0.5
const DOUBLE = 2

/** `--color-forest-deep`: the far woodland fades into the game backdrop. */
const BACKGROUND_COLOR = 0x24362e
const FOG_NEAR = 150
const FOG_FAR = 330
const SKY_LIGHT_COLOR = 0xfff3dc
const GROUND_LIGHT_COLOR = 0x39503f
const SKY_LIGHT_INTENSITY = 1.5
const SUN_COLOR = 0xffe2b0
const SUN_INTENSITY = 2.1
const SUN_POSITION = { x: -55, y: 90, z: 40 } as const
const SHADOW_MAP_SIZE_PIXELS = 4096
const SHADOW_AREA_HALF_SIZE = 95
const SHADOW_CAMERA_FAR = 300
const SHADOW_BIAS = -0.0006
const SHADOW_NORMAL_BIAS = 0.05

type GroundPainter = {
  context: CanvasRenderingContext2D
  /** Canvas pixels per world unit. */
  scale: number
  terrain: MapTerrain
}

function canvasX(painter: GroundPainter, ground: MapGroundPoint): number {
  const halfWidth: number =
    painter.terrain.worldSize.width * HALF + painter.terrain.margin
  return (ground.x + halfWidth) * painter.scale
}

function canvasY(painter: GroundPainter, ground: MapGroundPoint): number {
  const halfDepth: number =
    painter.terrain.worldSize.depth * HALF + painter.terrain.margin
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
  context.fillStyle = FOREST_FLOOR_COLOR
  context.fillRect(0, 0, context.canvas.width, context.canvas.height)
  context.globalAlpha = FOREST_FLOOR_PATCH_OPACITY
  for (let patch = 0; patch < FOREST_FLOOR_PATCH_COUNT; patch += 1) {
    context.fillStyle =
      FOREST_FLOOR_PATCH_COLORS[patch % FOREST_FLOOR_PATCH_COLORS.length] ??
      FOREST_FLOOR_COLOR
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
  const sand: CanvasGradient = context.createRadialGradient(x, y, 0, x, y, radius)
  sand.addColorStop(0, CLEARING_CENTER_COLOR)
  sand.addColorStop(0.8, OPEN_GROUND_COLOR)
  sand.addColorStop(1, OPEN_GROUND_EDGE_COLOR)
  context.fillStyle = sand
  context.beginPath()
  context.arc(x, y, radius, 0, FULL_TURN_RADIANS)
  context.fill()
}

function paintGround(painter: GroundPainter): void {
  const { terrain } = painter
  paintForestFloor(painter)
  strokeLine(painter, terrain.river, {
    color: RIVER_BANK_COLOR,
    width: RIVER_BANK_WIDTH,
  })
  for (const path of terrain.paths) {
    strokeLine(painter, [path.start, path.end], {
      color: OPEN_GROUND_EDGE_COLOR,
      width: PATH_EDGE_WIDTH,
    })
  }
  for (const path of terrain.paths) {
    strokeLine(painter, [path.start, path.end], {
      color: OPEN_GROUND_COLOR,
      width: PATH_WIDTH,
    })
  }
  for (const clearing of terrain.clearings) {
    paintClearing(painter, clearing)
  }
  strokeLine(painter, terrain.river, {
    color: RIVER_WATER_COLOR,
    width: RIVER_WATER_WIDTH,
  })
  strokeLine(painter, terrain.river, {
    color: RIVER_SHALLOW_COLOR,
    width: RIVER_SHALLOW_WIDTH,
  })
  strokeLine(painter, terrain.river, {
    color: RIVER_RIPPLE_COLOR,
    width: RIVER_RIPPLE_WIDTH,
    dash: RIVER_RIPPLE_DASH,
  })
  // Stones last: where a path meets the river they read as stepping stones.
  terrain.paths.forEach((path: PathGround): void => {
    strokeLine(painter, [path.start, path.end], {
      color: PATH_STONE_COLOR,
      width: PATH_STONE_WIDTH,
      dash: [0, PATH_STONE_GAP],
    })
  })
}

function createGround(terrain: MapTerrain): Mesh {
  const width: number = terrain.worldSize.width + terrain.margin * DOUBLE
  const depth: number = terrain.worldSize.depth + terrain.margin * DOUBLE
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

function createSun(): DirectionalLight {
  const sun: DirectionalLight = new DirectionalLight(SUN_COLOR, SUN_INTENSITY)
  sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE_PIXELS, SHADOW_MAP_SIZE_PIXELS)
  sun.shadow.camera.left = -SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.right = SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.top = SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.bottom = -SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.far = SHADOW_CAMERA_FAR
  sun.shadow.bias = SHADOW_BIAS
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS
  return sun
}

/** Scene with the woodland floor and the daylight. */
export function createMapGroundScene(terrain: MapTerrain): Scene {
  const scene: Scene = new Scene()
  scene.background = new Color(BACKGROUND_COLOR)
  scene.fog = new Fog(BACKGROUND_COLOR, FOG_NEAR, FOG_FAR)
  scene.add(
    createGround(terrain),
    new HemisphereLight(
      SKY_LIGHT_COLOR,
      GROUND_LIGHT_COLOR,
      SKY_LIGHT_INTENSITY,
    ),
    createSun(),
  )
  return scene
}
