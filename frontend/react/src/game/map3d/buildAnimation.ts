import {
  CanvasTexture,
  Group,
  MathUtils,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'

/**
 * A building going up: a cloud of dust billows over its slot, then its icon
 * grows out of its middle and the building rises out of the ground.
 */
export type BuildSite = {
  ground: MapGroundPoint
  /** The building; null while only its icon shows. */
  model: Object3D | null
  /** How far below the ground the building starts: its height right now. */
  riseHeight: number
  /** The icon of the piece, centred on itself. */
  label: Object3D
  /** Size of the icon once it is fully there. */
  labelSize: number
}

export type BuildAnimations = {
  group: Group
  /** Start the animation of the pieces with these keys. */
  play: (pieceKeys: readonly string[]) => void
  /** Call once per frame, after the pieces are in place. */
  update: (
    deltaSeconds: number,
    siteOf: (pieceKey: string) => BuildSite | undefined,
  ) => void
  /** A building is still going up. */
  isPlaying: () => boolean
  dispose: () => void
}

type DustPuff = {
  sprite: Sprite
  material: SpriteMaterial
}

type RunningBuild = {
  elapsedSeconds: number
  /** Made once the piece stands on the map. */
  dust: DustPuff[] | null
}

export const BUILD_SECONDS = 1.5
/** The building starts to rise once the dust is up (part of the duration). */
const RISE_START = 0.3
const RISE_EASING_POWER = 3

const PUFF_COUNT = 16
/** Puffs keep coming over this part of the duration. */
const PUFF_STAGGER = 0.45
/** How long one puff lasts (part of the duration). */
const PUFF_LIFETIME = 0.55
const PUFF_START_SIZE = 1.4
const PUFF_END_SIZE = 3.8
const PUFF_START_RADIUS = 0.4
const PUFF_END_RADIUS = 1.9
const PUFF_START_HEIGHT = 0.25
const PUFF_END_HEIGHT = 1.9
const PUFF_MAXIMUM_OPACITY = 1
/** A puff is at its thickest this early in its life. */
const PUFF_FADE_IN = 0.15
/** Every other puff drifts less far, so the cloud is not a ring. */
const PUFF_NEAR_SPREAD = 0.55
const PUFF_RENDER_ORDER = 8
/** Turn between two puffs: the golden angle spreads them evenly. */
const PUFF_TURN_RADIANS = Math.PI * (3 - Math.sqrt(5))
const DOUBLE = 2

const DUST_TEXTURE_SIZE_PIXELS = 64
const DUST_CORE_COLOR = 'rgba(214, 196, 160, 1)'
const DUST_MIDDLE_COLOR = 'rgba(196, 174, 134, 0.8)'
const DUST_EDGE_COLOR = 'rgba(170, 148, 110, 0)'
const DUST_MIDDLE_STOP = 0.55
const HALF = 0.5

function createDustTexture(): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = DUST_TEXTURE_SIZE_PIXELS
  canvas.height = DUST_TEXTURE_SIZE_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const center: number = DUST_TEXTURE_SIZE_PIXELS * HALF
    const gradient: CanvasGradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center,
    )
    gradient.addColorStop(0, DUST_CORE_COLOR)
    gradient.addColorStop(DUST_MIDDLE_STOP, DUST_MIDDLE_COLOR)
    gradient.addColorStop(1, DUST_EDGE_COLOR)
    context.fillStyle = gradient
    context.fillRect(0, 0, DUST_TEXTURE_SIZE_PIXELS, DUST_TEXTURE_SIZE_PIXELS)
  }
  return new CanvasTexture(canvas)
}

/** How far the building has risen (0 = under the ground, 1 = standing). */
export function buildRiseProgress(elapsedSeconds: number): number {
  const progress: number = MathUtils.clamp(
    (elapsedSeconds / BUILD_SECONDS - RISE_START) / (1 - RISE_START),
    0,
    1,
  )
  return 1 - (1 - progress) ** RISE_EASING_POWER
}

