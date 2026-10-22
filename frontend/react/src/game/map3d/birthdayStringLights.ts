import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { MapTerrain, PathGround } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Birthday edition: a string of party lights over every path, hung from a
 * post at the edge of each clearing it links. The bulbs glow on their own,
 * so they shine the same in birdsong, daylight and evening.
 */
const POST_HEIGHT = 2.6
const POST_RADIUS = 0.05
const POST_RADIAL_SEGMENTS = 6
const POST_COLOR = 0x3a2c22
const POST_ROUGHNESS = 0.9
/** How far the wire hangs below its posts at the middle of the path. */
const WIRE_SAG = 0.7
const WIRE_COLOR = 0x1c1612
/** The wire is drawn as this many straight pieces along its curve. */
const WIRE_SEGMENTS_PER_PATH = 24
/** Distance between neighbouring bulbs along the wire. */
const BULB_SPACING = 0.9
/** Black socket clipped to the wire, holding its bulb underneath. */
const SOCKET_HEIGHT = 0.1
const SOCKET_RADIUS = 0.045
const SOCKET_RADIAL_SEGMENTS = 8
const SOCKET_COLOR = 0x111111
const SOCKET_ROUGHNESS = 0.6
const BULB_RADIUS = 0.13
const BULB_WIDTH_SEGMENTS = 8
const BULB_HEIGHT_SEGMENTS = 6
/** Hot pale yellow: as bright as an unlit colour gets. */
const BULB_COLOR = 0xfff38a
const GLOW_TEXTURE_SIZE_PIXELS = 64
/** Bright glow hugging a bulb. */
const INNER_GLOW: GlowLayer = {
  size: 1.1,
  coreColor: 'rgba(255, 245, 160, 0.9)',
  middleColor: 'rgba(255, 215, 80, 0.35)',
  edgeColor: 'rgba(255, 215, 80, 0)',
}
/** Faint wide light radiating from a bulb into the air around it. */
const OUTER_GLOW: GlowLayer = {
  size: 2.8,
  coreColor: 'rgba(255, 225, 120, 0.4)',
  middleColor: 'rgba(255, 200, 70, 0.1)',
  edgeColor: 'rgba(255, 200, 70, 0)',
}
/** Glows draw over the bulbs and the wire. */
const GLOW_RENDER_ORDER = 6
const HALF = 0.5

/** A soft round glow round every bulb: diameter in world units, gradient. */
type GlowLayer = {
  size: number
  coreColor: string
  middleColor: string
  edgeColor: string
}

/** Where a string of lights hangs from: the tops of its two posts. */
type LightString = {
  start: MapGroundPoint
  end: MapGroundPoint
}

/** The string over a path, from rim to rim of the clearings it links. */
function stringOverPath(path: PathGround, clearingRadius: number): LightString {
  const length: number = groundDistance(path.start, path.end)
  const insetRatio: number = clearingRadius / length
  return {
    start: {
      x: path.start.x + (path.end.x - path.start.x) * insetRatio,
      z: path.start.z + (path.end.z - path.start.z) * insetRatio,
    },
    end: {
      x: path.end.x + (path.start.x - path.end.x) * insetRatio,
      z: path.end.z + (path.start.z - path.end.z) * insetRatio,
    },
  }
}

/** The point of the wire at `along` 0..1, sagging most at the middle. */
function wirePoint(lightString: LightString, along: number): Vector3 {
  const sag: number = WIRE_SAG * 4 * along * (1 - along)
  return new Vector3(
    lightString.start.x + (lightString.end.x - lightString.start.x) * along,
    POST_HEIGHT - sag,
    lightString.start.z + (lightString.end.z - lightString.start.z) * along,
  )
}

function wireOf(lightString: LightString): Vector3[] {
  return Array.from(
    { length: WIRE_SEGMENTS_PER_PATH },
    (_: undefined, index: number): Vector3[] => [
      wirePoint(lightString, index / WIRE_SEGMENTS_PER_PATH),
      wirePoint(lightString, (index + 1) / WIRE_SEGMENTS_PER_PATH),
    ],
  ).flat()
}

/** Where each socket clips onto the wire, evenly, none right at a post. */
function clipPointsOf(lightString: LightString): Vector3[] {
  const length: number = groundDistance(lightString.start, lightString.end)
  const bulbCount: number = Math.max(1, Math.floor(length / BULB_SPACING))
  return Array.from(
    { length: bulbCount },
    (_: undefined, index: number): Vector3 =>
      wirePoint(lightString, (index + HALF) / bulbCount),
  )
}

function below(point: Vector3, drop: number): Vector3 {
  return new Vector3(point.x, point.y - drop, point.z)
}

