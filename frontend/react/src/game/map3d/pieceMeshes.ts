import {
  Box3,
  Group,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Intersection,
  type Material,
  type Raycaster,
} from 'three'
import {
  createBuildAnimations,
  type BuildAnimations,
  type BuildSite,
} from '#game/map3d/buildAnimation.ts'
import {
  colorToCss,
  createBadgeTexture,
  createIconTexture,
} from '#game/map3d/iconTexture.ts'
import { isLabelShown } from '#game/map3d/labelVisibility.ts'
import type { PieceModel, PieceModels } from '#game/map3d/mapModels.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import {
  createMeepleStackModel,
  type MeepleStackModel,
} from '#game/map3d/meepleStackModel.ts'
import { isSameMapPiece } from '#game/map3d/sameMapPiece.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'
import {
  createSlotDrawings,
  type SlotDrawings,
} from '#game/map3d/slotDrawing.ts'

/**
 * Everything standing in the clearings. A piece is shown two ways at once:
 * - its 2D token icon (with the stack size on a badge), laid over the map;
 * - its 3D model: a structure for a building, or one wooden meeple per
 *   warrior in the stack, packed tight on the ground.
 * Zoomed out, only the icons show, large, like on the flat map. Zooming in,
 * the models rise and the icons shrink to small labels above them; zoomed
 * in all the way, an icon shows only while the pointer is over its piece.
 * An empty building slot is a drawing on the ground, at every zoom.
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
  /** A building: its square icon gets rounded corners. */
  isBuilding?: boolean
  /** A Vagabond pawn standing in a forest, among the trees. */
  isInForest?: boolean
}

export type PieceLayer = {
  group: Group
  setPieces: (pieces: readonly MapPiece[]) => void
  /** The 3D models arrived: the pieces on the map take theirs. */
  setPieceModels: (pieceModels: PieceModels) => void
  /** The Vagabond holds a torch: out in the evening, put away otherwise. */
  setTorchesShown: (shown: boolean) => void
  /** 0 = zoomed all the way out, 1 = all the way in. Call once per frame. */
  setZoom: (zoom: number) => void
  /** The pointer's ray, or null off the map: zoomed in, it shows an icon. */
  hoverAt: (raycaster: Raycaster | null) => void
  /** The pieces with these keys were just built: play them going up. */
  playBuild: (pieceKeys: readonly string[]) => void
  /** Call once per frame. */
  update: (deltaSeconds: number) => void
  /** A building is still going up. */
  isBuildPlaying: () => boolean
  dispose: () => void
}

/** A piece on the map and the parts that change with the zoom. */
type PieceView = {
  pieceKey: string
  ground: MapGroundPoint
  label: Group
  model: Object3D | null
  modelScale: number
  /** Height of the model's top, at full size. */
  modelTop: number
}

/** A piece as it was last shown, and the meshes made for it. */
type ShownPiece = {
  piece: MapPiece
  holder: Group
  /** Null for an empty building slot: nothing of it changes with the zoom. */
  view: PieceView | null
}

/**
 * World units per metre of the Blender file. Every model is exported at its
 * size next to the others (keep 6 m, building 3 m, warrior 0.75 m), so one
 * scale fits them all.
 */
const MODEL_WORLD_SCALE = 0.9
const MATTE_MINIMUM_ROUGHNESS = 0.8
/** Name of the torch inside a pawn model ends with this (Blender file). */
const TORCH_PART_NAME_SUFFIX = '_torch'
const DECAL_ALPHA_CUTOFF = 0.5

/**
 * Icon size (world units). Shrinks with the whole zoom range: big when the
 * map is a flat overview, tiny when the camera is among the 3D pieces.
 */
const LABEL_FAR_SIZE = 2.3
const LABEL_NEAR_SIZE = 0.36
/** A piece without a 3D model still shrinks, but stays a bit more readable. */
const LABEL_NEAR_SIZE_WITHOUT_MODEL = 0.55
/** The icon of a piece hovers this high over its ground, zoomed out. */
export const LABEL_FAR_HEIGHT = 0.8
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

