import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Shape,
  ShapeGeometry,
  type CanvasTexture,
} from 'three'
import {
  forestPathSides,
  isInsideForest,
  type ForestGround,
  type ForestSide,
} from '#game/map3d/forestOutline.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'
import {
  createLightRayTexture,
  createRisingSparks,
  createSparkTexture,
  UNMASKED_LIGHT_RAYS,
  type RisingSparks,
} from '#game/map3d/markParts.ts'

/**
 * Mark of a forest the player can pick: a curtain of light stands on the
 * paths round it, its canopy glows and fireflies drift up. Unlike the glow
 * of the clearings it shows in daylight too: it is all that marks the forest.
 */
export type ForestMarksInput = {
  forests: readonly ForestGround[]
  clearings: readonly ClearingGround[]
}

export type ForestMarks = {
  group: Group
  setHighlighted: (forestIndexes: ReadonlySet<number>) => void
  /** Call once per frame. */
  update: (elapsedSeconds: number) => void
}

const QUARTER_TURN_RADIANS = Math.PI / 2
const HALF = 0.5

const GLOW_COLOR = 0xffc85a
const CURTAIN_HEIGHT = 3.2
/** World length of one tile of the ray texture along a path. */
const CURTAIN_TILE_LENGTH = 9.6
const CURTAIN_LOWEST_OPACITY = 0.4
const CURTAIN_OPACITY_BREATH = 0.3
const CURTAIN_BREATH_RADIANS_PER_SECOND = 2.4
const CANOPY_GLOW_OPACITY = 0.16
const CANOPY_GLOW_HEIGHT = 0.04
/** Over the trees and the pieces, under the suit chips and piece icons. */
const CANOPY_GLOW_RENDER_ORDER = 5

const FIREFLY_COUNT = 60
const FIREFLY_SEED = 41
const FIREFLY_SIZE = 0.48
/** Fireflies start over the trunks and climb past the tree tops. */
const FIREFLY_FLOOR_HEIGHT = 2.6
const FIREFLY_RISE_HEIGHT = 4.2
const FIREFLY_SWAY_DISTANCE = 0.13
/** Fireflies drift up slower than sparks fly. */
const FIREFLY_TIME_SHARE = 0.6
const FIREFLY_PLACE_ATTEMPT_COUNT = 40

const VERTICES_PER_SHEET = 4
const COMPONENTS_PER_POSITION = 3
const COMPONENTS_PER_TEXTURE_COORDINATE = 2

type ForestMark = {
  group: Group
  fireflies: RisingSparks
}

type ForestParts = {
  curtainMaterial: MeshBasicMaterial
  canopyMaterial: MeshBasicMaterial
  fireflyMaterial: PointsMaterial
}

function createGlowMaterial(texture: CanvasTexture | null): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: GLOW_COLOR,
    map: texture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: DoubleSide,
  })
}

function createForestParts(): ForestParts {
  const curtainTexture: CanvasTexture =
    createLightRayTexture(UNMASKED_LIGHT_RAYS)
  const canopyMaterial: MeshBasicMaterial = createGlowMaterial(null)
  canopyMaterial.depthTest = false
  canopyMaterial.opacity = CANOPY_GLOW_OPACITY
  return {
    curtainMaterial: createGlowMaterial(curtainTexture),
    canopyMaterial,
    fireflyMaterial: new PointsMaterial({
      color: GLOW_COLOR,
      map: createSparkTexture(),
      size: FIREFLY_SIZE,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  }
}

/** One upright sheet per path, the ray texture tiled along it. */
function createCurtain(
  sides: readonly ForestSide[],
  material: MeshBasicMaterial,
): Mesh {
  const positions: number[] = []
  const textureCoordinates: number[] = []
  const indexes: number[] = []
  sides.forEach((side: ForestSide, sideIndex: number): void => {
    const tiles: number =
      groundDistance(side.start, side.end) / CURTAIN_TILE_LENGTH
    const first: number = sideIndex * VERTICES_PER_SHEET
    positions.push(
      ...[side.start.x, 0, side.start.z],
      ...[side.end.x, 0, side.end.z],
      ...[side.end.x, CURTAIN_HEIGHT, side.end.z],
      ...[side.start.x, CURTAIN_HEIGHT, side.start.z],
    )
    textureCoordinates.push(0, 0, tiles, 0, tiles, 1, 0, 1)
    indexes.push(first, first + 1, first + 2, first, first + 2, first + 3)
  })
  const geometry: BufferGeometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, COMPONENTS_PER_POSITION),
  )
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(
      textureCoordinates,
      COMPONENTS_PER_TEXTURE_COORDINATE,
    ),
  )
  geometry.setIndex(indexes)
  return new Mesh(geometry, material)
}