/** Where a puff is in its life (0 = not out yet, 1 = gone). */
function puffProgress(elapsedSeconds: number, puffIndex: number): number {
  const start: number = (puffIndex / PUFF_COUNT) * PUFF_STAGGER
  return MathUtils.clamp(
    (elapsedSeconds / BUILD_SECONDS - start) / PUFF_LIFETIME,
    0,
    1,
  )
}

export function createBuildAnimations(): BuildAnimations {
  const group: Group = new Group()
  const dustTexture: CanvasTexture = createDustTexture()
  const running: Map<string, RunningBuild> = new Map<string, RunningBuild>()

  const createDust = (ground: MapGroundPoint): DustPuff[] =>
    Array.from({ length: PUFF_COUNT }, (): DustPuff => {
      const material: SpriteMaterial = new SpriteMaterial({
        map: dustTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      const sprite: Sprite = new Sprite(material)
      sprite.position.set(ground.x, PUFF_START_HEIGHT, ground.z)
      sprite.renderOrder = PUFF_RENDER_ORDER
      group.add(sprite)
      return { sprite, material }
    })

  const moveDust = (
    dust: readonly DustPuff[],
    ground: MapGroundPoint,
    elapsedSeconds: number,
  ): void => {
    dust.forEach((puff: DustPuff, puffIndex: number): void => {
      const progress: number = puffProgress(elapsedSeconds, puffIndex)
      const spread: number = puffIndex % DOUBLE === 0 ? 1 : PUFF_NEAR_SPREAD
      const radius: number =
        MathUtils.lerp(PUFF_START_RADIUS, PUFF_END_RADIUS, progress) * spread
      const turn: number = puffIndex * PUFF_TURN_RADIANS
      puff.sprite.position.set(
        ground.x + Math.cos(turn) * radius,
        MathUtils.lerp(PUFF_START_HEIGHT, PUFF_END_HEIGHT, progress),
        ground.z + Math.sin(turn) * radius,
      )
      puff.sprite.scale.setScalar(
        MathUtils.lerp(PUFF_START_SIZE, PUFF_END_SIZE, progress),
      )
      const material: SpriteMaterial = puff.material
      material.opacity =
        PUFF_MAXIMUM_OPACITY *
        Math.min(progress / PUFF_FADE_IN, 1) *
        (1 - progress)
    })
  }

  const removeDust = (dust: readonly DustPuff[] | null): void => {
    for (const puff of dust ?? []) {
      group.remove(puff.sprite)
      puff.material.dispose()
    }
  }

  return {
    group,
    play: (pieceKeys: readonly string[]): void => {
      for (const pieceKey of pieceKeys) {
        removeDust(running.get(pieceKey)?.dust ?? null)
        running.set(pieceKey, { elapsedSeconds: 0, dust: null })
      }
    },
    update: (
      deltaSeconds: number,
      siteOf: (pieceKey: string) => BuildSite | undefined,
    ): void => {
      for (const [pieceKey, build] of running) {
        const elapsedSeconds: number = build.elapsedSeconds + deltaSeconds
        const site: BuildSite | undefined = siteOf(pieceKey)
        const finished: boolean = elapsedSeconds >= BUILD_SECONDS
        const progress: number = finished
          ? 1
          : buildRiseProgress(elapsedSeconds)
        // The icon grows out of its own middle while the building rises.
        site?.label.scale.setScalar(site.labelSize * progress)
        const model: Object3D | null = site?.model ?? null
        if (site !== undefined && model !== null) {
          model.position.y = -site.riseHeight * (1 - progress)
        }
        if (finished) {
          removeDust(build.dust)
          running.delete(pieceKey)
          continue
        }
        const dust: DustPuff[] | null =
          build.dust ?? (site === undefined ? null : createDust(site.ground))
        if (dust !== null && site !== undefined) {
          moveDust(dust, site.ground, elapsedSeconds)
        }
        running.set(pieceKey, { elapsedSeconds, dust })
      }
    },
    isPlaying: (): boolean => running.size > 0,
    dispose: (): void => {
      for (const build of running.values()) {
        removeDust(build.dust)
      }
      running.clear()
      dustTexture.dispose()
    },
  }
}
