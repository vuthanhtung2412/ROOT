import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import {
  createBuildAnimations,
  type BuildAnimations,
  type BuildSite,
} from '#game/map3d/buildAnimation.ts'
import type { PieceModel } from '#game/map3d/mapModels.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

/**
 * Everything standing in the clearings. A piece is shown two ways at once:
 * - its 2D token icon (with the stack size on a badge), laid over the map;
 * - its 3D model: a structure for a building, a wooden meeple for a warrior.
 * Zoomed out, only the icons show, large, like on the flat map. Zooming in,
 * the models rise and the icons shrink to small labels above them.
 * An empty building slot is a staked-out plot, always in 3D.
 */
export type MapPieceShape = 'slot' | 'piece'

export type MapPiece = {
  key: string
  shape: MapPieceShape
  /** Token texture key: picks the 3D model of the piece. */
  textureKey: string
  texturePath: string | null
  /** Faction colour, 0xRRGGBB. */
  color: number
  count: number
  ground: MapGroundPoint
  /** Turn of a building plot and of the structure on it, radians. */
  rotation?: number
}

export type PieceLayer = {
  group: Group
  setPieces: (pieces: readonly MapPiece[]) => void
  /** 0 = zoomed all the way out, 1 = all the way in. Call once per frame. */
  setZoom: (zoom: number) => void
  /** The pieces with these keys were just built: play them going up. */
  playBuild: (pieceKeys: readonly string[]) => void
  /** Call once per frame. */
  update: (deltaSeconds: number) => void
  dispose: () => void
}

/** A piece on the map and the parts that change with the zoom. */
type PieceView = {
  ground: MapGroundPoint
  label: Group
  model: Object3D | null
  modelScale: number
  /** Height of the model's top, at full size. */
  modelTop: number
}

/**
 * World units per metre of the Blender file. Every model is exported at its
 * size next to the others (keep 6 m, building 3 m, warrior 0.75 m), so one
 * scale fits them all.
 */
const MODEL_WORLD_SCALE = 0.9
const MATTE_MINIMUM_ROUGHNESS = 0.8
const DECAL_ALPHA_CUTOFF = 0.5

/**
 * Icon size (world units). Shrinks with the whole zoom range: big when the
 * map is a flat overview, tiny when the camera is among the 3D pieces.
 */
const LABEL_FAR_SIZE = 2.3
const LABEL_NEAR_SIZE = 0.36
/** A piece without a 3D model still shrinks, but stays a bit more readable. */
const LABEL_NEAR_SIZE_WITHOUT_MODEL = 0.55
const LABEL_FAR_HEIGHT = 0.8
/** Gap between the top of a model and its label. */
const LABEL_CLEARANCE = 0.6
/** The models grow in over this part of the zoom. */
const MODEL_RISE_START_ZOOM = 0.12
const MODEL_RISE_END_ZOOM = 0.5
const MODEL_HIDDEN_BELOW_GROWTH = 0.02
/** Icons draw over the woodland, badges over the icons. */
const LABEL_RENDER_ORDER = 9
const BADGE_RENDER_ORDER = 10
/** Badge, relative to its icon: half its size, on its top right corner. */
const BADGE_RELATIVE_SIZE = 0.5
const BADGE_SPRITE_CENTER = -0.3

const SLOT_SIZE = 1.9
const SLOT_HEIGHT = 0.16
const SLOT_COLOR = 0x8a7550
const SLOT_FLOOR_SIZE = 1.5
const SLOT_FLOOR_COLOR = 0x5c4c34
const SLOT_FLOOR_LIFT = 0.02
const SLOT_POST_SIZE = 0.26
const SLOT_POST_HEIGHT = 0.5
const SLOT_POST_COLOR = 0xe9dfc4
/** Corner posts stand at (±1, ±1) × the post offset. */
const SLOT_CORNER_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

