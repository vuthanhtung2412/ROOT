import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * What the marks of the clearings and of the forests are made of: white
 * textures (the material gives the colour) and sparks that drift up.
 */

/** One frame of the marks' animation. */
export type MarkFrame = {
  elapsedSeconds: number
  /** 0 in daylight (no glow at all), 1 at birdsong and in the evening. */
  glowLevel: number
}

/** Below this the glow is switched off rather than drawn. */
export const MINIMUM_VISIBLE_GLOW = 0.01

/**
 * Half the side of the square a clearing mark is drawn on, in clearing
 * radii: room for what sits outside the rim.
 */
export const MARK_SPAN_RATIO = 1.3

export type FadeStop = {
  /** 0 = centre (or top), 1 = edge (or bottom) of the texture. */
  offset: number
  opacity: number
}

/** Dashes on a circle round a clearing, sizes in clearing radii. */
export type DashRing = {
  dashCount: number
  /** Share of each step that is dash; the rest is gap. */
  litShare: number
  radiusRatio: number
  widthRatio: number
}

export type DashRingPaint = {
  ring: DashRing
  opacity: number
  /** Soft edge round each dash, in clearing radii; 0 = crisp. */
  blurRatio: number
}

/** Which part of one dash step of a light curtain is lit, left to right. */
export type LightRayMask = {
  litShare: number
  /** Where the lit part ends, 0..1 across the texture; it wraps round. */
  litEndShare: number
}

export const UNMASKED_LIGHT_RAYS: LightRayMask = { litShare: 1, litEndShare: 1 }

type TextureSize = {
  width: number
  height: number
}

const MARK_TEXTURE_SIZE_PIXELS = 512
const RAY_TEXTURE_SIZE: TextureSize = { width: 256, height: 128 }
const SPARK_TEXTURE_SIZE_PIXELS = 64
const HALF = 0.5
const FULL_TURN_RADIANS = Math.PI * 2
const COMPONENTS_PER_POSITION = 3

/** A light ray is opaque at its foot and gone at its top. */
const RAY_FADE_STOPS: readonly FadeStop[] = [
  { offset: 0, opacity: 0 },
  { offset: 0.55, opacity: 0.14 },
  { offset: 1, opacity: 0.75 },
]
const RAY_STREAK_COUNT = 46
const RAY_STREAK_SEED = 5
const RAY_STREAK_HIGHEST_START_RATIO = 0.7
const RAY_STREAK_MINIMUM_WIDTH_PIXELS = 2
const RAY_STREAK_WIDTH_SPREAD_PIXELS = 9
const RAY_STREAK_MINIMUM_OPACITY = 0.1
const RAY_STREAK_OPACITY_SPREAD = 0.35

const SPARK_FADE_STOPS: readonly FadeStop[] = [
  { offset: 0, opacity: 1 },
  { offset: 0.35, opacity: 0.55 },
  { offset: 1, opacity: 0 },
]

function white(opacity: number): string {
  return `rgba(255, 255, 255, ${String(opacity)})`
}

/** What a texture is painted with. */
type MarkBrush = {
  context: CanvasRenderingContext2D
}

function paintTexture(
  size: TextureSize,
  paint: (brush: MarkBrush) => void,
): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    paint({ context })
  }
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function addFadeStops(
  gradient: CanvasGradient,
  stops: readonly FadeStop[],
): CanvasGradient {
  for (const stop of stops) {
    gradient.addColorStop(stop.offset, white(stop.opacity))
  }
  return gradient
}

/** A disc whose opacity changes from its centre to its edge. */
export function createRadialFadeTexture(
  stops: readonly FadeStop[],
): CanvasTexture {
  const size: TextureSize = {
    width: MARK_TEXTURE_SIZE_PIXELS,
    height: MARK_TEXTURE_SIZE_PIXELS,
  }
  return paintTexture(size, (brush: MarkBrush): void => {
    const { context }: MarkBrush = brush
    const center: number = MARK_TEXTURE_SIZE_PIXELS * HALF
    context.fillStyle = addFadeStops(
      context.createRadialGradient(center, center, 0, center, center, center),
      stops,
    )
    context.beginPath()
    context.arc(center, center, center, 0, FULL_TURN_RADIANS)
    context.fill()
  })
}

/**
 * Dashes on a circle, for a square of `MARK_SPAN_RATIO` clearing radii a
 * side. The first dash starts due east and they run on towards the south.
 */
export function createDashRingTexture(paint: DashRingPaint): CanvasTexture {
  const size: TextureSize = {
    width: MARK_TEXTURE_SIZE_PIXELS,
    height: MARK_TEXTURE_SIZE_PIXELS,
  }
  const pixelsPerRadius: number =
    (MARK_TEXTURE_SIZE_PIXELS * HALF) / MARK_SPAN_RATIO
  const stepRadians: number = FULL_TURN_RADIANS / paint.ring.dashCount
  return paintTexture(size, (brush: MarkBrush): void => {
    const { context }: MarkBrush = brush
    const center: number = MARK_TEXTURE_SIZE_PIXELS * HALF
    context.lineWidth = paint.ring.widthRatio * pixelsPerRadius
    context.strokeStyle = white(paint.opacity)
    context.shadowColor = white(1)
    context.shadowBlur = paint.blurRatio * pixelsPerRadius
    for (let dash = 0; dash < paint.ring.dashCount; dash += 1) {
      const startRadians: number = dash * stepRadians
      context.beginPath()
      context.arc(
        center,
        center,
        paint.ring.radiusRatio * pixelsPerRadius,
        startRadians,
        startRadians + stepRadians * paint.ring.litShare,
      )
      context.stroke()
    }
  })
}

