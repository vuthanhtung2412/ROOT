import {
  CanvasTexture,
  CircleGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'

/**
 * Marks of the clearings and forests: the ring around each clearing (ruler
 * colour, or gold when it can be picked), its suit as an icon over it, and the
 * gold wash over a forest to pick.
 */
export type GroundMarkersInput = {
  clearings: readonly ClearingGround[]
  forests: readonly ForestGround[]
  /** Suit icon of each clearing (clearing id → image path). */
  suitTexturePaths: ReadonlyMap<number, string>
}

export type ForestGround = {
  forestIndex: number
  corners: readonly MapGroundPoint[]
}

export type ClearingRingStyle = {
  /** 0xRRGGBB. */
  color: number
  opacity: number
  highlighted: boolean
}

export type GroundMarkers = {
  group: Group
  setClearingRings: (styles: ReadonlyMap<number, ClearingRingStyle>) => void
  setHighlightedForests: (forestIndexes: ReadonlySet<number>) => void
  /** Pulse the highlights; call once per frame. */
  update: (elapsedSeconds: number) => void
  /** 0 = zoomed all the way out, 1 = all the way in: sizes the suit badges. */
  setZoom: (zoom: number) => void
}

const RING_INNER_RADIUS_RATIO = 0.93
const HIGHLIGHT_RING_INNER_RADIUS_RATIO = 0.86
const RING_SEGMENT_COUNT = 72
/** Just above the board, each layer a hair higher, so nothing flickers. */
const RING_HEIGHT = 0.06
const FILL_HEIGHT = 0.05
const FOREST_HEIGHT = 0.04
const HIGHLIGHT_COLOR = 0xe0b352
const FILL_BASE_OPACITY = 0.22
const FOREST_BASE_OPACITY = 0.34
const PULSE_DEPTH = 0.45
const PULSE_RADIANS_PER_SECOND = 4
const QUARTER_TURN_RADIANS = Math.PI / 2

const HALF = 0.5
const FULL_TURN_RADIANS = Math.PI * 2

/** Suit badge size (world units) zoomed out and zoomed in. */
const SUIT_BADGE_FAR_SIZE = 2.1
const SUIT_BADGE_NEAR_SIZE = 1.15
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

type ClearingMark = {
  ring: Mesh
  highlightRing: Mesh
  fill: Mesh
  ringMaterial: MeshBasicMaterial
}

function createFlatMaterial(color: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    depthWrite: false,
  })
}

function layFlat(mesh: Mesh, center: MapGroundPoint, height: number): Mesh {
  mesh.rotateX(-QUARTER_TURN_RADIANS)
  mesh.position.set(center.x, height, center.z)
  return mesh
}

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
  const highlightMaterial: MeshBasicMaterial =
    createFlatMaterial(HIGHLIGHT_COLOR)
  const fillMaterial: MeshBasicMaterial = createFlatMaterial(HIGHLIGHT_COLOR)
  const forestMaterial: MeshBasicMaterial = createFlatMaterial(HIGHLIGHT_COLOR)

  const clearingMarks: Map<number, ClearingMark> = new Map<
    number,
    ClearingMark
  >()
  for (const clearing of clearings) {
    const ringMaterial: MeshBasicMaterial = createFlatMaterial(0xffffff)
    const mark: ClearingMark = {
      ringMaterial,
      ring: layFlat(
        new Mesh(
          new RingGeometry(
            clearing.radius * RING_INNER_RADIUS_RATIO,
            clearing.radius,
            RING_SEGMENT_COUNT,
          ),
          ringMaterial,
        ),
        clearing.center,
        RING_HEIGHT,
      ),
      highlightRing: layFlat(
        new Mesh(
          new RingGeometry(
            clearing.radius * HIGHLIGHT_RING_INNER_RADIUS_RATIO,
            clearing.radius,
            RING_SEGMENT_COUNT,
          ),
          highlightMaterial,
        ),
        clearing.center,
        RING_HEIGHT,
      ),
      fill: layFlat(
        new Mesh(
          new CircleGeometry(clearing.radius, RING_SEGMENT_COUNT),
          fillMaterial,
        ),
        clearing.center,
        FILL_HEIGHT,
      ),
    }
    mark.highlightRing.visible = false
    mark.fill.visible = false
    clearingMarks.set(clearing.clearingId, mark)
    group.add(mark.ring, mark.highlightRing, mark.fill)
  }

  const forestMarks: Map<number, Mesh> = new Map<number, Mesh>()
  for (const forest of forests) {
    // A flat shape lies in x / y; laid down, its y becomes -z.
    const outline: Shape = new Shape()
    forest.corners.forEach((corner: MapGroundPoint, index: number): void => {
      if (index === 0) {
        outline.moveTo(corner.x, -corner.z)
      } else {
        outline.lineTo(corner.x, -corner.z)
      }
    })
    const mark: Mesh = layFlat(
      new Mesh(new ShapeGeometry(outline), forestMaterial),
      { x: 0, z: 0 },
      FOREST_HEIGHT,
    )
    mark.visible = false
    forestMarks.set(forest.forestIndex, mark)
    group.add(mark)
  }

  return {
    group,
    setClearingRings: (
      styles: ReadonlyMap<number, ClearingRingStyle>,
    ): void => {
      for (const [clearingId, mark] of clearingMarks) {
        const style: ClearingRingStyle | undefined = styles.get(clearingId)
        const highlighted: boolean = style?.highlighted === true
        mark.ring.visible = style !== undefined && !highlighted
        mark.highlightRing.visible = highlighted
        mark.fill.visible = highlighted
        if (style !== undefined) {
          mark.ringMaterial.color.set(style.color)
          mark.ringMaterial.opacity = style.opacity
        }
      }
    },
    setHighlightedForests: (forestIndexes: ReadonlySet<number>): void => {
      for (const [forestIndex, mark] of forestMarks) {
        mark.visible = forestIndexes.has(forestIndex)
      }
    },
    update: (elapsedSeconds: number): void => {
      const pulse: number =
        1 -
        PULSE_DEPTH *
          (0.5 + 0.5 * Math.sin(elapsedSeconds * PULSE_RADIANS_PER_SECOND))
      highlightMaterial.opacity = pulse
      fillMaterial.opacity = FILL_BASE_OPACITY * pulse
      forestMaterial.opacity = FOREST_BASE_OPACITY * pulse
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
