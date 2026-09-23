import { describe, expect, it, vi } from 'vitest'
import {
  AUTUMN_MAP_ASSET,
  CARD_CATALOG,
  CORE_IMAGE_ASSETS,
  CRAFTED_ITEM_TEXTURE_TYPES,
  cardImageAssetForDefId,
  cardImageAssets,
  itemTextureKey,
  preloadCoreGameAssets,
  queueAutumnMapImage,
  queueMissingCardImages,
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

  it('returns null for torch and unknown types', () => {
    expect(itemTextureKey('torch')).toBeNull()
    expect(itemTextureKey('not-an-item')).toBeNull()
  })
})

describe('preloadCoreGameAssets', () => {
  it('loads tokens only, not autumn map or card faces', () => {
    const loader = makeLoaderMock()
    preloadCoreGameAssets(loader)

    expect(loader.image).toHaveBeenCalledTimes(CORE_IMAGE_ASSETS.length)
    for (const asset of CORE_IMAGE_ASSETS) {
      expect(loader.image).toHaveBeenCalledWith(asset.key, asset.path)
    }
    expect(loader.image).not.toHaveBeenCalledWith(
      AUTUMN_MAP_ASSET.key,
      AUTUMN_MAP_ASSET.path,
    )
    for (const asset of cardImageAssets()) {
      expect(loader.image).not.toHaveBeenCalledWith(asset.key, asset.path)
    }
  })
})

describe('queueAutumnMapImage', () => {
  it('queues map when texture missing', () => {
    const loader = makeLoaderMock()
    expect(queueAutumnMapImage(loader, () => false)).toBe(true)
    expect(loader.image).toHaveBeenCalledWith(
      AUTUMN_MAP_ASSET.key,
      AUTUMN_MAP_ASSET.path,
    )
  })

  it('skips when texture already exists', () => {
    const loader = makeLoaderMock()
    expect(queueAutumnMapImage(loader, () => true)).toBe(false)
    expect(loader.image).not.toHaveBeenCalled()
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
