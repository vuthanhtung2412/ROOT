import { describe, expect, it } from 'vitest'
import {
  BOT_FACTION_IMAGE_ASSETS,
  type BotFactionImageAsset,
} from '#assets/botFactionAssets.ts'
import {
  factionTextureKey,
  MENU_BOOT_IMAGE_ASSETS,
  warriorTokenTextureKey,
  type GameImageAsset,
} from '#assets/gameAssets.ts'

describe('bot faction assets', () => {
  it('gives each bot its own faction icon', () => {
    expect(factionTextureKey('mechanicalMarquise')).toBe(
      'faction-mechanical-marquise',
    )
    expect(factionTextureKey('electricEyrie')).toBe('faction-electric-eyrie')
    expect(factionTextureKey('automatedAlliance')).toBe(
      'faction-automated-alliance',
    )
    expect(factionTextureKey('vagabot')).toBe('faction-vagabot')
  })

  it('keeps the warriors of the faction the bot replaces', () => {
    expect(warriorTokenTextureKey('mechanicalMarquise')).toBe(
      'token-marquise-warrior',
    )
  })

  it('loads bot icons with the menu lobby', () => {
    const menuBootKeys: readonly string[] = MENU_BOOT_IMAGE_ASSETS.map(
      (asset: GameImageAsset): string => asset.key,
    )
    BOT_FACTION_IMAGE_ASSETS.forEach((asset: BotFactionImageAsset): void => {
      expect(menuBootKeys).toContain(asset.key)
    })
  })
})
