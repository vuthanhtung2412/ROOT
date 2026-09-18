import type Phaser from 'phaser'

/** Phaser texture keys and public asset paths for GP2 preload. */

export const GAME_ASSET_KEYS = {
  autumnMap: 'autumn-map',
  factionMarquise: 'faction-marquise',
  factionEyrie: 'faction-eyrie',
} as const

export type GameAssetKey = (typeof GAME_ASSET_KEYS)[keyof typeof GAME_ASSET_KEYS]

export type GameImageAsset = {
  key: GameAssetKey
  path: string
}

/**
 * Core board + faction icons.
 * Card faces: suit-colored vector glyphs (see CardView) — EP PNGs are
 * reference-only until distribution rights are resolved.
 */
export const CORE_IMAGE_ASSETS: readonly GameImageAsset[] = [
  { key: GAME_ASSET_KEYS.autumnMap, path: 'assets/map/autumn-map.jpg' },
  {
    key: GAME_ASSET_KEYS.factionMarquise,
    path: 'assets/factions/marquise.png',
  },
  {
    key: GAME_ASSET_KEYS.factionEyrie,
    path: 'assets/factions/eyrie.png',
  },
]

export function preloadCoreGameAssets(
  loader: Phaser.Loader.LoaderPlugin,
): void {
  for (const asset of CORE_IMAGE_ASSETS) {
    loader.image(asset.key, asset.path)
  }
}
