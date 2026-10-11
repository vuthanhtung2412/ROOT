import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type BufferGeometry,
  type Material,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

/**
 * Everything standing in the clearings:
 * - `slot`: an empty building plot (one per building slot of the clearing);
 * - `tile`: a building — a square cardboard tile standing on its plot;
 * - `disc`: a round cardboard token (wood, sympathy, keep, ruin …);
 * - `figure`: a warrior or pawn — a wooden meeple.
 * One piece per stack, with the stack size on a badge.
 */
export type MapPieceShape = 'slot' | 'tile' | 'disc' | 'figure'

export type MapPiece = {
  key: string
  shape: MapPieceShape
  /** Token texture key: picks the meeple model of a figure. */
  textureKey: string
  texturePath: string | null
  /** Faction colour, 0xRRGGBB. */
  color: number
  count: number
  ground: MapGroundPoint
}

export type PieceLayer = {
  group: Group
  setPieces: (pieces: readonly MapPiece[]) => void
  dispose: () => void
}

/** Meeple models are 2.3 units tall. */
const MEEPLE_MODEL_SCALE = 1.9
const TOKEN_SIZE = 3.7
const TOKEN_THICKNESS = 0.42
/** Cardboard leans back a little so its face meets the camera. */
const TOKEN_LEAN_RADIANS = -0.6
const DISC_SIDE_COUNT = 40
const CARDBOARD_EDGE_COLOR = 0xcdb98c
const QUARTER_TURN_RADIANS = Math.PI / 2

const SLOT_SIZE = 4.1
const SLOT_HEIGHT = 0.28
const SLOT_COLOR = 0x8a7550
const SLOT_FLOOR_SIZE = 3.3
const SLOT_FLOOR_COLOR = 0x5c4c34
const SLOT_POST_SIZE = 0.5
const SLOT_POST_HEIGHT = 0.95
const SLOT_POST_COLOR = 0xe9dfc4
/** Corner posts stand at (±1, ±1) × this offset. */
const SLOT_CORNER_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

const BADGE_TEXTURE_SIZE_PIXELS = 96
const BADGE_SIZE = 2
const BADGE_HEIGHT = 4.8
const BADGE_SIDE_OFFSET = 1.6
const BADGE_BORDER_WIDTH_PIXELS = 7
const BADGE_BORDER_COLOR = '#f0e6d3'
const BADGE_TEXT_COLOR = '#ffffff'
const BADGE_FONT = 'bold 58px Georgia, serif'
const BADGE_TEXT_BASELINE_NUDGE_PIXELS = 4
const HALF = 0.5
const FULL_TURN_RADIANS = Math.PI * 2
const HEX_RADIX = 16
const HEX_COLOR_DIGIT_COUNT = 6
/** Badges draw after the trees so a stack size is never hidden. */
const BADGE_RENDER_ORDER = 10

function colorToCss(color: number): string {
  return `#${color.toString(HEX_RADIX).padStart(HEX_COLOR_DIGIT_COUNT, '0')}`
}

function createBadgeTexture(count: number, color: number): CanvasTexture {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = BADGE_TEXTURE_SIZE_PIXELS
  canvas.height = BADGE_TEXTURE_SIZE_PIXELS
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d')
  if (context !== null) {
    const center: number = BADGE_TEXTURE_SIZE_PIXELS * HALF
    context.beginPath()
    context.arc(
      center,
      center,
      center - BADGE_BORDER_WIDTH_PIXELS,
      0,
      FULL_TURN_RADIANS,
    )
    context.fillStyle = colorToCss(color)
    context.fill()
    context.lineWidth = BADGE_BORDER_WIDTH_PIXELS
    context.strokeStyle = BADGE_BORDER_COLOR
    context.stroke()
    context.font = BADGE_FONT
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = BADGE_TEXT_COLOR
    context.fillText(
      String(count),
      center,
      center + BADGE_TEXT_BASELINE_NUDGE_PIXELS,
    )
  }
  const texture: CanvasTexture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function standardMaterial(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.9 })
}

