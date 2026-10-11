import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
 * colour, or gold when it can be picked), its suit on a signpost, and the
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
const HALF = 0.5

const SIGN_HEIGHT = 5.2
const SIGN_POST_RADIUS = 0.16
const SIGN_POST_SIDE_COUNT = 8
const SIGN_POST_COLOR = 0x5a3f2b
const SIGN_BOARD_RADIUS = 1.45
const SIGN_BOARD_THICKNESS = 0.3
const SIGN_BOARD_SIDE_COUNT = 32
const SIGN_BOARD_COLOR = 0xf0e6d3
const SIGN_ICON_SIZE = 2
/** The sign stands at the back-left edge of its clearing. */
const SIGN_SIDE_RATIO = 0.72
const SIGN_BACK_RATIO = 0.72
const SIGN_LEAN_RADIANS = -0.25

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

/** The suit of a clearing, on a signpost at its back edge. */
function createSuitSign(clearing: ClearingGround, texture: Texture): Group {
  const sign: Group = new Group()
  const post: Mesh = new Mesh(
    new CylinderGeometry(
      SIGN_POST_RADIUS,
      SIGN_POST_RADIUS,
      SIGN_HEIGHT,
      SIGN_POST_SIDE_COUNT,
    ),
    new MeshStandardMaterial({ color: SIGN_POST_COLOR, roughness: 1 }),
  )
  post.position.y = SIGN_HEIGHT * HALF
  post.castShadow = true
  const board: Mesh = new Mesh(
    new CylinderGeometry(
      SIGN_BOARD_RADIUS,
      SIGN_BOARD_RADIUS,
      SIGN_BOARD_THICKNESS,
      SIGN_BOARD_SIDE_COUNT,
    ),
    new MeshStandardMaterial({ color: SIGN_BOARD_COLOR, roughness: 0.9 }),
  )
  board.rotateX(QUARTER_TURN_RADIANS)
  board.position.y = SIGN_HEIGHT
  board.castShadow = true
  const icon: Sprite = new Sprite(new SpriteMaterial({ map: texture }))
  icon.scale.set(SIGN_ICON_SIZE, SIGN_ICON_SIZE, 1)
  icon.position.set(0, SIGN_HEIGHT, SIGN_BOARD_THICKNESS)
  sign.add(post, board, icon)
  sign.position.set(
    clearing.center.x - clearing.radius * SIGN_SIDE_RATIO,
    0,
    clearing.center.z - clearing.radius * SIGN_BACK_RATIO,
  )
  sign.rotateX(SIGN_LEAN_RADIANS)
  return sign
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
      group.add(createSuitSign(clearing, texture))
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
