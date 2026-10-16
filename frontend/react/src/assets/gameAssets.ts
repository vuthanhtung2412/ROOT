import cardCatalog from '#assets/cardCatalog.json'
import {
  expansionFactionTextureKey,
  expansionWarriorTextureKey,
  RIVERFOLK_EXPANSION_ASSET_KEYS,
  RIVERFOLK_EXPANSION_IMAGE_ASSETS,
} from '#assets/riverfolkExpansionAssets.ts'
import { publicAssetUrl } from '#assets/publicAssetUrl.ts'

/** Minimal loader surface for preload helpers. */
export type ImageAssetLoader = {
  image: (key: string, url: string) => unknown
}

/** Texture keys and public asset paths for GP2 preload. */

export const GAME_ASSET_KEYS = {
  rootBanner: 'root-banner',
  menuWallpaper: 'menu-wallpaper',
  factionMarquise: 'faction-marquise',
  factionEyrie: 'faction-eyrie',
  factionAlliance: 'faction-alliance',
  factionVagabond: 'faction-vagabond',
  characterBoardMarquise: 'character-board-marquise',
  characterBoardEyrie: 'character-board-eyrie',
  characterBoardAlliance: 'character-board-alliance',
  characterBoardVagabond: 'character-board-vagabond',
  characterCardVagabondThief: 'character-card-vagabond-thief',
  characterCardVagabondTinker: 'character-card-vagabond-tinker',
  characterCardVagabondRanger: 'character-card-vagabond-ranger',
  suitFox: 'suit-fox',
  suitMouse: 'suit-mouse',
  suitRabbit: 'suit-rabbit',
  suitBird: 'suit-bird',
  tokenMarquiseSawmill: 'token-marquise-sawmill',
  tokenMarquiseWorkshop: 'token-marquise-workshop',
  tokenMarquiseRecruiter: 'token-marquise-recruiter',
  tokenMarquiseWood: 'token-marquise-wood',
  tokenMarquiseKeep: 'token-marquise-keep',
  tokenMarquiseWarrior: 'token-marquise-warrior',
  tokenEyrieRoost: 'token-eyrie-roost',
  tokenEyrieWarrior: 'token-eyrie-warrior',
  tokenAllianceSympathy: 'token-alliance-sympathy',
  tokenAllianceBaseFox: 'token-alliance-base-fox',
  tokenAllianceBaseMouse: 'token-alliance-base-mouse',
  tokenAllianceBaseRabbit: 'token-alliance-base-rabbit',
  tokenAllianceWarrior: 'token-alliance-warrior',
  /** Thief meeple; also the default before a character is chosen. */
  tokenVagabondPawn: 'token-vagabond-pawn',
  tokenVagabondPawnTinker: 'token-vagabond-pawn-tinker',
  tokenVagabondPawnRanger: 'token-vagabond-pawn-ranger',
  markerRuin: 'marker-ruin',
  itemBoot: 'item-boot',
  itemBag: 'item-bag',
  itemCrossbow: 'item-crossbow',
  itemHammer: 'item-hammer',
  itemSword: 'item-sword',
  itemTea: 'item-tea',
  itemCoin: 'item-coin',
  itemTorch: 'item-torch',
} as const

/** Item types with a board icon (crafted supply + Vagabond torch). */
export const CRAFTED_ITEM_TEXTURE_TYPES = [
  'boot',
  'bag',
  'crossbow',
  'hammer',
  'sword',
  'tea',
  'coin',
  'torch',
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
  torch: GAME_ASSET_KEYS.itemTorch,
}

function isCraftedItemTextureType(value: string): value is CraftedItemTextureType {
  return CRAFTED_ITEM_TEXTURE_TYPES.some((itemType) => itemType === value)
}

/** Map item type → texture key; null when unknown. */
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

