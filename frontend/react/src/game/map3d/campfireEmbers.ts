import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'

/**
 * Embers of the campfires: sparks that fly up out of every fire, drift
 * apart and die out, over and over while the fire burns.
 */
export type CampfireEmbers = {
  points: Points
  /** Move the sparks; `burnLevel` 0 = fires out (no sparks), 1 = full. */
  update: (elapsedSeconds: number, burnLevel: number) => void
  dispose: () => void
}

const EMBERS_PER_FIRE = 16
const EMBER_SEED = 4177
/** A spark lives between these, seconds. */
const EMBER_MINIMUM_LIFETIME = 1.1
const EMBER_MAXIMUM_LIFETIME = 2.2
/** Where a spark leaves the flames, and how far up it gets. */
const EMBER_START_HEIGHT = 0.5
const EMBER_MINIMUM_RISE = 1.6
const EMBER_MAXIMUM_RISE = 3.2
/** How far from the fire a spark starts and ends. */
const EMBER_START_RADIUS = 0.18
const EMBER_END_RADIUS = 0.75
/** Sparks sway on their way up. */
const EMBER_SWAY_AMOUNT = 0.14
const EMBER_SWAY_FREQUENCY = 4.2
/** Diameter of a spark, world units. */
const EMBER_SIZE = 0.42
const EMBER_YOUNG_COLOR = 0xffe08a
const EMBER_OLD_COLOR = 0xff4a12
/** Sparks draw over the flames. */
const EMBER_RENDER_ORDER = 6
const EMBER_TEXTURE_SIZE_PIXELS = 32
const EMBER_TEXTURE_CORE_COLOR = 'rgba(255, 255, 255, 1)'
const EMBER_TEXTURE_EDGE_COLOR = 'rgba(255, 255, 255, 0)'
const HALF = 0.5
const FULL_TURN_RADIANS = Math.PI * 2
const COORDINATES_PER_POINT = 3

type Ember = {
  ground: MapGroundPoint
  /** Where in its life the spark is when the clock starts, 0..1. */
  startProgress: number
  lifetime: number
  rise: number
  /** Direction it drifts away from the fire, radians. */
  driftTurn: number
  swayPhase: number
}

/** A soft round dot. */
function createEmberTexture(): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = EMBER_TEXTURE_SIZE_PIXELS
  canvas.height = EMBER_TEXTURE_SIZE_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const center: number = EMBER_TEXTURE_SIZE_PIXELS * HALF
    const gradient: CanvasGradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center,
    )
    gradient.addColorStop(0, EMBER_TEXTURE_CORE_COLOR)
    gradient.addColorStop(1, EMBER_TEXTURE_EDGE_COLOR)
    context.fillStyle = gradient
    context.fillRect(0, 0, EMBER_TEXTURE_SIZE_PIXELS, EMBER_TEXTURE_SIZE_PIXELS)
  }
  return new CanvasTexture(canvas)
}

function createEmbers(fireGrounds: readonly MapGroundPoint[]): Ember[] {
  const random: () => number = createSeededRandom(EMBER_SEED)
  return fireGrounds.flatMap((ground: MapGroundPoint): Ember[] =>
    Array.from(
      { length: EMBERS_PER_FIRE },
      (): Ember => ({
        ground,
        startProgress: random(),
        lifetime:
          EMBER_MINIMUM_LIFETIME +
          random() * (EMBER_MAXIMUM_LIFETIME - EMBER_MINIMUM_LIFETIME),
        rise:
          EMBER_MINIMUM_RISE +
          random() * (EMBER_MAXIMUM_RISE - EMBER_MINIMUM_RISE),
        driftTurn: random() * FULL_TURN_RADIANS,
        swayPhase: random() * FULL_TURN_RADIANS,
      }),
    ),
  )
}

export function createCampfireEmbers(
  fireGrounds: readonly MapGroundPoint[],
): CampfireEmbers {
  const embers: Ember[] = createEmbers(fireGrounds)
  const positions: BufferAttribute = new BufferAttribute(
    new Float32Array(embers.length * COORDINATES_PER_POINT),
    COORDINATES_PER_POINT,
  )
  const colors: BufferAttribute = new BufferAttribute(
    new Float32Array(embers.length * COORDINATES_PER_POINT),
    COORDINATES_PER_POINT,
  )
  const geometry: BufferGeometry = new BufferGeometry()
  geometry.setAttribute('position', positions)
  geometry.setAttribute('color', colors)
  const texture: CanvasTexture = createEmberTexture()
  // Added to what is behind them, so a spark dimmed to black is not there.
  const material: PointsMaterial = new PointsMaterial({
    map: texture,
    size: EMBER_SIZE,
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const points: Points = new Points(geometry, material)
  // The sparks move every frame: never cull them by their first positions.
  points.frustumCulled = false
  points.renderOrder = EMBER_RENDER_ORDER

  const youngColor: Color = new Color(EMBER_YOUNG_COLOR)
  const oldColor: Color = new Color(EMBER_OLD_COLOR)
  const color: Color = new Color()

  return {
    points,
    update: (elapsedSeconds: number, burnLevel: number): void => {
      embers.forEach((ember: Ember, emberIndex: number): void => {
        const progress: number =
          (elapsedSeconds / ember.lifetime + ember.startProgress) % 1
        const radius: number =
          EMBER_START_RADIUS +
          (EMBER_END_RADIUS - EMBER_START_RADIUS) * progress
        const sway: number =
          Math.sin(elapsedSeconds * EMBER_SWAY_FREQUENCY + ember.swayPhase) *
          EMBER_SWAY_AMOUNT *
          progress
        positions.setXYZ(
          emberIndex,
          ember.ground.x + Math.cos(ember.driftTurn) * radius + sway,
          EMBER_START_HEIGHT + ember.rise * progress * burnLevel,
          ember.ground.z + Math.sin(ember.driftTurn) * radius,
        )
        // A spark cools from yellow to red and fades as it goes.
        color
          .copy(youngColor)
          .lerp(oldColor, progress)
          .multiplyScalar((1 - progress) * burnLevel)
        colors.setXYZ(emberIndex, color.r, color.g, color.b)
      })
      positions.needsUpdate = true
      colors.needsUpdate = true
    },
    dispose: (): void => {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