function createCanopyGlow(
  forest: ForestGround,
  material: MeshBasicMaterial,
): Mesh {
  // A flat shape lies in x / y; laid down, its y becomes -z.
  const outline: Shape = new Shape()
  forest.corners.forEach((corner: MapGroundPoint, index: number): void => {
    if (index === 0) {
      outline.moveTo(corner.x, -corner.z)
    } else {
      outline.lineTo(corner.x, -corner.z)
    }
  })
  const glow: Mesh = new Mesh(new ShapeGeometry(outline), material)
  glow.rotateX(-QUARTER_TURN_RADIANS)
  glow.position.y = CANOPY_GLOW_HEIGHT
  glow.renderOrder = CANOPY_GLOW_RENDER_ORDER
  return glow
}

/** Somewhere inside the forest; its first corner if no try lands inside. */
function placeFirefly(
  forest: ForestGround,
  random: () => number,
): MapGroundPoint {
  const xs: number[] = forest.corners.map(
    (corner: MapGroundPoint): number => corner.x,
  )
  const zs: number[] = forest.corners.map(
    (corner: MapGroundPoint): number => corner.z,
  )
  const west: number = Math.min(...xs)
  const north: number = Math.min(...zs)
  for (let attempt = 0; attempt < FIREFLY_PLACE_ATTEMPT_COUNT; attempt += 1) {
    const point: MapGroundPoint = {
      x: west + random() * (Math.max(...xs) - west),
      z: north + random() * (Math.max(...zs) - north),
    }
    if (isInsideForest(point, forest)) {
      return point
    }
  }
  return forest.corners[0] ?? { x: 0, z: 0 }
}

function createForestMark(
  forest: ForestGround,
  clearings: readonly ClearingGround[],
  parts: ForestParts,
): ForestMark {
  const fireflies: RisingSparks = createRisingSparks({
    sparkCount: FIREFLY_COUNT,
    seed: FIREFLY_SEED + forest.forestIndex,
    place: (random: () => number): MapGroundPoint =>
      placeFirefly(forest, random),
    swayDistance: FIREFLY_SWAY_DISTANCE,
  })
  const fireflyPoints: Points = new Points(
    fireflies.geometry,
    parts.fireflyMaterial,
  )
  fireflyPoints.position.y = FIREFLY_FLOOR_HEIGHT
  fireflyPoints.scale.y = FIREFLY_RISE_HEIGHT
  // The fireflies move every frame: their first bounds would cull them wrongly.
  fireflyPoints.frustumCulled = false
  const group: Group = new Group()
  group.add(
    createCurtain(forestPathSides(forest, clearings), parts.curtainMaterial),
    createCanopyGlow(forest, parts.canopyMaterial),
    fireflyPoints,
  )
  group.visible = false
  return { group, fireflies }
}

export function createForestMarks(input: ForestMarksInput): ForestMarks {
  const group: Group = new Group()
  const parts: ForestParts = createForestParts()
  const marks: Map<number, ForestMark> = new Map<number, ForestMark>()
  for (const forest of input.forests) {
    const mark: ForestMark = createForestMark(forest, input.clearings, parts)
    marks.set(forest.forestIndex, mark)
    group.add(mark.group)
  }

  return {
    group,
    setHighlighted: (forestIndexes: ReadonlySet<number>): void => {
      for (const [forestIndex, mark] of marks) {
        mark.group.visible = forestIndexes.has(forestIndex)
      }
    },
    update: (elapsedSeconds: number): void => {
      const breath: number =
        HALF +
        HALF * Math.sin(elapsedSeconds * CURTAIN_BREATH_RADIANS_PER_SECOND)
      parts.curtainMaterial.opacity =
        CURTAIN_LOWEST_OPACITY + CURTAIN_OPACITY_BREATH * breath
      for (const mark of marks.values()) {
        if (mark.group.visible) {
          mark.fireflies.update(elapsedSeconds * FIREFLY_TIME_SHARE)
        }
      }
    },
  }
}