/** Pawn meeple of a Vagabond character; unknown / not chosen = Thief. */
export function vagabondPawnTextureKey(
  character: string | null | undefined,
): string {
  if (character === 'tinker') {
    return GAME_ASSET_KEYS.tokenVagabondPawnTinker
  }
  if (character === 'ranger') {
    return GAME_ASSET_KEYS.tokenVagabondPawnRanger
  }
  return GAME_ASSET_KEYS.tokenVagabondPawn
}

/** Map piece kind+type → token texture (Marquise / Eyrie / Alliance / Vagabond). */
export function pieceTokenTextureKey(
  kind: string,
  pieceType: string | undefined,
): string | null {
  if (kind === 'pawn') {
    return vagabondPawnTextureKey(pieceType)
  }
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
    if (pieceType === 'base') {
      return GAME_ASSET_KEYS.tokenAllianceBaseFox
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
    if (pieceType === 'sympathy') {
      return GAME_ASSET_KEYS.tokenAllianceSympathy
    }
    return null
  }
  return null
}

/** Faction icon texture key for rail / warrior stacks. */
export function factionTextureKey(factionId: string): string {
  const expansionKey = expansionFactionTextureKey(factionId)
  if (expansionKey !== null) {
    return expansionKey
  }
  if (factionId === 'eyrie') {
    return GAME_ASSET_KEYS.factionEyrie
  }
  if (factionId === 'alliance') {
    return GAME_ASSET_KEYS.factionAlliance
  }
  if (factionId === 'vagabond') {
    return GAME_ASSET_KEYS.factionVagabond
  }
  return GAME_ASSET_KEYS.factionMarquise
}

/** Warrior meeple token for a faction; null when no dedicated warrior art. */
export function warriorTokenTextureKey(factionId: string): string | null {
  if (factionId === 'marquise') {
    return GAME_ASSET_KEYS.tokenMarquiseWarrior
  }
  if (factionId === 'eyrie') {
    return GAME_ASSET_KEYS.tokenEyrieWarrior
  }
  if (factionId === 'alliance') {
    return GAME_ASSET_KEYS.tokenAllianceWarrior
  }
  return expansionWarriorTextureKey(factionId)
}

/** Alliance base token by clearing suit. */
export function allianceBaseTextureKey(suit: string): string {
  if (suit === 'mouse') {
    return GAME_ASSET_KEYS.tokenAllianceBaseMouse
  }
  if (suit === 'rabbit') {
    return GAME_ASSET_KEYS.tokenAllianceBaseRabbit
  }
  return GAME_ASSET_KEYS.tokenAllianceBaseFox
}

const SUIT_TEXTURE_KEYS: Readonly<Record<string, string>> = {
  fox: GAME_ASSET_KEYS.suitFox,
  mouse: GAME_ASSET_KEYS.suitMouse,
  rabbit: GAME_ASSET_KEYS.suitRabbit,
  bird: GAME_ASSET_KEYS.suitBird,
}

