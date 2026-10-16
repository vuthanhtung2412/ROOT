import {
  Box3,
  Group,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Material,
  type Raycaster,
} from 'three'
import {
  createBuildAnimations,
  type BuildAnimations,
  type BuildSite,
} from '#game/map3d/buildAnimation.ts'
import {
  createLabelPops,
  zoomedLabelScale,
  type LabelPops,
} from '#game/map3d/labelPop.ts'
import {
  nearestHoverTargetKey,
  type HoverTarget,
} from '#game/map3d/mapHover.ts'
import type { PieceModel, PieceModels } from '#game/map3d/mapModels.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import {
  createMeepleStackModel,
  type MeepleStackModel,
} from '#game/map3d/meepleStackModel.ts'
import {
  createPieceLabels,
  type PieceLabels,
} from '#game/map3d/pieceLabels.ts'
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
 * the models rise and the icons shrink away; an icon pops back up over its
 * piece while the pointer is on it.
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
 * Icon size (world units): big when the map is a flat overview, gone once
 * the 3D pieces stand at full size, and this big when the pointer pops it.
 */
const LABEL_FAR_SIZE = 2.3
const LABEL_HOVER_SIZE = 0.5
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
  const matteMaterials: Map<Material, Material> = new Map<Material, Material>()
  const slotDrawings: SlotDrawings = createSlotDrawings()
  const pieceLabels: PieceLabels = createPieceLabels()
  let views: PieceView[] = []
  let viewsByKey: Map<string, PieceView> = new Map<string, PieceView>()
  let currentZoom = 0
  /** How much of their full size the models show at the current zoom. */
  let currentGrowth = 0
  let torchesShown = false
  const labelPops: LabelPops<string> = createLabelPops<string>()

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
   * An icon shrinks away as its model rises, and pops back up while the
   * pointer is over the piece. A piece without a model keeps a small icon.
   */
  const labelSize = (view: PieceView): number => {
    const zoomedScale: number = zoomedLabelScale(currentZoom)
    const zoomedSize: number =
      view.model === null
        ? MathUtils.lerp(
            LABEL_NEAR_SIZE_WITHOUT_MODEL,
            LABEL_FAR_SIZE,
            zoomedScale,
          )
        : LABEL_FAR_SIZE * zoomedScale
    return Math.max(
      zoomedSize,
      LABEL_HOVER_SIZE * labelPops.scaleOf(view.pieceKey),
    )
  }

  const applyLabelSizes = (): void => {
    for (const view of views) {
      const size: number = labelSize(view)
      view.label.scale.setScalar(size)
      view.label.visible = size > 0
    }
  }

  const applyZoom = (): void => {
    const growth: number = MathUtils.smoothstep(
      currentZoom,
      MODEL_RISE_START_ZOOM,
      MODEL_RISE_END_ZOOM,
    )
    currentGrowth = growth
    applyLabelSizes()
    for (const view of views) {
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
  const pieceKeyAt = (raycaster: Raycaster): string | null =>
    nearestHoverTargetKey(
      raycaster,
      views.map(
        (view: PieceView): HoverTarget => ({
          key: view.pieceKey,
          object: view.model ?? view.label,
        }),
      ),
    )

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
    const label: Group = pieceLabels.createLabel(piece)
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
      labelPops.setHovered(raycaster === null ? null : pieceKeyAt(raycaster))
    },
    playBuild: buildAnimations.play,
    update: (deltaSeconds: number): void => {
      labelPops.update(deltaSeconds)
      applyLabelSizes()
      buildAnimations.update(deltaSeconds, buildSiteOf)
    },
    isBuildPlaying: buildAnimations.isPlaying,
    dispose: (): void => {
      group.clear()
      buildAnimations.dispose()
      slotDrawings.dispose()
      pieceLabels.dispose()
    },
  }
}
