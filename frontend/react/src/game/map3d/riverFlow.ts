import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * Soft shimmer on the river: two ribbons of irregular ripples drift
 * downstream at different speeds, laid just above the painted water.
 */
export type RiverFlow = {
  mesh: Group
  update: (deltaSeconds: number) => void
  dispose: () => void
}

/** Matches the narrow painted channel. */
const RIVER_FLOW_HALF_WIDTH = 1.2
/**
 * Width breathes along the course so the banks are not parallel rails.
 * 1 ± this amount.
 */
const RIVER_WIDTH_PULSE = 0.18
const RIVER_WIDTH_PULSE_FREQUENCY = 0.55
/** Lift above the ground so the shimmer does not fight the floor texture. */
const RIVER_FLOW_HEIGHT = 0.05
/** World length of one tile of the ripple texture along the river. */
const RIPPLE_TILE_LENGTH = 11
/** Negative: ripples drift toward the mouth (downstream along the course). */
const SLOW_FLOW_SPEED = -0.055
const FAST_FLOW_SPEED = -0.11
/** Tiny cross-stream sway, so the pattern does not march in lockstep. */
const CROSS_STREAM_SWAY_SPEED = 0.55
const CROSS_STREAM_SWAY_AMOUNT = 0.04
const TEXTURE_WIDTH_PIXELS = 256
const TEXTURE_HEIGHT_PIXELS = 96
const RIPPLE_MARK_COUNT = 28
const RIPPLE_SEED = 4417
const VERTICES_PER_POINT = 2
const COMPONENTS_PER_POSITION = 3
const COMPONENTS_PER_UV = 2
const INDICES_PER_SEGMENT = 6
const HALF = 0.5

type FlowLayer = {
  texture: CanvasTexture
  material: MeshBasicMaterial
  mesh: Mesh
  speed: number
}

function createRippleTexture(seed: number): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH_PIXELS
  canvas.height = TEXTURE_HEIGHT_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const random: () => number = createSeededRandom(seed)
    context.clearRect(0, 0, TEXTURE_WIDTH_PIXELS, TEXTURE_HEIGHT_PIXELS)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (let mark = 0; mark < RIPPLE_MARK_COUNT; mark += 1) {
      const centerX: number = random() * TEXTURE_WIDTH_PIXELS
      const centerY: number =
        TEXTURE_HEIGHT_PIXELS * (0.12 + random() * 0.76)
      const halfSpan: number =
        TEXTURE_HEIGHT_PIXELS * (0.08 + random() * 0.28)
      const belly: number = 4 + random() * 14
      const back: number = 2 + random() * 8
      const wobble: number = (random() - HALF) * 10
      context.globalAlpha = 0.12 + random() * 0.38
      context.strokeStyle = `rgba(220, 245, 255, ${String(0.7 + random() * 0.3)})`
      context.lineWidth = 1.2 + random() * 2.8
      context.beginPath()
      context.moveTo(centerX - back, centerY - halfSpan)
      context.bezierCurveTo(
        centerX + belly * HALF + wobble,
        centerY - halfSpan * HALF,
        centerX + belly,
        centerY,
        centerX + belly * HALF - wobble,
        centerY + halfSpan * HALF,
      )
      context.quadraticCurveTo(
        centerX - back * HALF,
        centerY + halfSpan,
        centerX - back,
        centerY + halfSpan,
      )
      context.stroke()
    }
    context.globalAlpha = 1
  }
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function sidewaysAt(
  river: readonly MapGroundPoint[],
  index: number,
): Vector2 {
  const previous: MapGroundPoint =
    river[Math.max(0, index - 1)] ?? river[index] ?? { x: 0, z: 0 }
  const next: MapGroundPoint =
    river[Math.min(river.length - 1, index + 1)] ?? river[index] ?? {
      x: 0,
      z: 0,
    }
  const along: Vector2 = new Vector2(next.x - previous.x, next.z - previous.z)
  if (along.lengthSq() === 0) {
    return new Vector2(1, 0)
  }
  along.normalize()
  // Left of the downstream direction.
  return new Vector2(-along.y, along.x)
}