export function createPieceLayer(): PieceLayer {
  const group: Group = new Group()
  /** Empty until they are loaded: a piece is only its icon until then. */
  let pieceModels: PieceModels = new Map<string, PieceModel>()
  let currentPieces: readonly MapPiece[] = []
  let shownPieces: Map<string, ShownPiece> = new Map<string, ShownPiece>()
  const buildAnimations: BuildAnimations = createBuildAnimations()
  // The pieces are rebuilt on every board update; the dust outlives them.
  const layer: Group = new Group()
  layer.add(group, buildAnimations.group)
  const iconMaterials: Map<string, SpriteMaterial> = new Map<
    string,
    SpriteMaterial
  >()
  const badgeMaterials: Map<string, SpriteMaterial> = new Map<
    string,
    SpriteMaterial
  >()
  const matteMaterials: Map<Material, Material> = new Map<Material, Material>()
  const slotDrawings: SlotDrawings = createSlotDrawings()
  let views: PieceView[] = []
  let viewsByKey: Map<string, PieceView> = new Map<string, PieceView>()
  let currentZoom = 0
  /** How much of their full size the models show at the current zoom. */
  let currentGrowth = 0
  let torchesShown = false
  let hoveredPieceKey: string | null = null

  const iconMaterial = (piece: MapPiece): SpriteMaterial => {
    const roundedCorners: boolean = piece.isBuilding === true
    const materialKey: string = `${piece.texturePath ?? colorToCss(piece.color)}:${String(roundedCorners)}`
    const cached: SpriteMaterial | undefined = iconMaterials.get(materialKey)
    if (cached !== undefined) {
      return cached
    }
    const material: SpriteMaterial = new SpriteMaterial({
      color: piece.texturePath === null ? piece.color : 0xffffff,
      depthTest: false,
    })
    if (piece.texturePath !== null) {
      material.map = createIconTexture({
        imagePath: piece.texturePath,
        roundedCorners,
      })
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

  /** Paint and shadow every mesh of a cloned figure. */
  const finishFigure = (figure: Object3D): void => {
    for (const part of meshesOf(figure)) {
      part.castShadow = true
      part.receiveShadow = true
      part.material = Array.isArray(part.material)
        ? part.material.map(matteMaterial)
        : matteMaterial(part.material)
    }
  }

  /** The 3D model of a piece, feet on the ground, sized for a clearing. */
  const createModel = (
    piece: MapPiece,
    pieceModel: PieceModel,
  ): { model: Object3D; scale: number; top: number } => {
    if (pieceModel.kind === 'meeple') {
      const stack: MeepleStackModel = createMeepleStackModel(
        piece.count,
        pieceModel.model,
        finishFigure,
      )
      return {
        model: stack.model,
        scale: MODEL_WORLD_SCALE,
        top: stack.height * MODEL_WORLD_SCALE,
      }
    }
    const figure: Object3D = pieceModel.model.clone()
    finishFigure(figure)
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
      view.label.visible = isLabelShown({
        zoom: currentZoom,
        isHovered: view.pieceKey === hoveredPieceKey,
      })
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

  /** The nearest piece the ray hits: its model, or its icon if it has none. */
  const pieceKeyAt = (raycaster: Raycaster): string | null => {
    let nearestKey: string | null = null
    let nearestDistance: number = Infinity
    for (const view of views) {
      const hits: Intersection[] = raycaster.intersectObject(
        view.model ?? view.label,
      )
      const distance: number = hits[0]?.distance ?? Infinity
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestKey = view.pieceKey
      }
    }
    return nearestKey
  }

  /** The torch a pawn holds is a part of its model: show or hide them all. */
  const applyTorches = (): void => {
    const torches: Object3D[] = []
    group.traverse((part: Object3D): void => {
      if (part.name.endsWith(TORCH_PART_NAME_SUFFIX)) {
        torches.push(part)
      }
    })
    for (const torch of torches) {
      torch.visible = torchesShown
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

  const showPiece = (piece: MapPiece): ShownPiece => {
    const holder: Group = new Group()
    holder.position.set(piece.ground.x, 0, piece.ground.z)
    if (piece.shape === 'slot') {
      const slot: Object3D = slotDrawings.create()
      slot.rotation.y = piece.rotation ?? 0
      holder.add(slot)
      return { piece, holder, view: null }
    }
    const label: Group = createLabel(piece)
    holder.add(label)
    const pieceModel: PieceModel | undefined = pieceModels.get(
      piece.textureKey,
    )
    if (pieceModel === undefined) {
      return {
        piece,
        holder,
        view: {
          pieceKey: piece.key,
          ground: piece.ground,
          label,
          model: null,
          modelScale: 1,
          modelTop: 0,
        },
      }
    }
    const created: { model: Object3D; scale: number; top: number } =
      createModel(piece, pieceModel)
    holder.add(created.model)
    return {
      piece,
      holder,
      view: {
        pieceKey: piece.key,
        ground: piece.ground,
        label,
        model: created.model,
        modelScale: created.scale,
        modelTop: created.top,
      },
    }
  }

  const setPieces = (pieces: readonly MapPiece[]): void => {
    currentPieces = pieces
    // A board update changes a few pieces: the others keep their meshes.
    const previouslyShown: Map<string, ShownPiece> = shownPieces
    shownPieces = new Map<string, ShownPiece>()
    group.clear()
    views = []
    viewsByKey = new Map<string, PieceView>()
    for (const piece of pieces) {
      const previous: ShownPiece | undefined = previouslyShown.get(piece.key)
      const shown: ShownPiece =
        previous !== undefined && isSameMapPiece(previous.piece, piece)
          ? previous
          : showPiece(piece)
      // Kept once: a second piece under the same key gets meshes of its own.
      previouslyShown.delete(piece.key)
      shownPieces.set(piece.key, shown)
      group.add(shown.holder)
      if (shown.view !== null) {
        views.push(shown.view)
        viewsByKey.set(piece.key, shown.view)
      }
    }
    applyZoom()
    applyTorches()
  }

  return {
    group: layer,
    setPieces,
    setPieceModels: (loaded: PieceModels): void => {
      pieceModels = loaded
      // Every piece is made again: it may now have a model.
      shownPieces = new Map<string, ShownPiece>()
      setPieces(currentPieces)
    },
    setTorchesShown: (shown: boolean): void => {
      torchesShown = shown
      applyTorches()
    },
    setZoom: (zoom: number): void => {
      if (zoom === currentZoom) {
        return
      }
      currentZoom = zoom
      applyZoom()
    },
    hoverAt: (raycaster: Raycaster | null): void => {
      const pieceKey: string | null =
        raycaster === null ? null : pieceKeyAt(raycaster)
      if (pieceKey === hoveredPieceKey) {
        return
      }
      hoveredPieceKey = pieceKey
      applyZoom()
    },
    playBuild: buildAnimations.play,
    update: (deltaSeconds: number): void => {
      buildAnimations.update(deltaSeconds, buildSiteOf)
    },
    isBuildPlaying: buildAnimations.isPlaying,
    dispose: (): void => {
      group.clear()
      buildAnimations.dispose()
      slotDrawings.dispose()
      for (const material of [
        ...iconMaterials.values(),
        ...badgeMaterials.values(),
      ]) {
        material.map?.dispose()
        material.dispose()
      }
    },
  }
}
