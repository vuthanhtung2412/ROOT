import { describe, expect, it, vi } from 'vitest'
import {
  CARD_CATALOG,
  CORE_IMAGE_ASSETS,
  CRAFTED_ITEM_TEXTURE_TYPES,
  MENU_BOOT_IMAGE_ASSETS,
  WARM_GAME_IMAGE_ASSETS,
  cardImageAssetForDefId,
  cardImageAssets,
  itemTextureKey,
  nativeCompileTimePreloadImagePaths,
  preloadCoreGameAssets,
  queueMissingCardImages,
  warriorTokenTextureKey,
  type ImageAssetLoader,
} from '#assets/gameAssets.ts'

function makeLoaderMock(): ImageAssetLoader {
  return {
    image: vi.fn((_key: string, _url: string): void => {
      return
    }),
  }
}

function firstCatalogDefId(): string {
  const defId = Object.keys(CARD_CATALOG)[0]
  if (defId === undefined) {
    throw new Error('CARD_CATALOG is empty')
  }
  return defId
}

describe('itemTextureKey', () => {
  it('maps all supply item types with icons', () => {
    for (const itemType of CRAFTED_ITEM_TEXTURE_TYPES) {
      expect(itemTextureKey(itemType)).toBe(`item-${itemType}`)
    }
  })

  it('returns null for unknown types', () => {
    expect(itemTextureKey('not-an-item')).toBeNull()
  })

  it('maps torch Vagabond starting item', () => {
    expect(itemTextureKey('torch')).toBe('item-torch')
  })
})

describe('warriorTokenTextureKey', () => {
  it('maps marquise eyrie alliance warriors', () => {
    expect(warriorTokenTextureKey('marquise')).toBe('token-marquise-warrior')
    expect(warriorTokenTextureKey('eyrie')).toBe('token-eyrie-warrior')
    expect(warriorTokenTextureKey('alliance')).toBe('token-alliance-warrior')
    expect(warriorTokenTextureKey('vagabond')).toBeNull()
  })
})

describe('menu vs warm image splits', () => {
  it('menu boot is a thin lobby-only set', () => {
    expect(MENU_BOOT_IMAGE_ASSETS.length).toBeLessThan(CORE_IMAGE_ASSETS.length)
    expect(MENU_BOOT_IMAGE_ASSETS.map((asset) => asset.key)).toEqual(
      expect.arrayContaining([
        'root-banner',
        'menu-wallpaper',
        'faction-marquise',
        'faction-lizard',
        'faction-riverfolk',
      ]),
    )
  })

  it('warm set covers remaining core art', () => {
    expect(WARM_GAME_IMAGE_ASSETS.length).toBeGreaterThan(0)
    for (const asset of MENU_BOOT_IMAGE_ASSETS) {
      expect(WARM_GAME_IMAGE_ASSETS.map((entry) => entry.key)).not.toContain(
        asset.key,
      )
    }
  })

  it('native compile-time preload lists menu boot then warm art', () => {
    const paths = nativeCompileTimePreloadImagePaths()
    expect(paths[0]).toBe(MENU_BOOT_IMAGE_ASSETS[0]?.path)
    expect(paths).toHaveLength(
      MENU_BOOT_IMAGE_ASSETS.length + WARM_GAME_IMAGE_ASSETS.length,
    )
  })
})

describe('preloadCoreGameAssets', () => {
  it('loads tokens only, not card faces', () => {
    const loader = makeLoaderMock()
    preloadCoreGameAssets(loader)

    expect(loader.image).toHaveBeenCalledTimes(CORE_IMAGE_ASSETS.length)
    for (const asset of CORE_IMAGE_ASSETS) {
      expect(loader.image).toHaveBeenCalledWith(asset.key, asset.path)
    }
    expect(loader.image).toHaveBeenCalledWith(
      'root-banner',
      'assets/branding/root-banner.jpg',
    )
    expect(loader.image).toHaveBeenCalledWith(
      'menu-wallpaper',
      'assets/branding/ulrick-wery-riverside.webp',
    )
    for (const asset of cardImageAssets()) {
      expect(loader.image).not.toHaveBeenCalledWith(asset.key, asset.path)
    }
  })
})

describe('queueMissingCardImages', () => {
  it('queues only missing unique defIds', () => {
    const loader = makeLoaderMock()
    const defId = firstCatalogDefId()
    const asset = cardImageAssetForDefId(defId)
    expect(asset).not.toBeNull()
    if (asset === null) {
      return
    }
    const existing = new Set<string>([asset.key])

    const result = queueMissingCardImages(
      loader,
      (key) => existing.has(key),
      [defId, defId],
    )

    expect(result.queuedCount).toBe(0)
    expect(loader.image).not.toHaveBeenCalled()
  })

  it('skips keys already queued and catalogs unknown defIds', () => {
    const loader = makeLoaderMock()
    const defId = firstCatalogDefId()
    const asset = cardImageAssetForDefId(defId)
    expect(asset).not.toBeNull()
    if (asset === null) {
      return
    }
    const pending = new Set<string>([asset.key])

    const result = queueMissingCardImages(
      loader,
      () => false,
      [defId, 'not-a-real-card'],
      pending,
    )

    expect(result.queuedCount).toBe(0)
    expect(cardImageAssetForDefId('not-a-real-card')).toBeNull()
  })

  it('queues a new card face once', () => {
    const loader = makeLoaderMock()
    const defId = firstCatalogDefId()
    const asset = cardImageAssetForDefId(defId)
    expect(asset).not.toBeNull()
    if (asset === null) {
      return
    }

    const result = queueMissingCardImages(loader, () => false, [defId])

    expect(result.queuedCount).toBe(1)
    expect(loader.image).toHaveBeenCalledWith(asset.key, asset.path)
  })
})
