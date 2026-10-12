import type { Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

/**
 * 3D models of the map (see `public/assets/models/SOURCES.md` for where each
 * comes from and its licence): trees from Kenney's Nature Kit, buildings
 * exported from the project's Blender file, meeples extruded from the
 * warrior token art.
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

/** A meeple stands as modelled; a structure is fitted onto a building plot. */
export type PieceModelKind = 'meeple' | 'structure'

type PieceModelSource = {
  kind: PieceModelKind
  name: string
  /** Size next to the other structures: 1 for all but the keep. */
  sizeFactor: number
}

const STANDARD_SIZE_FACTOR = 1
/** The keep is the biggest building of the game. */
const KEEP_SIZE_FACTOR = 1.6
/** A pile of wood is a token, not a building: it stays small. */
const WOOD_SIZE_FACTOR = 0.6

function meeple(name: string): PieceModelSource {
  return {
    kind: 'meeple',
    name: `meeples/${name}`,
    sizeFactor: STANDARD_SIZE_FACTOR,
  }
}

/**
 * A building model as exported from `root-map-models.blend`, already in the
 * colours of the faction that owns it.
 */
function structure(
  name: string,
  sizeFactor: number = STANDARD_SIZE_FACTOR,
): PieceModelSource {
  return { kind: 'structure', name: `buildings/final/${name}`, sizeFactor }
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
  'token-marquise-keep': structure('keep', KEEP_SIZE_FACTOR),
  'token-marquise-wood': structure('wood', WOOD_SIZE_FACTOR),
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
  sizeFactor: number
}

export type MapModels = {
  trees: TreeModels
  /** Model per token texture key; a piece without one is only its icon. */
  pieces: ReadonlyMap<string, PieceModel>
}

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

export async function loadMapModels(): Promise<MapModels> {
  const loader: GLTFLoader = new GLTFLoader()
  const pieceEntries: Array<[string, PieceModelSource]> = Object.entries(
    PIECE_MODEL_SOURCE_BY_TEXTURE_KEY,
  )
  // Several pieces share a file (the three suits of a base): load each once.
  const pieceModelNames: string[] = [
    ...new Set<string>(
      pieceEntries.map(
        ([, source]: [string, PieceModelSource]): string => source.name,
      ),
    ),
  ]
  const [pine, leafy, autumn, pieceModels]: [
    Group[],
    Group[],
    Group[],
    Group[],
  ] = await Promise.all([
    loadModels(loader, PINE_MODEL_NAMES),
    loadModels(loader, LEAFY_MODEL_NAMES),
    loadModels(loader, AUTUMN_MODEL_NAMES),
    loadModels(loader, pieceModelNames),
  ])
  const pieces: Map<string, PieceModel> = new Map<string, PieceModel>()
  for (const [textureKey, source] of pieceEntries) {
    const model: Group | undefined =
      pieceModels[pieceModelNames.indexOf(source.name)]
    if (model !== undefined) {
      pieces.set(textureKey, {
        kind: source.kind,
        model,
        sizeFactor: source.sizeFactor,
      })
    }
  }
  return { trees: { pine, leafy, autumn }, pieces }
}