const BADGE_TEXTURE_SIZE_PIXELS = 96
const BADGE_BORDER_WIDTH_PIXELS = 7
const BADGE_BORDER_COLOR = '#f0e6d3'
const BADGE_TEXT_COLOR = '#ffffff'
const BADGE_FONT = 'bold 58px Georgia, serif'
const BADGE_TEXT_BASELINE_NUDGE_PIXELS = 4
const HALF = 0.5
const FULL_TURN_RADIANS = Math.PI * 2
const HEX_RADIX = 16
const HEX_COLOR_DIGIT_COUNT = 6

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
  pieceModels: ReadonlyMap<string, PieceModel>,
): PieceLayer {
  const group: Group = new Group()
  const buildAnimations: BuildAnimations = createBuildAnimations()
  // The pieces are rebuilt on every board update; the dust outlives them.
  const layer: Group = new Group()
  layer.add(group, buildAnimations.group)
  const textureLoader: TextureLoader = new TextureLoader()
  const iconMaterials: Map<string, SpriteMaterial> = new Map<
    string,
    SpriteMaterial
  >()
  const badgeMaterials: Map<string, SpriteMaterial> = new Map<
    string,
    SpriteMaterial
  >()
  const matteMaterials: Map<Material, Material> = new Map<Material, Material>()
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
  const slotMaterial: MeshStandardMaterial = standardMaterial(SLOT_COLOR)
  const slotFloorMaterial: MeshStandardMaterial =
    standardMaterial(SLOT_FLOOR_COLOR)
  const slotPostMaterial: MeshStandardMaterial =
    standardMaterial(SLOT_POST_COLOR)
  let views: PieceView[] = []
  let viewsByKey: Map<string, PieceView> = new Map<string, PieceView>()
  let currentZoom = 0
  /** How much of their full size the models show at the current zoom. */
  let currentGrowth = 0

  const iconMaterial = (piece: MapPiece): SpriteMaterial => {
    const materialKey: string = piece.texturePath ?? colorToCss(piece.color)
    const cached: SpriteMaterial | undefined = iconMaterials.get(materialKey)
    if (cached !== undefined) {
      return cached
    }
    const material: SpriteMaterial = new SpriteMaterial({
      color: piece.texturePath === null ? piece.color : 0xffffff,
      depthTest: false,
    })
    if (piece.texturePath !== null) {
      const texture: Texture = textureLoader.load(piece.texturePath)
      texture.colorSpace = SRGBColorSpace
      material.map = texture
    }
    iconMaterials.set(materialKey, material)
    return material
  }

  const badgeMaterial = (piece: MapPiece): SpriteMaterial => {
    const materialKey: string = `${String(piece.count)}:${String(piece.color)}`
    const cached: SpriteMaterial | undefined = badgeMaterials.get(materialKey)
    if (cached !== undefined) {
      return cached
    }
    const material: SpriteMaterial = new SpriteMaterial({
      map: createBadgeTexture(piece.count, piece.color),
      depthTest: false,
    })
    badgeMaterials.set(materialKey, material)
    return material
  }

  /** The 2D token icon, with the stack size pinned on its corner. */
  const createLabel = (piece: MapPiece): Group => {
    const label: Group = new Group()
    const icon: Sprite = new Sprite(iconMaterial(piece))
    icon.renderOrder = LABEL_RENDER_ORDER
    label.add(icon)
    if (piece.count > 1) {
      const badge: Sprite = new Sprite(badgeMaterial(piece))
      badge.scale.setScalar(BADGE_RELATIVE_SIZE)
      // Anchored off-centre, so it sits on the icon's corner on screen.
      badge.center.set(BADGE_SPRITE_CENTER, BADGE_SPRITE_CENTER)
      badge.renderOrder = BADGE_RENDER_ORDER
      label.add(badge)
    }
    return label
  }

  /** An empty building slot: a plot staked out with four corner posts. */
  const createSlot = (): Object3D => {
    const slot: Group = new Group()
    const plot: Mesh = shadowedMesh(slotGeometry, slotMaterial)
    plot.position.y = SLOT_HEIGHT * HALF
    const floor: Mesh = new Mesh(slotFloorGeometry, slotFloorMaterial)
    floor.position.y = SLOT_HEIGHT * HALF + SLOT_FLOOR_LIFT
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

  /**
   * Downloaded models often come fully metallic, which renders near black
   * without an environment to reflect: painted wood and stone are matte.
   */
  const matteMaterial = (material: Material): Material => {
    const cached: Material | undefined = matteMaterials.get(material)
    if (cached !== undefined) {
      return cached
    }
    const matte: Material = material.clone()
    if (matte instanceof MeshStandardMaterial) {
      matte.metalness = 0
      matte.roughness = Math.max(matte.roughness, MATTE_MINIMUM_ROUGHNESS)
    }
    // A decal (a face painted on a statue) is cut out, not blended: blended
    // faces sort badly against the woodland behind them.
    if (matte.transparent) {
      matte.transparent = false
      matte.alphaTest = DECAL_ALPHA_CUTOFF
    }
    matteMaterials.set(material, matte)
    return matte
  }

  /** The 3D model of a piece, feet on the ground, sized for a clearing. */
  const createModel = (
    piece: MapPiece,
    pieceModel: PieceModel,
  ): { model: Object3D; scale: number; top: number } => {
    const figure: Object3D = pieceModel.model.clone()
    for (const part of meshesOf(figure)) {
      part.castShadow = true
      part.receiveShadow = true
      part.material = Array.isArray(part.material)
        ? part.material.map(matteMaterial)
        : matteMaterial(part.material)
    }
    if (pieceModel.kind === 'meeple') {
      const height: number = new Box3()
        .setFromObject(figure)
        .getSize(new Vector3()).y
      return {
        model: figure,
        scale: MODEL_WORLD_SCALE,
        top: height * MODEL_WORLD_SCALE,
      }
    }
    // A structure comes at any origin: centre it on its plot.
    // Scale lives on a wrapper group so the foot offset stays in model units.
    const bounds: Box3 = new Box3().setFromObject(figure)
    const size: Vector3 = bounds.getSize(new Vector3())
    const center: Vector3 = bounds.getCenter(new Vector3())
    figure.position.set(-center.x, -bounds.min.y, -center.z)
    const structure: Group = new Group()
    structure.add(figure)
    structure.rotation.y = piece.rotation ?? 0
    return {
      model: structure,
      scale: MODEL_WORLD_SCALE,
      top: size.y * MODEL_WORLD_SCALE,
    }
  }

  /**
   * Icons track the full zoom (0..1), not only the model-rise window, so
   * they keep getting smaller the closer the camera gets.
   */
  const labelSize = (view: PieceView): number =>
    MathUtils.lerp(
      LABEL_FAR_SIZE,
      view.model === null ? LABEL_NEAR_SIZE_WITHOUT_MODEL : LABEL_NEAR_SIZE,
      MathUtils.smoothstep(currentZoom, 0, 1),
    )

  const applyZoom = (): void => {
    const growth: number = MathUtils.smoothstep(
      currentZoom,
      MODEL_RISE_START_ZOOM,
      MODEL_RISE_END_ZOOM,
    )
    currentGrowth = growth
    for (const view of views) {
      view.label.scale.setScalar(labelSize(view))
      if (view.model === null) {
        view.label.position.y = LABEL_FAR_HEIGHT
        continue
      }
      view.model.visible = growth > MODEL_HIDDEN_BELOW_GROWTH
      view.model.scale.setScalar(view.modelScale * growth)
      view.label.position.y = MathUtils.lerp(
        LABEL_FAR_HEIGHT,
        view.modelTop + LABEL_CLEARANCE,
        growth,
      )
    }
  }

  const buildSiteOf = (pieceKey: string): BuildSite | undefined => {
    const view: PieceView | undefined = viewsByKey.get(pieceKey)
    return view === undefined
      ? undefined
      : {
          ground: view.ground,
          model: view.model,
          riseHeight: view.modelTop * currentGrowth,
          label: view.label,
          labelSize: labelSize(view),
        }
  }

  return {
    group: layer,
    setPieces: (pieces: readonly MapPiece[]): void => {
      group.clear()
      views = []
      viewsByKey = new Map<string, PieceView>()
      const addView = (pieceKey: string, view: PieceView): void => {
        views.push(view)
        viewsByKey.set(pieceKey, view)
      }
      for (const piece of pieces) {
        const holder: Group = new Group()
        holder.position.set(piece.ground.x, 0, piece.ground.z)
        group.add(holder)
        if (piece.shape === 'slot') {
          const slot: Object3D = createSlot()
          slot.rotation.y = piece.rotation ?? 0
          holder.add(slot)
          continue
        }
        const label: Group = createLabel(piece)
        holder.add(label)
        const pieceModel: PieceModel | undefined = pieceModels.get(
          piece.textureKey,
        )
        if (pieceModel === undefined) {
          addView(piece.key, {
            ground: piece.ground,
            label,
            model: null,
            modelScale: 1,
            modelTop: 0,
          })
          continue
        }
        const created: { model: Object3D; scale: number; top: number } =
          createModel(piece, pieceModel)
        holder.add(created.model)
        addView(piece.key, {
          ground: piece.ground,
          label,
          model: created.model,
          modelScale: created.scale,
          modelTop: created.top,
        })
      }
      applyZoom()
    },
    setZoom: (zoom: number): void => {
      if (zoom === currentZoom) {
        return
      }
      currentZoom = zoom
      applyZoom()
    },
    playBuild: buildAnimations.play,
    update: (deltaSeconds: number): void => {
      buildAnimations.update(deltaSeconds, buildSiteOf)
    },
    dispose: (): void => {
      group.clear()
      buildAnimations.dispose()
      for (const geometry of [
        slotGeometry,
        slotFloorGeometry,
        slotPostGeometry,
      ]) {
        geometry.dispose()
      }
      for (const material of [
        slotMaterial,
        slotFloorMaterial,
        slotPostMaterial,
        ...iconMaterials.values(),
        ...badgeMaterials.values(),
      ]) {
        material.map?.dispose()
        material.dispose()
      }
    },
  }
}
