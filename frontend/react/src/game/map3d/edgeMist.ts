import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Color,
} from 'three'
import type { MapTerrain } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'

/**
 * Mist around the woodland: clear over the playable area, it thickens across
 * the margin into the colour of the sky, so the camera never sees where the
 * ground and its trees stop. Stacked in layers, it swallows the tops of the
 * trees and mountains at the edge too.
 */

/** Heights of the layers of mist: from the ground up past the mountain tops. */
export const MIST_LAYER_HEIGHTS: readonly number[] = [0.4, 3, 6, 10, 15, 21, 28]
/**
 * Share of the margin, out from the playable area, that stays clear of mist,
 * and from where on the mist hides everything.
 */
const MIST_CLEAR_MARGIN_SHARE = 0.15
const MIST_OPAQUE_MARGIN_SHARE = 0.85
/** The mist runs this many times the ground's size, so no edge of it shows. */
const MIST_SPAN_RATIO = 4
/**
 * Opacity of each layer: thin alone, the stacked layers still hide the edge of
 * the ground.
 */
const MIST_LAYER_OPACITY = 0.6
/** Over the river's flow (1), under the marks of the playable area. */
export const MIST_RENDER_ORDER = 2
const MIST_MASK_SIZE_PIXELS = 256
const QUARTER_TURN_RADIANS = Math.PI / 2
const HALF = 0.5
const DOUBLE = 2
const OPAQUE_ALPHA = 255
const RGBA_CHANNEL_COUNT = 4
const WHITE_CHANNEL = 255
const ALPHA_CHANNEL_OFFSET = 3

type MistSpan = {
  width: number
  depth: number
}

/**
 * How far out of the playable area a point of the ground is, in margins
 * (0 = inside it, 1 = at the edge of the ground).
 */
export function marginReach(
  terrain: MapTerrain,
  ground: MapGroundPoint,
): number {
  const outsideX: number = Math.max(
    Math.abs(ground.x) - terrain.worldSize.width * HALF,
    0,
  )
  const outsideZ: number = Math.max(
    Math.abs(ground.z) - terrain.worldSize.depth * HALF,
    0,
  )
  return Math.hypot(outsideX / terrain.marginX, outsideZ / terrain.marginZ)
}

/** How thick the mist is at a point of the ground (0 = clear, 1 = opaque). */
function mistThickness(terrain: MapTerrain, ground: MapGroundPoint): number {
  return MathUtils.smoothstep(
    marginReach(terrain, ground),
    MIST_CLEAR_MARGIN_SHARE,
    MIST_OPAQUE_MARGIN_SHARE,
  )
}

/** White, with the mist's thickness as its alpha, across the whole span. */
function createMistMask(terrain: MapTerrain, span: MistSpan): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = MIST_MASK_SIZE_PIXELS
  canvas.height = MIST_MASK_SIZE_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const image: ImageData = context.createImageData(
      MIST_MASK_SIZE_PIXELS,
      MIST_MASK_SIZE_PIXELS,
    )
    for (let row = 0; row < MIST_MASK_SIZE_PIXELS; row += 1) {
      for (let column = 0; column < MIST_MASK_SIZE_PIXELS; column += 1) {
        const thickness: number = mistThickness(terrain, {
          x: ((column + HALF) / MIST_MASK_SIZE_PIXELS - HALF) * span.width,
          z: ((row + HALF) / MIST_MASK_SIZE_PIXELS - HALF) * span.depth,
        })
        const pixel: number =
          (row * MIST_MASK_SIZE_PIXELS + column) * RGBA_CHANNEL_COUNT
        image.data.fill(WHITE_CHANNEL, pixel, pixel + ALPHA_CHANNEL_OFFSET)
        image.data[pixel + ALPHA_CHANNEL_OFFSET] = Math.round(
          thickness * OPAQUE_ALPHA,
        )
      }
    }
    context.putImageData(image, 0, 0)
  }
  const mask: CanvasTexture = new CanvasTexture(canvas)
  mask.wrapS = ClampToEdgeWrapping
  mask.wrapT = ClampToEdgeWrapping
  return mask
}

/** The mist takes the sky's colour, and follows it as the day turns. */
export function createEdgeMist(terrain: MapTerrain, skyColor: Color): Group {
  const span: MistSpan = {
    width:
      (terrain.worldSize.width + terrain.marginX * DOUBLE) * MIST_SPAN_RATIO,
    depth:
      (terrain.worldSize.depth + terrain.marginZ * DOUBLE) * MIST_SPAN_RATIO,
  }
  const material: MeshBasicMaterial = new MeshBasicMaterial({
    map: createMistMask(terrain, span),
    transparent: true,
    opacity: MIST_LAYER_OPACITY,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
  // Shared, not copied: the sky's colour fades with the time of day.
  material.color = skyColor
  const geometry: PlaneGeometry = new PlaneGeometry(span.width, span.depth)
  const mist: Group = new Group()
  for (const height of MIST_LAYER_HEIGHTS) {
    const layer: Mesh = new Mesh(geometry, material)
    layer.rotation.x = -QUARTER_TURN_RADIANS
    layer.position.y = height
    layer.renderOrder = MIST_RENDER_ORDER
    mist.add(layer)
  }
  return mist
}
