import { describe, expect, it } from 'vitest'
import {
  factionImageAssetsFor,
  SHARED_GAME_IMAGE_ASSETS,
} from '#assets/factionImageAssets.ts'
import { GAME_ASSET_KEYS, WARM_GAME_IMAGE_ASSETS } from '#assets/gameAssets.ts'
import { RIVERFOLK_EXPANSION_ASSET_KEYS } from '#assets/riverfolkExpansionAssets.ts'

const EVERY_FACTION: readonly string[] = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
  'mechanicalMarquise',
  'electricEyrie',
  'automatedAlliance',
  'vagabot',
]

function assetKeysForFactions(factionIds: readonly string[]): readonly string[] {
  return factionImageAssetsFor(factionIds).map((asset) => asset.key)
}

describe('factionImageAssetsFor', () => {
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

  it('leaves out shared art', () => {
    const keys = assetKeysForFactions(EVERY_FACTION)

    expect(keys).not.toContain(GAME_ASSET_KEYS.suitFox)
    expect(keys).not.toContain(GAME_ASSET_KEYS.itemBoot)
  })
})

describe('bot faction art', () => {
  it('fetches the bot board and the tokens of the faction it replaces', () => {
    const keys = assetKeysForFactions(['electricEyrie'])

    expect(keys).toContain(GAME_ASSET_KEYS.characterBoardElectricEyrie)
    expect(keys).toContain(GAME_ASSET_KEYS.tokenEyrieRoost)
    expect(keys).not.toContain(GAME_ASSET_KEYS.characterBoardMechanicalMarquise)
  })
})

describe('SHARED_GAME_IMAGE_ASSETS', () => {
  it('holds suits, items and ruins but no faction art', () => {
    const keys = SHARED_GAME_IMAGE_ASSETS.map((asset) => asset.key)

    expect(keys).toContain(GAME_ASSET_KEYS.suitFox)
    expect(keys).toContain(GAME_ASSET_KEYS.itemBoot)
    expect(keys).toContain(GAME_ASSET_KEYS.markerRuin)
    expect(keys).not.toContain(GAME_ASSET_KEYS.characterBoardMarquise)
    expect(keys).not.toContain(GAME_ASSET_KEYS.tokenEyrieWarrior)
  })

  it('with every faction art covers the whole warm set', () => {
    const covered = [
      ...SHARED_GAME_IMAGE_ASSETS,
      ...factionImageAssetsFor(EVERY_FACTION),
    ].map((asset) => asset.key)

    expect([...covered].sort()).toEqual(
      WARM_GAME_IMAGE_ASSETS.map((asset) => asset.key).sort(),
    )
  })
})