/** One instance of a shape at each position. */
function instancedAt(
  geometry: BufferGeometry,
  material: Material,
  positions: readonly Vector3[],
): InstancedMesh {
  const instances: InstancedMesh = new InstancedMesh(
    geometry,
    material,
    positions.length,
  )
  const transform: Object3D = new Object3D()
  positions.forEach((position: Vector3, index: number): void => {
    transform.position.copy(position)
    transform.updateMatrix()
    instances.setMatrixAt(index, transform.matrix)
  })
  return instances
}

function createPosts(lightStrings: readonly LightString[]): InstancedMesh {
  const postCenters: Vector3[] = lightStrings.flatMap(
    (lightString: LightString): Vector3[] =>
      [lightString.start, lightString.end].map(
        (foot: MapGroundPoint): Vector3 =>
          new Vector3(foot.x, POST_HEIGHT * HALF, foot.z),
      ),
  )
  const posts: InstancedMesh = instancedAt(
    new CylinderGeometry(
      POST_RADIUS,
      POST_RADIUS,
      POST_HEIGHT,
      POST_RADIAL_SEGMENTS,
    ),
    new MeshStandardMaterial({ color: POST_COLOR, roughness: POST_ROUGHNESS }),
    postCenters,
  )
  posts.castShadow = true
  return posts
}

function createSockets(clipPoints: readonly Vector3[]): InstancedMesh {
  return instancedAt(
    new CylinderGeometry(
      SOCKET_RADIUS,
      SOCKET_RADIUS,
      SOCKET_HEIGHT,
      SOCKET_RADIAL_SEGMENTS,
    ),
    new MeshStandardMaterial({
      color: SOCKET_COLOR,
      roughness: SOCKET_ROUGHNESS,
    }),
    clipPoints.map(
      (clipPoint: Vector3): Vector3 => below(clipPoint, SOCKET_HEIGHT * HALF),
    ),
  )
}

function createBulbs(bulbCenters: readonly Vector3[]): InstancedMesh {
  return instancedAt(
    new SphereGeometry(BULB_RADIUS, BULB_WIDTH_SEGMENTS, BULB_HEIGHT_SEGMENTS),
    // Unlit and fogless: a bulb is as bright at dawn as at night, far or near.
    new MeshBasicMaterial({ color: BULB_COLOR, fog: false }),
    bulbCenters,
  )
}

/** A soft round glow, bright in the middle and fading out: no rays. */
function createGlowTexture(layer: GlowLayer): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = GLOW_TEXTURE_SIZE_PIXELS
  canvas.height = GLOW_TEXTURE_SIZE_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const center: number = GLOW_TEXTURE_SIZE_PIXELS * HALF
    const glow: CanvasGradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center,
    )
    glow.addColorStop(0, layer.coreColor)
    glow.addColorStop(HALF, layer.middleColor)
    glow.addColorStop(1, layer.edgeColor)
    context.fillStyle = glow
    context.fillRect(0, 0, GLOW_TEXTURE_SIZE_PIXELS, GLOW_TEXTURE_SIZE_PIXELS)
  }
  return new CanvasTexture(canvas)
}

function createGlows(
  bulbCenters: readonly Vector3[],
  layer: GlowLayer,
): Points {
  const glows: Points = new Points(
    new BufferGeometry().setFromPoints([...bulbCenters]),
    new PointsMaterial({
      size: layer.size,
      map: createGlowTexture(layer),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    }),
  )
  glows.renderOrder = GLOW_RENDER_ORDER
  return glows
}

/** Every string of lights of the map: posts, wires, sockets, bulbs, glows. */
export function createBirthdayStringLights(terrain: MapTerrain): Group {
  const clearingRadius: number = terrain.clearings[0]?.radius ?? 0
  const lightStrings: LightString[] = terrain.paths.map(
    (path: PathGround): LightString => stringOverPath(path, clearingRadius),
  )
  const clipPoints: Vector3[] = lightStrings.flatMap(clipPointsOf)
  const bulbCenters: Vector3[] = clipPoints.map(
    (clipPoint: Vector3): Vector3 =>
      below(clipPoint, SOCKET_HEIGHT + BULB_RADIUS),
  )
  const group: Group = new Group()
  group.add(
    createPosts(lightStrings),
    new LineSegments(
      new BufferGeometry().setFromPoints(lightStrings.flatMap(wireOf)),
      new LineBasicMaterial({ color: WIRE_COLOR }),
    ),
    createSockets(clipPoints),
    createBulbs(bulbCenters),
    createGlows(bulbCenters, OUTER_GLOW),
    createGlows(bulbCenters, INNER_GLOW),
  )
  return group
}
