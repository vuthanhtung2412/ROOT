import {
  CanvasTexture,
  Group,
  MathUtils,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import {
  createClearingMarks,
  type ClearingMarks,
  type ClearingRingStyle,
} from '#game/map3d/clearingMarks.ts'
import type { TimeOfDay } from '#game/map3d/daylight.ts'
import { createForestMarks, type ForestMarks } from '#game/map3d/forestMarks.ts'
import type { ForestGround } from '#game/map3d/forestOutline.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'

export type { ClearingRingStyle } from '#game/map3d/clearingMarks.ts'
export type { ForestGround } from '#game/map3d/forestOutline.ts'

/**
 * Marks of the clearings and forests: who rules each clearing, which
 * clearings and forests can be picked, and each clearing's suit as an icon
 * over it. The clearing marks glow out of daylight only.
 */
export type GroundMarkersInput = {
  clearings: readonly ClearingGround[]
  forests: readonly ForestGround[]
  /** Suit icon of each clearing (clearing id → image path). */
  suitTexturePaths: ReadonlyMap<number, string>
  timeOfDay: TimeOfDay
}

export type GroundMarkers = {
  group: Group
  setClearingRings: (styles: ReadonlyMap<number, ClearingRingStyle>) => void
  setHighlightedForests: (forestIndexes: ReadonlySet<number>) => void
  /** Fade the glow in or out for a phase of the turn. */
  setTimeOfDay: (timeOfDay: TimeOfDay) => void
  /** Animate the marks; call once per frame. */
  update: (elapsedSeconds: number) => void
  /** 0 = zoomed all the way out, 1 = all the way in: sizes the suit badges. */
  setZoom: (zoom: number) => void
}

/** Under the full sun no mark glows; at dawn and after dark they all do. */
const GLOW_LEVEL_BY_TIME_OF_DAY: Readonly<Record<TimeOfDay, number>> = {
  birdsong: 1,
  daylight: 0,
  evening: 1,
}
/** Share of the remaining difference closed per second, like the daylight. */
const GLOW_FADE_RATE_PER_SECOND = 2.2
/** A tab coming back from the background must not jump the fade. */
const MAXIMUM_FRAME_SECONDS = 0.1

const HALF = 0.5
const FULL_TURN_RADIANS = Math.PI * 2

/** Suit badge size (world units) zoomed out and zoomed in. */
const SUIT_BADGE_FAR_SIZE = 2.1
const SUIT_BADGE_NEAR_SIZE = 0.55
const SUIT_BADGE_HEIGHT = 0.9
/** The suit icon, relative to the chip it sits on. */
const SUIT_ICON_RELATIVE_SIZE = 0.7
const SUIT_CHIP_TEXTURE_SIZE_PIXELS = 128
const SUIT_CHIP_BORDER_WIDTH_PIXELS = 6
const SUIT_CHIP_COLOR = '#f0e6d3'
const SUIT_CHIP_BORDER_COLOR = '#5b4630'
/** Over the woodland, under the piece icons. */
const SUIT_CHIP_RENDER_ORDER = 7
const SUIT_ICON_RENDER_ORDER = 8

/** A round parchment chip, drawn once, behind every suit icon. */
function createSuitChipTexture(): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = SUIT_CHIP_TEXTURE_SIZE_PIXELS
  canvas.height = SUIT_CHIP_TEXTURE_SIZE_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const center: number = SUIT_CHIP_TEXTURE_SIZE_PIXELS * HALF
    context.beginPath()
    context.arc(
      center,
      center,
      center - SUIT_CHIP_BORDER_WIDTH_PIXELS,
      0,
      FULL_TURN_RADIANS,
    )
    context.fillStyle = SUIT_CHIP_COLOR
    context.fill()
    context.lineWidth = SUIT_CHIP_BORDER_WIDTH_PIXELS
    context.strokeStyle = SUIT_CHIP_BORDER_COLOR
    context.stroke()
  }
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * The suit of a clearing: an icon laid over the map (like the piece icons),
 * on a parchment chip, at the back of the clearing's ring.
 */
function createSuitBadge(
  clearing: ClearingGround,
  textures: { suit: Texture; chip: Texture },
): Group {
  const badge: Group = new Group()
  const chip: Sprite = new Sprite(
    new SpriteMaterial({ map: textures.chip, depthTest: false }),
  )
  chip.renderOrder = SUIT_CHIP_RENDER_ORDER
  const icon: Sprite = new Sprite(
    new SpriteMaterial({ map: textures.suit, depthTest: false }),
  )
  icon.scale.setScalar(SUIT_ICON_RELATIVE_SIZE)
  icon.renderOrder = SUIT_ICON_RENDER_ORDER
  badge.add(chip, icon)
  badge.position.set(
    clearing.center.x,
    SUIT_BADGE_HEIGHT,
    clearing.center.z - clearing.radius,
  )
  return badge
}

export function createGroundMarkers(input: GroundMarkersInput): GroundMarkers {
  const { clearings, forests } = input
  const group: Group = new Group()
  const textureLoader: TextureLoader = new TextureLoader()
  const suitChipTexture: CanvasTexture = createSuitChipTexture()
  const suitBadges: Group[] = []
  for (const clearing of clearings) {
    const suitTexturePath: string | undefined = input.suitTexturePaths.get(
      clearing.clearingId,
    )
    if (suitTexturePath !== undefined) {
      const texture: Texture = textureLoader.load(suitTexturePath)
      texture.colorSpace = SRGBColorSpace
      const badge: Group = createSuitBadge(clearing, {
        suit: texture,
        chip: suitChipTexture,
      })
      badge.scale.setScalar(SUIT_BADGE_FAR_SIZE)
      suitBadges.push(badge)
      group.add(badge)
    }
  }
  const clearingMarks: ClearingMarks = createClearingMarks(clearings)
  const forestMarks: ForestMarks = createForestMarks({ forests, clearings })
  group.add(clearingMarks.group, forestMarks.group)

  let glowLevel: number = GLOW_LEVEL_BY_TIME_OF_DAY[input.timeOfDay]
  let targetGlowLevel: number = glowLevel
  let previousElapsedSeconds = 0

  return {
    group,
    setClearingRings: clearingMarks.setStyles,
    setHighlightedForests: forestMarks.setHighlighted,
    setTimeOfDay: (timeOfDay: TimeOfDay): void => {
      targetGlowLevel = GLOW_LEVEL_BY_TIME_OF_DAY[timeOfDay]
    },
    update: (elapsedSeconds: number): void => {
      const deltaSeconds: number = Math.min(
        elapsedSeconds - previousElapsedSeconds,
        MAXIMUM_FRAME_SECONDS,
      )
      previousElapsedSeconds = elapsedSeconds
      glowLevel = MathUtils.lerp(
        glowLevel,
        targetGlowLevel,
        Math.min(GLOW_FADE_RATE_PER_SECOND * deltaSeconds, 1),
      )
      clearingMarks.update({ elapsedSeconds, glowLevel })
      forestMarks.update(elapsedSeconds)
    },
    setZoom: (zoom: number): void => {
      const size: number = MathUtils.lerp(
        SUIT_BADGE_FAR_SIZE,
        SUIT_BADGE_NEAR_SIZE,
        zoom,
      )
      for (const badge of suitBadges) {
        badge.scale.setScalar(size)
      }
    },
  }
}
