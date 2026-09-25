import cardCatalog from '#assets/cardCatalog.json'

/** Minimal loader surface for preload helpers (Phaser LoaderPlugin satisfies). */
export type ImageAssetLoader = {
  image: (key: string, url: string) => unknown
}

/** Phaser texture keys and public asset paths for GP2 preload. */

export const GAME_ASSET_KEYS = {
  autumnMap: 'autumn-map',
  rootBanner: 'root-banner',
  menuWallpaper: 'menu-wallpaper',
  gameWallpaper: 'game-wallpaper',
  factionMarquise: 'faction-marquise',
  factionEyrie: 'faction-eyrie',
  characterBoardMarquise: 'character-board-marquise',
  characterBoardEyrie: 'character-board-eyrie',
  suitFox: 'suit-fox',
  suitMouse: 'suit-mouse',
  suitRabbit: 'suit-rabbit',
  tokenMarquiseSawmill: 'token-marquise-sawmill',
  tokenMarquiseWorkshop: 'token-marquise-workshop',
  tokenMarquiseRecruiter: 'token-marquise-recruiter',
  tokenMarquiseWood: 'token-marquise-wood',
  tokenMarquiseKeep: 'token-marquise-keep',
  tokenEyrieRoost: 'token-eyrie-roost',
  markerRuin: 'marker-ruin',
  itemBoot: 'item-boot',
  itemBag: 'item-bag',
  itemCrossbow: 'item-crossbow',
  itemHammer: 'item-hammer',
  itemSword: 'item-sword',
  itemTea: 'item-tea',
  itemCoin: 'item-coin',
} as const

/** Crafted / supply item types with a board icon (torch has no icon — supply 0). */
export const CRAFTED_ITEM_TEXTURE_TYPES = [
  'boot',
  'bag',
  'crossbow',
  'hammer',
  'sword',
  'tea',
  'coin',
] as const

export type CraftedItemTextureType = (typeof CRAFTED_ITEM_TEXTURE_TYPES)[number]

const CRAFTED_ITEM_TEXTURE_BY_TYPE: Record<CraftedItemTextureType, string> = {
  boot: GAME_ASSET_KEYS.itemBoot,
  bag: GAME_ASSET_KEYS.itemBag,
  crossbow: GAME_ASSET_KEYS.itemCrossbow,
  hammer: GAME_ASSET_KEYS.itemHammer,
  sword: GAME_ASSET_KEYS.itemSword,
  tea: GAME_ASSET_KEYS.itemTea,
  coin: GAME_ASSET_KEYS.itemCoin,
}

function isCraftedItemTextureType(value: string): value is CraftedItemTextureType {
  return CRAFTED_ITEM_TEXTURE_TYPES.some((itemType) => itemType === value)
}

/** Map crafted item type → texture key; null when no icon (e.g. torch). */
export function itemTextureKey(itemType: string): string | null {
  if (!isCraftedItemTextureType(itemType)) {
    return null
  }
  return CRAFTED_ITEM_TEXTURE_BY_TYPE[itemType]
}

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
    key: GAME_ASSET_KEYS.rootBanner,
    path: 'assets/branding/root-banner.jpg',
  },
  {
    key: GAME_ASSET_KEYS.menuWallpaper,
    path: 'assets/branding/therootdatabase-hero.webp',
  },
  {
    key: GAME_ASSET_KEYS.gameWallpaper,
    path: 'assets/branding/ks-pooneac-root.jpg',
  },
  {
    key: GAME_ASSET_KEYS.factionMarquise,
    path: 'assets/factions/marquise.png',
  },
  {
    key: GAME_ASSET_KEYS.factionEyrie,
    path: 'assets/factions/eyrie.png',
  },
  {
    key: GAME_ASSET_KEYS.characterBoardMarquise,
    path: 'assets/character-boards/marquise-de-cat-front.webp',
  },
  {
    key: GAME_ASSET_KEYS.characterBoardEyrie,
    path: 'assets/character-boards/eyrie-dynasties-front.webp',
  },
  {
    key: GAME_ASSET_KEYS.suitFox,
    path: 'assets/suits/fox.png',
  },
  {
    key: GAME_ASSET_KEYS.suitMouse,
    path: 'assets/suits/mouse.png',
  },
  {
    key: GAME_ASSET_KEYS.suitRabbit,
    path: 'assets/suits/rabbit.png',
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
  {
    key: GAME_ASSET_KEYS.markerRuin,
    path: 'assets/markers/ruin.png',
  },
  {
    key: GAME_ASSET_KEYS.itemBoot,
    path: 'assets/items/boot.png',
  },
  {
    key: GAME_ASSET_KEYS.itemBag,
    path: 'assets/items/bag.png',
  },
  {
    key: GAME_ASSET_KEYS.itemCrossbow,
    path: 'assets/items/crossbow.png',
  },
  {
    key: GAME_ASSET_KEYS.itemHammer,
    path: 'assets/items/hammer.png',
  },
  {
    key: GAME_ASSET_KEYS.itemSword,
    path: 'assets/items/sword.png',
  },
  {
    key: GAME_ASSET_KEYS.itemTea,
    path: 'assets/items/tea.png',
  },
  {
    key: GAME_ASSET_KEYS.itemCoin,
    path: 'assets/items/coin.png',
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

/** Absolute public URL for a card face (React overlays). */
export function cardImagePublicPath(defId: string): string | null {
  const asset = cardImageAssetForDefId(defId)
  if (asset === null) {
    return null
  }
  if (asset.path.startsWith('/')) {
    return asset.path
  }
  return `/${asset.path}`
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

/** Public URL for a preloaded core image key (React overlays). */
export function imagePathForAssetKey(key: string): string | null {
  const asset = CORE_IMAGE_ASSETS.find((entry) => entry.key === key)
  if (asset === undefined) {
    return null
  }
  if (asset.path.startsWith('/')) {
    return asset.path
  }
  return `/${asset.path}`
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
