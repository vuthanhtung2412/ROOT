import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'

/**
 * Marks of the clearings and forests: the ring around each clearing (ruler
 * colour, or gold when it can be picked), its suit on a medallion, and the
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

const SUIT_MEDALLION_RADIUS = 1.7
const SUIT_MEDALLION_SEGMENT_COUNT = 40
const SUIT_MEDALLION_COLOR = 0xf0e6d3
const SUIT_ICON_SIZE = 2.3
/** Above the ring it is set into; the icon a hair above the medallion. */
const SUIT_MEDALLION_HEIGHT = 0.08
const SUIT_ICON_HEIGHT = 0.1

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

/**
 * The suit of a clearing, lying on the ground: a parchment medallion set
 * into the back of the clearing's ring, with the suit drawn on it.
 */
function createSuitMark(clearing: ClearingGround, texture: Texture): Group {
  const mark: Group = new Group()
  const center: MapGroundPoint = {
    x: clearing.center.x,
    z: clearing.center.z - clearing.radius,
  }
  const medallion: Mesh = layFlat(
    new Mesh(
      new CircleGeometry(SUIT_MEDALLION_RADIUS, SUIT_MEDALLION_SEGMENT_COUNT),
      new MeshStandardMaterial({ color: SUIT_MEDALLION_COLOR, roughness: 1 }),
    ),
    center,
    SUIT_MEDALLION_HEIGHT,
  )
  medallion.receiveShadow = true
  const icon: Mesh = layFlat(
    new Mesh(
      new PlaneGeometry(SUIT_ICON_SIZE, SUIT_ICON_SIZE),
      new MeshBasicMaterial({ map: texture, transparent: true }),
    ),
    center,
    SUIT_ICON_HEIGHT,
  )
  mark.add(medallion, icon)
  return mark
}

export function createGroundMarkers(input: GroundMarkersInput): GroundMarkers {
  const { clearings, forests } = input
  const group: Group = new Group()
  const textureLoader: TextureLoader = new TextureLoader()
  for (const clearing of clearings) {
    const suitTexturePath: string | undefined = input.suitTexturePaths.get(
      clearing.clearingId,
    )
    if (suitTexturePath !== undefined) {
      const texture: Texture = textureLoader.load(suitTexturePath)
      texture.colorSpace = SRGBColorSpace
      group.add(createSuitMark(clearing, texture))
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
  }
}
