import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RGBADepthPacking,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

/**
 * Pieces standing on the map. A warrior or pawn is a wooden meeple; any
 * other piece is its token art on a stand. One figure per stack, with the
 * stack size on a badge — like the digital game.
 */
export type MapPiece = {
  key: string
  /** Token texture key: picks the meeple model when one exists. */
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
  /** Turn every piece to face the camera (turn around the board, radians). */
  faceCamera: (azimuthAngle: number) => void
  dispose: () => void
}

/** Meeple models are 2.3 units tall. */
const MEEPLE_MODEL_SCALE = 1.9
const TOKEN_SIZE = 3.6
const TOKEN_ALPHA_CUTOFF = 0.5
const STAND_RADIUS = 1.25
const STAND_HEIGHT = 0.22
const STAND_SIDE_COUNT = 24
const STAND_COLOR = 0x2a2018
const FALLBACK_TOKEN_OPACITY = 1

const BADGE_TEXTURE_SIZE_PIXELS = 96
const BADGE_SIZE = 2
const BADGE_HEIGHT = 4.8
const BADGE_SIDE_OFFSET = 1.5
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

export function createPieceLayer(
  meepleModels: ReadonlyMap<string, Group>,
): PieceLayer {
  const group: Group = new Group()
  const textureLoader: TextureLoader = new TextureLoader()
  const tokenTextures: Map<string, Texture> = new Map<string, Texture>()
  const badgeTextures: Map<string, CanvasTexture> = new Map<
    string,
    CanvasTexture
  >()
  const tokenGeometry: PlaneGeometry = new PlaneGeometry(TOKEN_SIZE, TOKEN_SIZE)
  const standGeometry: CylinderGeometry = new CylinderGeometry(
    STAND_RADIUS,
    STAND_RADIUS,
    STAND_HEIGHT,
    STAND_SIDE_COUNT,
  )
  const standMaterial: MeshStandardMaterial = new MeshStandardMaterial({
    color: STAND_COLOR,
    roughness: 1,
  })
  /** The parts that turn with the camera. */
  let figures: Object3D[] = []
  let facingAngle = 0

  const tokenTexture = (path: string): Texture => {
    const cached: Texture | undefined = tokenTextures.get(path)
    if (cached !== undefined) {
      return cached
    }
    const texture: Texture = textureLoader.load(path)
    texture.colorSpace = SRGBColorSpace
    tokenTextures.set(path, texture)
    return texture
  }

  const createMeeple = (model: Group): Object3D => {
    const meeple: Object3D = model.clone()
    meeple.scale.setScalar(MEEPLE_MODEL_SCALE)
    for (const part of meshesOf(meeple)) {
      part.castShadow = true
      part.receiveShadow = true
    }
    return meeple
  }

  const createToken = (piece: MapPiece): Object3D => {
    const token: Group = new Group()
    const faceMaterial: MeshStandardMaterial = new MeshStandardMaterial({
      color: piece.texturePath === null ? piece.color : 0xffffff,
      roughness: 0.9,
      side: DoubleSide,
      alphaTest: TOKEN_ALPHA_CUTOFF,
      opacity: FALLBACK_TOKEN_OPACITY,
    })
    const face: Mesh = new Mesh(tokenGeometry, faceMaterial)
    if (piece.texturePath !== null) {
      const texture: Texture = tokenTexture(piece.texturePath)
      faceMaterial.map = texture
      // Shadow of the art, not of the square it is painted on.
      face.customDepthMaterial = new MeshDepthMaterial({
        depthPacking: RGBADepthPacking,
        map: texture,
        alphaTest: TOKEN_ALPHA_CUTOFF,
      })
    }
    face.position.y = STAND_HEIGHT + TOKEN_SIZE * HALF
    face.castShadow = true
    const stand: Mesh = new Mesh(standGeometry, standMaterial)
    stand.position.y = STAND_HEIGHT * HALF
    stand.castShadow = true
    stand.receiveShadow = true
    token.add(face, stand)
    return token
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

  const setPieces = (pieces: readonly MapPiece[]): void => {
    group.clear()
    figures = pieces.map((piece: MapPiece): Object3D => {
      const meepleModel: Group | undefined = meepleModels.get(piece.textureKey)
      const figure: Group = new Group()
      figure.add(
        meepleModel !== undefined
          ? createMeeple(meepleModel)
          : createToken(piece),
      )
      if (piece.count > 1) {
        figure.add(createBadge(piece))
      }
      figure.position.set(piece.ground.x, 0, piece.ground.z)
      figure.rotation.y = facingAngle
      group.add(figure)
      return figure
    })
  }

  return {
    group,
    setPieces,
    faceCamera: (azimuthAngle: number): void => {
      facingAngle = azimuthAngle
      for (const figure of figures) {
        figure.rotation.y = azimuthAngle
      }
    },
    dispose: (): void => {
      group.clear()
      tokenGeometry.dispose()
      standGeometry.dispose()
      standMaterial.dispose()
      tokenTextures.forEach((texture: Texture): void => {
        texture.dispose()
      })
      badgeTextures.forEach((texture: CanvasTexture): void => {
        texture.dispose()
      })
    },
  }
}
