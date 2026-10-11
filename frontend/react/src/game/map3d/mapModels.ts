import type { Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

/**
 * 3D models of the map (see `public/assets/models/SOURCES.md`):
 * trees from Kenney's Nature Kit (CC0), meeples extruded in Blender from the
 * warrior token art.
 */
const NATURE_MODEL_DIRECTORY = '/assets/models/nature'
const MEEPLE_MODEL_DIRECTORY = '/assets/models/meeples'
const MODEL_FILE_EXTENSION = '.glb'

const PINE_MODEL_NAMES: readonly string[] = [
  'tree_pineRoundA',
  'tree_pineRoundC',
  'tree_pineDefaultA',
  'tree_pineTallA',
]
const LEAFY_MODEL_NAMES: readonly string[] = [
  'tree_default',
  'tree_oak',
  'tree_fat',
]
const AUTUMN_MODEL_NAMES: readonly string[] = [
  'tree_default_fall',
  'tree_oak_fall',
]

/** Token texture key → meeple model file (same names as the token art). */
const MEEPLE_MODEL_NAME_BY_TEXTURE_KEY: Readonly<Record<string, string>> = {
  'token-marquise-warrior': 'marquise-warrior',
  'token-eyrie-warrior': 'eyrie-warrior',
  'token-alliance-warrior': 'alliance-warrior',
  'token-lizard-warrior': 'lizard-warrior',
  'token-riverfolk-warrior': 'riverfolk-warrior',
  'token-vagabond-pawn': 'vagabond-pawn',
  'token-vagabond-pawn-tinker': 'vagabond-pawn-tinker',
  'token-vagabond-pawn-ranger': 'vagabond-pawn-ranger',
}

export type TreeModels = {
  pine: readonly Group[]
  leafy: readonly Group[]
  /** Orange crowns: the turned trees dotted over the Autumn map. */
  autumn: readonly Group[]
}

export type MapModels = {
  trees: TreeModels
  /** Meeple per token texture key; a piece without one stays a flat token. */
  meeples: ReadonlyMap<string, Group>
}

async function loadModel(
  loader: GLTFLoader,
  directory: string,
  name: string,
): Promise<Group> {
  const model: GLTF = await loader.loadAsync(
    `${directory}/${name}${MODEL_FILE_EXTENSION}`,
  )
  return model.scene
}

function loadModels(
  loader: GLTFLoader,
  directory: string,
  names: readonly string[],
): Promise<Group[]> {
  return Promise.all(
    names.map(
      (name: string): Promise<Group> => loadModel(loader, directory, name),
    ),
  )
}

export async function loadMapModels(): Promise<MapModels> {
  const loader: GLTFLoader = new GLTFLoader()
  const meepleEntries: Array<[string, string]> = Object.entries(
    MEEPLE_MODEL_NAME_BY_TEXTURE_KEY,
  )
  const [pine, leafy, autumn, meepleModels]: [
    Group[],
    Group[],
    Group[],
    Group[],
  ] = await Promise.all([
    loadModels(loader, NATURE_MODEL_DIRECTORY, PINE_MODEL_NAMES),
    loadModels(loader, NATURE_MODEL_DIRECTORY, LEAFY_MODEL_NAMES),
    loadModels(loader, NATURE_MODEL_DIRECTORY, AUTUMN_MODEL_NAMES),
    loadModels(
      loader,
      MEEPLE_MODEL_DIRECTORY,
      meepleEntries.map(([, modelName]: [string, string]): string => modelName),
    ),
  ])
  const meeples: Map<string, Group> = new Map<string, Group>()
  meepleEntries.forEach(
    ([textureKey]: [string, string], index: number): void => {
      const model: Group | undefined = meepleModels[index]
      if (model !== undefined) {
        meeples.set(textureKey, model)
      }
    },
  )
  return { trees: { pine, leafy, autumn }, meeples }
}