/** Suit icon (fox / mouse / rabbit / bird); null for an unknown suit. */
export function suitTextureKey(suit: string): string | null {
  return SUIT_TEXTURE_KEYS[suit] ?? null
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

/**
 * Menu shell only — banner, wallpaper, faction heads for the lobby picker.
 * Keeps first paint under a thin download; game art warms after the menu.
 */
export const MENU_BOOT_IMAGE_ASSET_KEYS: ReadonlySet<string> = new Set([
  GAME_ASSET_KEYS.rootBanner,
  GAME_ASSET_KEYS.menuWallpaper,
  GAME_ASSET_KEYS.factionMarquise,
  GAME_ASSET_KEYS.factionEyrie,
  GAME_ASSET_KEYS.factionAlliance,
  GAME_ASSET_KEYS.factionVagabond,
  RIVERFOLK_EXPANSION_ASSET_KEYS.factionLizard,
  RIVERFOLK_EXPANSION_ASSET_KEYS.factionRiverfolk,
])

/** All in-game images except card faces. */
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
    key: GAME_ASSET_KEYS.factionMarquise,
    path: 'assets/factions/marquise.png',
  },
  {
    key: GAME_ASSET_KEYS.factionEyrie,
    path: 'assets/factions/eyrie.png',
  },
  {
    key: GAME_ASSET_KEYS.factionAlliance,
    path: 'assets/factions/alliance.png',
  },
  {
    key: GAME_ASSET_KEYS.factionVagabond,
    path: 'assets/factions/vagabond.png',
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
    key: GAME_ASSET_KEYS.characterBoardAlliance,
    path: 'assets/character-boards/woodland-alliance-front.webp',
  },
  {
    key: GAME_ASSET_KEYS.characterBoardVagabond,
    path: 'assets/character-boards/vagabond-front.webp',
  },
  {
    key: GAME_ASSET_KEYS.characterCardVagabondThief,
    path: 'assets/character-boards/vagabond-thief-front.webp',
  },
  {
    key: GAME_ASSET_KEYS.characterCardVagabondTinker,
    path: 'assets/character-boards/vagabond-tinker-front.webp',
  },
  {
    key: GAME_ASSET_KEYS.characterCardVagabondRanger,
    path: 'assets/character-boards/vagabond-ranger-front.webp',
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
    key: GAME_ASSET_KEYS.suitBird,
    path: 'assets/suits/bird.png',
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
    key: GAME_ASSET_KEYS.tokenMarquiseWarrior,
    path: 'assets/tokens/marquise/warrior.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenEyrieRoost,
    path: 'assets/tokens/eyrie/roost.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenEyrieWarrior,
    path: 'assets/tokens/eyrie/warrior.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenAllianceSympathy,
    path: 'assets/tokens/alliance/sympathy.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenAllianceBaseFox,
    path: 'assets/tokens/alliance/base-fox.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenAllianceBaseMouse,
    path: 'assets/tokens/alliance/base-mouse.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenAllianceBaseRabbit,
    path: 'assets/tokens/alliance/base-rabbit.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenAllianceWarrior,
    path: 'assets/tokens/alliance/warrior.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenVagabondPawn,
    path: 'assets/tokens/vagabond/pawn.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenVagabondPawnTinker,
    path: 'assets/tokens/vagabond/pawn-tinker.png',
  },
  {
    key: GAME_ASSET_KEYS.tokenVagabondPawnRanger,
    path: 'assets/tokens/vagabond/pawn-ranger.png',
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
  {
    key: GAME_ASSET_KEYS.itemTorch,
    path: 'assets/items/torch.png',
  },
  ...RIVERFOLK_EXPANSION_IMAGE_ASSETS,
]

/** Images the boot screen waits on before the menu. */
export const MENU_BOOT_IMAGE_ASSETS: readonly GameImageAsset[] =
  CORE_IMAGE_ASSETS.filter((asset) =>
    MENU_BOOT_IMAGE_ASSET_KEYS.has(asset.key),
  )

/**
 * Images warmed after the menu (boards, tokens).
 * Menu assets are skipped — the boot pass already fetched them.
 */
export const WARM_GAME_IMAGE_ASSETS: readonly GameImageAsset[] =
  CORE_IMAGE_ASSETS.filter(
    (asset) => !MENU_BOOT_IMAGE_ASSET_KEYS.has(asset.key),
  )

/**
 * Native iOS build: paths to `<link rel="preload">` at compile time.
 * Menu boot first, then warm art (same set the web app fetches after boot).
 */
export function nativeCompileTimePreloadImagePaths(): readonly string[] {
  return [
    ...MENU_BOOT_IMAGE_ASSETS.map((asset) => asset.path),
    ...WARM_GAME_IMAGE_ASSETS.map((asset) => asset.path),
  ]
}

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
  return publicAssetUrl(asset.path)
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

/** Boot: faction/token icons only (cards load later). */
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
  return publicAssetUrl(asset.path)
}

export function lookupCardCatalog(defId: string): CardCatalogEntry | null {
  return CARD_CATALOG[defId] ?? null
}
