import { describe, expect, it } from 'vitest'
import { gameImageAssetsForFactions } from '#assets/factionImageAssets.ts'
import { GAME_ASSET_KEYS, WARM_GAME_IMAGE_ASSETS } from '#assets/gameAssets.ts'
import { RIVERFOLK_EXPANSION_ASSET_KEYS } from '#assets/riverfolkExpansionAssets.ts'

function assetKeysForFactions(factionIds: readonly string[]): readonly string[] {
  return gameImageAssetsForFactions(factionIds).map((asset) => asset.key)
}

describe('gameImageAssetsForFactions', () => {
  it('keeps the boards and tokens of the factions in play', () => {
    const keys = assetKeysForFactions(['marquise', 'lizard'])

    expect(keys).toContain(GAME_ASSET_KEYS.characterBoardMarquise)
    expect(keys).toContain(GAME_ASSET_KEYS.tokenMarquiseSawmill)
    expect(keys).toContain(RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardLizard)
    expect(keys).toContain(RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenFox)
  })

  it('leaves out the boards and tokens of factions not in play', () => {
    const keys = assetKeysForFactions(['marquise', 'lizard'])

    expect(keys).not.toContain(GAME_ASSET_KEYS.characterBoardEyrie)
    expect(keys).not.toContain(GAME_ASSET_KEYS.tokenAllianceWarrior)
    expect(keys).not.toContain(GAME_ASSET_KEYS.characterCardVagabondThief)
    expect(keys).not.toContain(
      RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardRiverfolk,
    )
  })

  it('always keeps shared art', () => {
    const keys = assetKeysForFactions([])

    expect(keys).toContain(GAME_ASSET_KEYS.suitFox)
    expect(keys).toContain(GAME_ASSET_KEYS.itemBoot)
    expect(keys).toContain(GAME_ASSET_KEYS.markerRuin)
  })

  it('covers the whole warm set when every faction plays', () => {
    const everyFaction = [
      'marquise',
      'eyrie',
      'alliance',
      'vagabond',
      'lizard',
      'riverfolk',
    ]

    expect(gameImageAssetsForFactions(everyFaction)).toEqual(
      WARM_GAME_IMAGE_ASSETS,
    )
  })
})
