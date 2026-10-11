import type { Group } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

/**
 * 3D models of the map (see `public/assets/models/SOURCES.md`): trees and
 * structures from Kenney's kits (CC0), meeples extruded in Blender from the
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
}

function meeple(name: string): PieceModelSource {
  return { kind: 'meeple', name: `meeples/${name}` }
}

function structure(name: string): PieceModelSource {
  return { kind: 'structure', name: `buildings/${name}` }
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
  'token-marquise-sawmill': structure('town/sawmill'),
  'token-marquise-workshop': structure('hexagon/workshop'),
  'token-marquise-recruiter': structure('nature/recruiter'),
  'token-marquise-keep': structure('hexagon/keep'),
  'token-marquise-wood': structure('nature/wood'),
  'token-eyrie-roost': structure('hexagon/roost'),
  'token-alliance-base-fox': structure('hexagon/base'),
  'token-alliance-base-mouse': structure('hexagon/base'),
  'token-alliance-base-rabbit': structure('hexagon/base'),
  'token-lizard-garden-fox': structure('town/garden'),
  'token-lizard-garden-mouse': structure('town/garden'),
  'token-lizard-garden-rabbit': structure('town/garden'),
  'token-riverfolk-trade-post-fox': structure('town/trade-post'),
  'token-riverfolk-trade-post-mouse': structure('town/trade-post'),
  'token-riverfolk-trade-post-rabbit': structure('town/trade-post'),
  'marker-ruin': structure('nature/ruin'),
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
      pieces.set(textureKey, { kind: source.kind, model })
    }
  }
  return { trees: { pine, leafy, autumn }, pieces }
}