/**
 * Rays of light standing on the ground, streaked. Repeats sideways; with a
 * mask, only the lit part of each repeat has rays.
 */
export function createLightRayTexture(mask: LightRayMask): CanvasTexture {
  const { width, height }: TextureSize = RAY_TEXTURE_SIZE
  const random: () => number = createSeededRandom(RAY_STREAK_SEED)
  const texture: CanvasTexture = paintTexture(
    RAY_TEXTURE_SIZE,
    (brush: MarkBrush): void => {
      const { context }: MarkBrush = brush
      context.fillStyle = addFadeStops(
        context.createLinearGradient(0, 0, 0, height),
        RAY_FADE_STOPS,
      )
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'
      for (let streak = 0; streak < RAY_STREAK_COUNT; streak += 1) {
        const top: number = random() * height * RAY_STREAK_HIGHEST_START_RATIO
        context.fillStyle = addFadeStops(
          context.createLinearGradient(0, top, 0, height),
          [
            { offset: 0, opacity: 0 },
            {
              offset: 1,
              opacity:
                RAY_STREAK_MINIMUM_OPACITY +
                random() * RAY_STREAK_OPACITY_SPREAD,
            },
          ],
        )
        context.fillRect(
          random() * width,
          top,
          RAY_STREAK_MINIMUM_WIDTH_PIXELS +
            random() * RAY_STREAK_WIDTH_SPREAD_PIXELS,
          height - top,
        )
      }
      // Rub out the unlit part: from the end of the lit part, round to its start.
      const unlitStart: number = mask.litEndShare * width
      const unlitWidth: number = (1 - mask.litShare) * width
      context.clearRect(unlitStart, 0, unlitWidth, height)
      context.clearRect(unlitStart - width, 0, unlitWidth, height)
    },
  )
  texture.wrapS = RepeatWrapping
  return texture
}

/** A soft round dot. */
export function createSparkTexture(): CanvasTexture {
  const size: TextureSize = {
    width: SPARK_TEXTURE_SIZE_PIXELS,
    height: SPARK_TEXTURE_SIZE_PIXELS,
  }
  return paintTexture(size, (brush: MarkBrush): void => {
    const { context }: MarkBrush = brush
    const center: number = SPARK_TEXTURE_SIZE_PIXELS * HALF
    context.fillStyle = addFadeStops(
      context.createRadialGradient(center, center, 0, center, center, center),
      SPARK_FADE_STOPS,
    )
    context.fillRect(0, 0, SPARK_TEXTURE_SIZE_PIXELS, SPARK_TEXTURE_SIZE_PIXELS)
  })
}

export type RisingSparksInput = {
  sparkCount: number
  seed: number
  /** Where one spark rises from. */
  place: (random: () => number) => MapGroundPoint
  /** How far a spark drifts sideways as it rises. */
  swayDistance: number
}

/** Sparks that climb from y = 0 to y = 1 again and again; scale to size. */
export type RisingSparks = {
  geometry: BufferGeometry
  update: (elapsedSeconds: number) => void
}

type SparkSeed = {
  ground: MapGroundPoint
  /** Where in its climb the spark is at time 0, 0..1. */
  startShare: number
  climbsPerSecond: number
}

const SPARK_SLOWEST_CLIMBS_PER_SECOND = 0.18
const SPARK_CLIMB_SPEED_SPREAD = 0.25
const SPARK_SWAY_RADIANS_PER_SECOND = 1.5

export function createRisingSparks(input: RisingSparksInput): RisingSparks {
  const random: () => number = createSeededRandom(input.seed)
  const seeds: SparkSeed[] = Array.from(
    { length: input.sparkCount },
    (): SparkSeed => ({
      ground: input.place(random),
      startShare: random(),
      climbsPerSecond:
        SPARK_SLOWEST_CLIMBS_PER_SECOND + random() * SPARK_CLIMB_SPEED_SPREAD,
    }),
  )
  const positions: BufferAttribute = new BufferAttribute(
    new Float32Array(input.sparkCount * COMPONENTS_PER_POSITION),
    COMPONENTS_PER_POSITION,
  )
  const geometry: BufferGeometry = new BufferGeometry()
  geometry.setAttribute('position', positions)
  const update = (elapsedSeconds: number): void => {
    seeds.forEach((seed: SparkSeed, index: number): void => {
      positions.setXYZ(
        index,
        seed.ground.x +
          Math.sin(elapsedSeconds * SPARK_SWAY_RADIANS_PER_SECOND + index) *
            input.swayDistance,
        (seed.startShare + elapsedSeconds * seed.climbsPerSecond) % 1,
        seed.ground.z,
      )
    })
    positions.needsUpdate = true
  }
  update(0)
  return { geometry, update }
}