function shadowedMesh(
  geometry: BufferGeometry,
  material: Material | Material[],
): Mesh {
  const mesh: Mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createPieceLayer(
  meepleModels: ReadonlyMap<string, Group>,
): PieceLayer {
  const group: Group = new Group()
  const textureLoader: TextureLoader = new TextureLoader()
  const faceMaterials: Map<string, MeshStandardMaterial> = new Map<
    string,
    MeshStandardMaterial
  >()
  const badgeTextures: Map<string, CanvasTexture> = new Map<
    string,
    CanvasTexture
  >()
  const tileGeometry: BoxGeometry = new BoxGeometry(
    TOKEN_SIZE,
    TOKEN_SIZE,
    TOKEN_THICKNESS,
  )
  const discGeometry: CylinderGeometry = new CylinderGeometry(
    TOKEN_SIZE * HALF,
    TOKEN_SIZE * HALF,
    TOKEN_THICKNESS,
    DISC_SIDE_COUNT,
  )
  const slotGeometry: BoxGeometry = new BoxGeometry(
    SLOT_SIZE,
    SLOT_HEIGHT,
    SLOT_SIZE,
  )
  const slotFloorGeometry: BoxGeometry = new BoxGeometry(
    SLOT_FLOOR_SIZE,
    SLOT_HEIGHT,
    SLOT_FLOOR_SIZE,
  )
  const slotPostGeometry: BoxGeometry = new BoxGeometry(
    SLOT_POST_SIZE,
    SLOT_POST_HEIGHT,
    SLOT_POST_SIZE,
  )
  const edgeMaterial: MeshStandardMaterial =
    standardMaterial(CARDBOARD_EDGE_COLOR)
  const slotMaterial: MeshStandardMaterial = standardMaterial(SLOT_COLOR)
  const slotFloorMaterial: MeshStandardMaterial =
    standardMaterial(SLOT_FLOOR_COLOR)
  const slotPostMaterial: MeshStandardMaterial =
    standardMaterial(SLOT_POST_COLOR)

  /** The printed face of a cardboard piece. */
  const faceMaterial = (piece: MapPiece): MeshStandardMaterial => {
    const materialKey: string = piece.texturePath ?? colorToCss(piece.color)
    const cached: MeshStandardMaterial | undefined =
      faceMaterials.get(materialKey)
    if (cached !== undefined) {
      return cached
    }
    const material: MeshStandardMaterial = standardMaterial(
      piece.texturePath === null ? piece.color : 0xffffff,
    )
    if (piece.texturePath !== null) {
      const texture: Texture = textureLoader.load(piece.texturePath)
      texture.colorSpace = SRGBColorSpace
      material.map = texture
    }
    faceMaterials.set(materialKey, material)
    return material
  }

  /** An empty building slot: a plot staked out with four corner posts. */
  const createSlot = (): Object3D => {
    const slot: Group = new Group()
    const plot: Mesh = shadowedMesh(slotGeometry, slotMaterial)
    plot.position.y = SLOT_HEIGHT * HALF
    const floor: Mesh = new Mesh(slotFloorGeometry, slotFloorMaterial)
    floor.position.y = SLOT_HEIGHT * HALF + 0.02
    floor.receiveShadow = true
    slot.add(plot, floor)
    const postOffset: number = (SLOT_SIZE - SLOT_POST_SIZE) * HALF
    for (const [signX, signZ] of SLOT_CORNER_SIGNS) {
      const post: Mesh = shadowedMesh(slotPostGeometry, slotPostMaterial)
      post.position.set(
        signX * postOffset,
        SLOT_POST_HEIGHT * HALF,
        signZ * postOffset,
      )
      slot.add(post)
    }
    return slot
  }

  /** A square building tile, standing on the plot it was built on. */
  const createTile = (piece: MapPiece): Object3D => {
    const face: MeshStandardMaterial = faceMaterial(piece)
    // Box faces: +x, -x, +y, -y, +z (front), -z (back).
    const materials: Material[] = [
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
      face,
      face,
    ]
    const tile: Mesh = shadowedMesh(tileGeometry, materials)
    tile.position.y = TOKEN_SIZE * HALF
    const holder: Group = new Group()
    holder.add(tile)
    holder.rotation.x = TOKEN_LEAN_RADIANS
    return holder
  }

  /** A round token, standing on its edge. */
  const createDisc = (piece: MapPiece): Object3D => {
    const face: MeshStandardMaterial = faceMaterial(piece)
    // Cylinder faces: side, top cap, bottom cap.
    const disc: Mesh = shadowedMesh(discGeometry, [edgeMaterial, face, face])
    // Stand the disc up: its printed top cap turns towards the camera, and a
    // quarter turn about its own axis brings the art upright.
    disc.rotation.set(QUARTER_TURN_RADIANS, QUARTER_TURN_RADIANS, 0)
    disc.position.y = TOKEN_SIZE * HALF
    const holder: Group = new Group()
    holder.add(disc)
    holder.rotation.x = TOKEN_LEAN_RADIANS
    return holder
  }

  const createFigure = (piece: MapPiece): Object3D => {
    const model: Group | undefined = meepleModels.get(piece.textureKey)
    if (model === undefined) {
      return createDisc(piece)
    }
    const meeple: Object3D = model.clone()
    meeple.scale.setScalar(MEEPLE_MODEL_SCALE)
    for (const part of meshesOf(meeple)) {
      part.castShadow = true
      part.receiveShadow = true
    }
    return meeple
  }

  const createBadge = (piece: MapPiece): Sprite => {
    const badgeKey: string = `${String(piece.count)}:${String(piece.color)}`
    const texture: CanvasTexture =
      badgeTextures.get(badgeKey) ??
      createBadgeTexture(piece.count, piece.color)
    badgeTextures.set(badgeKey, texture)
    const badge: Sprite = new Sprite(
      new SpriteMaterial({ map: texture, depthTest: false }),
    )
    badge.scale.setScalar(BADGE_SIZE)
    badge.position.set(BADGE_SIDE_OFFSET, BADGE_HEIGHT, 0)
    badge.renderOrder = BADGE_RENDER_ORDER
    return badge
  }

  const createPiece = (piece: MapPiece): Object3D => {
    if (piece.shape === 'slot') {
      return createSlot()
    }
    if (piece.shape === 'tile') {
      return createTile(piece)
    }
    if (piece.shape === 'disc') {
      return createDisc(piece)
    }
    return createFigure(piece)
  }

  return {
    group,
    setPieces: (pieces: readonly MapPiece[]): void => {
      group.clear()
      for (const piece of pieces) {
        const holder: Group = new Group()
        holder.add(createPiece(piece))
        if (piece.count > 1) {
          holder.add(createBadge(piece))
        }
        holder.position.set(piece.ground.x, 0, piece.ground.z)
        group.add(holder)
      }
    },
    dispose: (): void => {
      group.clear()
      for (const geometry of [
        tileGeometry,
        discGeometry,
        slotGeometry,
        slotFloorGeometry,
        slotPostGeometry,
      ]) {
        geometry.dispose()
      }
      for (const material of [
        edgeMaterial,
        slotMaterial,
        slotFloorMaterial,
        slotPostMaterial,
        ...faceMaterials.values(),
      ]) {
        material.map?.dispose()
        material.dispose()
      }
      for (const texture of badgeTextures.values()) {
        texture.dispose()
      }
    },
  }
}