function createRiverRibbonGeometry(
  river: readonly MapGroundPoint[],
): BufferGeometry | null {
  if (river.length < 2) {
    return null
  }
  const pointCount: number = river.length
  const positions: Float32Array = new Float32Array(
    pointCount * VERTICES_PER_POINT * COMPONENTS_PER_POSITION,
  )
  const uvs: Float32Array = new Float32Array(
    pointCount * VERTICES_PER_POINT * COMPONENTS_PER_UV,
  )
  const indices: number[] = []
  let travelled: number = 0
  for (let index = 0; index < pointCount; index += 1) {
    const point: MapGroundPoint | undefined = river[index]
    if (point === undefined) {
      continue
    }
    if (index > 0) {
      const previous: MapGroundPoint | undefined = river[index - 1]
      if (previous !== undefined) {
        travelled += Math.hypot(point.x - previous.x, point.z - previous.z)
      }
    }
    const widthScale: number =
      1 +
      Math.sin(travelled * RIVER_WIDTH_PULSE_FREQUENCY) * RIVER_WIDTH_PULSE
    const side: Vector2 = sidewaysAt(river, index).multiplyScalar(
      RIVER_FLOW_HALF_WIDTH * widthScale,
    )
    const vertexBase: number = index * VERTICES_PER_POINT
    const positionBase: number = vertexBase * COMPONENTS_PER_POSITION
    positions[positionBase] = point.x - side.x
    positions[positionBase + 1] = RIVER_FLOW_HEIGHT
    positions[positionBase + 2] = point.z - side.y
    positions[positionBase + 3] = point.x + side.x
    positions[positionBase + 4] = RIVER_FLOW_HEIGHT
    positions[positionBase + 5] = point.z + side.y
    const u: number = travelled / RIPPLE_TILE_LENGTH
    const uvBase: number = vertexBase * COMPONENTS_PER_UV
    uvs[uvBase] = u
    uvs[uvBase + 1] = 0
    uvs[uvBase + 2] = u
    uvs[uvBase + 3] = 1
    if (index > 0) {
      const leftPrevious: number = (index - 1) * VERTICES_PER_POINT
      const rightPrevious: number = leftPrevious + 1
      const leftHere: number = vertexBase
      const rightHere: number = vertexBase + 1
      indices.push(
        leftPrevious,
        rightPrevious,
        leftHere,
        rightPrevious,
        rightHere,
        leftHere,
      )
    }
  }
  if (indices.length < INDICES_PER_SEGMENT) {
    return null
  }
  const geometry: BufferGeometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(positions, COMPONENTS_PER_POSITION),
  )
  geometry.setAttribute('uv', new BufferAttribute(uvs, COMPONENTS_PER_UV))
  geometry.setIndex(indices)
  return geometry
}

function createFlowLayer(
  geometry: BufferGeometry,
  seed: number,
  speed: number,
  opacity: number,
): FlowLayer {
  const texture: CanvasTexture = createRippleTexture(seed)
  const material: MeshBasicMaterial = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
  })
  const mesh: Mesh = new Mesh(geometry, material)
  mesh.renderOrder = 1
  return { texture, material, mesh, speed }
}

export function createRiverFlow(river: readonly MapGroundPoint[]): RiverFlow {
  const geometry: BufferGeometry =
    createRiverRibbonGeometry(river) ?? new BufferGeometry()
  const slowLayer: FlowLayer = createFlowLayer(
    geometry,
    RIPPLE_SEED,
    SLOW_FLOW_SPEED,
    0.7,
  )
  const fastLayer: FlowLayer = createFlowLayer(
    geometry,
    RIPPLE_SEED + 91,
    FAST_FLOW_SPEED,
    0.45,
  )
  const group: Group = new Group()
  group.add(slowLayer.mesh, fastLayer.mesh)
  let elapsedSeconds = 0
  return {
    mesh: group,
    update: (deltaSeconds: number): void => {
      elapsedSeconds += deltaSeconds
      for (const layer of [slowLayer, fastLayer]) {
        const nextOffset: number =
          layer.texture.offset.x + layer.speed * deltaSeconds
        // Keep the wrap in [0, 1) even when the flow runs downstream (negative).
        layer.texture.offset.x = ((nextOffset % 1) + 1) % 1
        layer.texture.offset.y =
          Math.sin(
            elapsedSeconds * CROSS_STREAM_SWAY_SPEED + Math.abs(layer.speed) * 8,
          ) * CROSS_STREAM_SWAY_AMOUNT
      }
    },
    dispose: (): void => {
      geometry.dispose()
      for (const layer of [slowLayer, fastLayer]) {
        layer.texture.dispose()
        layer.material.dispose()
      }
    },
  }
}
