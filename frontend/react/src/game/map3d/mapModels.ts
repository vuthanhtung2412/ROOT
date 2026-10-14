import type { Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { mergePartsByMaterial } from '#game/map3d/mergeModelParts.ts'

/**
 * 3D models of the map (see `public/assets/models/SOURCES.md` for where each
 * comes from and its licence): trees from Kenney's Nature Kit, buildings
 * exported from the project's Blender file, meeples extruded from the
 * warrior token art, the campfire from Poly Pizza, the mountains built in
 * Blender from the Stone Pack.
 */
const MODEL_ROOT = '/assets/models'
const MODEL_FILE_EXTENSION = '.glb'

const PINE_MODEL_NAMES: readonly string[] = [
  'nature/tree_pineRoundA',
  'nature/tree_pineRoundC',
  'nature/tree_pineDefaultA',
  'nature/tree_pineTallA',
]
const LEAFY_MODEL_NAMES: readonly string[] = [
  'nature/tree_default',
  'nature/tree_oak',
  'nature/tree_fat',
]
const AUTUMN_MODEL_NAMES: readonly string[] = [
  'nature/tree_default_fall',
  'nature/tree_oak_fall',
]
const CAMPFIRE_MODEL_NAME = 'props/campfire'
const MOUNTAIN_MODEL_NAMES: readonly string[] = [
  'props/mountain-a',
  'props/mountain-b',
]

/**
 * A meeple stands as modelled; a structure is centred on a building plot.
 * Both come out of the Blender file at their size next to the other pieces.
 */
export type PieceModelKind = 'meeple' | 'structure'

type PieceModelSource = {
  kind: PieceModelKind
  name: string
}

function meeple(name: string): PieceModelSource {
  return { kind: 'meeple', name: `meeples/${name}` }
}

/**
 * A building model as exported from `root-map-models.blend`, already in the
 * colours of the faction that owns it.
 */
function structure(name: string): PieceModelSource {
  return { kind: 'structure', name: `buildings/final/${name}` }
}

/** Token texture key → the 3D model that stands for that piece. */
const PIECE_MODEL_SOURCE_BY_TEXTURE_KEY: Readonly<
  Record<string, PieceModelSource>
> = {
  'token-marquise-warrior': meeple('marquise-warrior'),
  'token-eyrie-warrior': meeple('eyrie-warrior'),
  'token-alliance-warrior': meeple('alliance-warrior'),
  'token-lizard-warrior': meeple('lizard-warrior'),
  'token-riverfolk-warrior': meeple('riverfolk-warrior'),
  'token-vagabond-pawn': meeple('vagabond-pawn'),
  'token-vagabond-pawn-tinker': meeple('vagabond-pawn-tinker'),
  'token-vagabond-pawn-ranger': meeple('vagabond-pawn-ranger'),
  'token-marquise-sawmill': structure('sawmill'),
  'token-marquise-workshop': structure('workshop'),
  'token-marquise-recruiter': structure('recruiter'),
  'token-marquise-keep': structure('keep-rebuilt'),
  'token-marquise-wood': structure('wood'),
  'token-eyrie-roost': structure('roost'),
  'token-alliance-base-fox': structure('base'),
  'token-alliance-base-mouse': structure('base'),
  'token-alliance-base-rabbit': structure('base'),
  'token-alliance-sympathy': structure('sympathy'),
  'token-lizard-garden-fox': structure('garden'),
  'token-lizard-garden-mouse': structure('garden'),
  'token-lizard-garden-rabbit': structure('garden'),
  'token-riverfolk-trade-post-fox': structure('trade-post'),
  'token-riverfolk-trade-post-mouse': structure('trade-post'),
  'token-riverfolk-trade-post-rabbit': structure('trade-post'),
  'marker-ruin': structure('ruin'),
}

export type TreeModels = {
  pine: readonly Group[]
  leafy: readonly Group[]
  /** Orange crowns: the turned trees dotted over the Autumn woodland. */
  autumn: readonly Group[]
}

export type PieceModel = {
  kind: PieceModelKind
  model: Group
}

/** The woodland itself: all the first frame needs. */
export type MapModels = {
  trees: TreeModels
  /** Logs in a ring of stones: the fire of every clearing. */
  campfire: Group
  /** Stone spires on a broad core: the range along the woodland's edge. */
  mountains: readonly Group[]
}

/** Model per token texture key; a piece without one is only its icon. */
export type PieceModels = ReadonlyMap<string, PieceModel>

async function loadModel(loader: GLTFLoader, name: string): Promise<Group> {
  const model: GLTF = await loader.loadAsync(
    `${MODEL_ROOT}/${name}${MODEL_FILE_EXTENSION}`,
  )
  return model.scene
}

function loadModels(
  loader: GLTFLoader,
  names: readonly string[],
): Promise<Group[]> {
  return Promise.all(
    names.map((name: string): Promise<Group> => loadModel(loader, name)),
  )
}

async function fetchMapModels(): Promise<MapModels> {
  const loader: GLTFLoader = new GLTFLoader()
  const [pine, leafy, autumn, campfire, mountains]: [
    Group[],
    Group[],
    Group[],
    Group,
    Group[],
  ] = await Promise.all([
    loadModels(loader, PINE_MODEL_NAMES),
    loadModels(loader, LEAFY_MODEL_NAMES),
    loadModels(loader, AUTUMN_MODEL_NAMES),
    loadModel(loader, CAMPFIRE_MODEL_NAME),
    loadModels(loader, MOUNTAIN_MODEL_NAMES),
  ])
  return { trees: { pine, leafy, autumn }, campfire, mountains }
}

/**
 * The pieces are most of the download and only show once the camera zooms
 * in: they are loaded apart, so the woodland does not wait for them.
 */
async function fetchPieceModel(source: PieceModelSource): Promise<PieceModel> {
  const model: Group = await loadModel(new GLTFLoader(), source.name)
  return {
    kind: source.kind,
    // A meeple keeps its parts: the torch of a pawn is shown and hidden.
    model: source.kind === 'structure' ? mergePartsByMaterial(model) : model,
  }
}

/**
 * Kept for the page's lifetime: switching to the flat map and back must not
 * download and read every file again.
 */
let mapModelsLoading: Promise<MapModels> | null = null
/** By file: several pieces share one (the three suits of a base). */
const pieceModelLoadingByName: Map<string, Promise<PieceModel>> = new Map<
  string,
  Promise<PieceModel>
>()

function loadPieceModel(source: PieceModelSource): Promise<PieceModel> {
  const loading: Promise<PieceModel> =
    pieceModelLoadingByName.get(source.name) ??
    fetchPieceModel(source).catch((error: Error): never => {
      // A failed download is tried again the next time the piece is asked for.
      pieceModelLoadingByName.delete(source.name)
      throw error
    })
  pieceModelLoadingByName.set(source.name, loading)
  return loading
}

export function loadMapModels(): Promise<MapModels> {
  mapModelsLoading ??= fetchMapModels().catch((error: Error): never => {
    // A failed download is tried again the next time the map opens.
    mapModelsLoading = null
    throw error
  })
  return mapModelsLoading
}

/**
 * The models of the pieces with these token texture keys: only those of the
 * factions in the game are downloaded, not the whole box.
 */
export async function loadPieceModels(
  textureKeys: readonly string[],
): Promise<PieceModels> {
  const loaded: Array<[string, PieceModel] | null> = await Promise.all(
    textureKeys.map(
      async (textureKey: string): Promise<[string, PieceModel] | null> => {
        const source: PieceModelSource | undefined =
          PIECE_MODEL_SOURCE_BY_TEXTURE_KEY[textureKey]
        return source === undefined
          ? null
          : [textureKey, await loadPieceModel(source)]
      },
    ),
  )
  return new Map<string, PieceModel>(
    loaded.filter(
      (entry: [string, PieceModel] | null): entry is [string, PieceModel] =>
        entry !== null,
    ),
  )
}
