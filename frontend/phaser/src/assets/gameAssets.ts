import cardCatalog from './cardCatalog.json'

/** Minimal loader surface for preload helpers (Phaser LoaderPlugin satisfies). */
export type ImageAssetLoader = {
  image: (key: string, url: string) => unknown
}

/** Phaser texture keys and public asset paths for GP2 preload. */

export const GAME_ASSET_KEYS = {
  autumnMap: 'autumn-map',
  factionMarquise: 'faction-marquise',
  factionEyrie: 'faction-eyrie',
  tokenMarquiseSawmill: 'token-marquise-sawmill',
  tokenMarquiseWorkshop: 'token-marquise-workshop',
  tokenMarquiseRecruiter: 'token-marquise-recruiter',
  tokenMarquiseWood: 'token-marquise-wood',
  tokenMarquiseKeep: 'token-marquise-keep',
  tokenEyrieRoost: 'token-eyrie-roost',
} as const

export type GameAssetKey = (typeof GAME_ASSET_KEYS)[keyof typeof GAME_ASSET_KEYS]

export type GameImageAsset = {
  key: string
  path: string
}

/** Map piece kind+type → token texture (GP2 Marquise / Eyrie). */
export function pieceTokenTextureKey(
  kind: string,
  pieceType: string | undefined,
): string | null {
  if (pieceType === undefined) {
    return null
  }
  if (kind === 'building') {
    if (pieceType === 'sawmill') {
      return GAME_ASSET_KEYS.tokenMarquiseSawmill
    }
    if (pieceType === 'workshop') {
      return GAME_ASSET_KEYS.tokenMarquiseWorkshop
    }
    if (pieceType === 'recruiter') {
      return GAME_ASSET_KEYS.tokenMarquiseRecruiter
    }
    if (pieceType === 'roost') {
      return GAME_ASSET_KEYS.tokenEyrieRoost
    }
    return null
  }
  if (kind === 'token') {
    if (pieceType === 'wood') {
      return GAME_ASSET_KEYS.tokenMarquiseWood
    }
    if (pieceType === 'keep') {
      return GAME_ASSET_KEYS.tokenMarquiseKeep
    }
    return null
  }
  return null
}

export type CardCatalogEntry = {
  image: string
  name: string
  description: string
  suit: string
  type: string
}

export type CardCatalog = Record<string, CardCatalogEntry>

export const CARD_CATALOG: CardCatalog = cardCatalog

export function cardTextureKey(defId: string): string {
  return `card:${defId}`
}

export const AUTUMN_MAP_ASSET: GameImageAsset = {
  key: GAME_ASSET_KEYS.autumnMap,
  path: 'assets/map/autumn-map.jpg',
}

/** Boot tokens/factions only — autumn map loads later (Menu warm / GameScene). */
export const CORE_IMAGE_ASSETS: readonly GameImageAsset[] = [
  {
    key: GAME_ASSET_KEYS.factionMarquise,
    path: 'assets/factions/marquise.png',
  },
  {
    key: GAME_ASSET_KEYS.factionEyrie,
    path: 'assets/factions/eyrie.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenMarquiseSawmill,
    path: 'assets/tokens/marquise/sawmill.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenMarquiseWorkshop,
    path: 'assets/tokens/marquise/workshop.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenMarquiseRecruiter,
    path: 'assets/tokens/marquise/recruiter.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenMarquiseWood,
    path: 'assets/tokens/marquise/wood.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenMarquiseKeep,
    path: 'assets/tokens/marquise/keep.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenEyrieRoost,
    path: 'assets/tokens/eyrie/roost.png',
  },
]

export function cardImageAssets(): GameImageAsset[] {
  const assets: GameImageAsset[] = []
  for (const defId of Object.keys(CARD_CATALOG)) {
    const asset = cardImageAssetForDefId(defId)
    if (asset !== null) {
      assets.push(asset)
    }
  }
  return assets
}

export function cardImageAssetForDefId(defId: string): GameImageAsset | null {
  const entry = CARD_CATALOG[defId]
  if (entry === undefined) {
    return null
  }
  return {
    key: cardTextureKey(defId),
    path: `assets/cards/${entry.image}`,
  }
}

/**
 * Queue card faces not yet in the texture cache.
 * Returns how many new loads were queued.
 */
export function queueMissingCardImages(
  loader: ImageAssetLoader,
  textureExists: (key: string) => boolean,
  defIds: readonly string[],
  alreadyQueued: ReadonlySet<string> = new Set(),
): { queuedCount: number; newlyQueuedKeys: string[] } {
  const newlyQueuedKeys: string[] = []
  const seenDefIds = new Set<string>()
  for (const defId of defIds) {
    if (seenDefIds.has(defId)) {
      continue
    }
    seenDefIds.add(defId)
    const asset = cardImageAssetForDefId(defId)
    if (asset === null) {
      continue
    }
    if (textureExists(asset.key) || alreadyQueued.has(asset.key)) {
      continue
    }
    loader.image(asset.key, asset.path)
    newlyQueuedKeys.push(asset.key)
  }
  return {
    queuedCount: newlyQueuedKeys.length,
    newlyQueuedKeys,
  }
}

/** Boot: faction/token icons only (map + cards load later). */
export function preloadCoreGameAssets(loader: ImageAssetLoader): void {
  for (const asset of CORE_IMAGE_ASSETS) {
    loader.image(asset.key, asset.path)
  }
}

export function queueAutumnMapImage(
  loader: ImageAssetLoader,
  textureExists: (key: string) => boolean,
): boolean {
  if (textureExists(AUTUMN_MAP_ASSET.key)) {
    return false
  }
  loader.image(AUTUMN_MAP_ASSET.key, AUTUMN_MAP_ASSET.path)
  return true
}

export function lookupCardCatalog(defId: string): CardCatalogEntry | null {
  return CARD_CATALOG[defId] ?? null
}
