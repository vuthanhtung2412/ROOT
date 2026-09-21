import { describe, expect, it, vi } from 'vitest'
import {
  CORE_IMAGE_ASSETS,
  cardImageAssets,
  preloadCardImageAssets,
  preloadCoreGameAssets,
  type ImageAssetLoader,
} from './gameAssets.ts'

function makeLoaderMock(): ImageAssetLoader {
  return {
    image: vi.fn((_key: string, _url: string): void => {
      return
    }),
  }
}

describe('preloadCoreGameAssets', () => {
  it('loads map and tokens only, not card faces', () => {
    const loader = makeLoaderMock()
    preloadCoreGameAssets(loader)

    expect(loader.image).toHaveBeenCalledTimes(CORE_IMAGE_ASSETS.length)
    for (const asset of CORE_IMAGE_ASSETS) {
      expect(loader.image).toHaveBeenCalledWith(asset.key, asset.path)
    }
    for (const asset of cardImageAssets()) {
      expect(loader.image).not.toHaveBeenCalledWith(asset.key, asset.path)
    }
  })
})

describe('preloadCardImageAssets', () => {
  it('queues every catalog card face', () => {
    const loader = makeLoaderMock()
    const cards = cardImageAssets()
    preloadCardImageAssets(loader)

    expect(loader.image).toHaveBeenCalledTimes(cards.length)
    expect(cards.length).toBeGreaterThan(0)
  })
})
