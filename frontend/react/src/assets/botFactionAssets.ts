/** Texture keys and public paths for the clockwork (bot) faction icons. */

export const BOT_FACTION_ASSET_KEYS = {
  factionMechanicalMarquise: 'faction-mechanical-marquise',
  factionElectricEyrie: 'faction-electric-eyrie',
  factionAutomatedAlliance: 'faction-automated-alliance',
  factionVagabot: 'faction-vagabot',
} as const

export type BotFactionImageAsset = {
  key: string
  path: string
}

export const BOT_FACTION_IMAGE_ASSETS: readonly BotFactionImageAsset[] = [
  {
    key: BOT_FACTION_ASSET_KEYS.factionMechanicalMarquise,
    path: 'assets/factions/mechanical-marquise.webp',
  },
  {
    key: BOT_FACTION_ASSET_KEYS.factionElectricEyrie,
    path: 'assets/factions/electric-eyrie.webp',
  },
  {
    key: BOT_FACTION_ASSET_KEYS.factionAutomatedAlliance,
    path: 'assets/factions/automated-alliance.webp',
  },
  {
    key: BOT_FACTION_ASSET_KEYS.factionVagabot,
    path: 'assets/factions/vagabot.webp',
  },
]

const BOT_FACTION_ICON_KEYS: Readonly<Record<string, string>> = {
  mechanicalMarquise: BOT_FACTION_ASSET_KEYS.factionMechanicalMarquise,
  electricEyrie: BOT_FACTION_ASSET_KEYS.factionElectricEyrie,
  automatedAlliance: BOT_FACTION_ASSET_KEYS.factionAutomatedAlliance,
  vagabot: BOT_FACTION_ASSET_KEYS.factionVagabot,
}

/** Faction icon of a bot faction; null for a non-bot faction. */
export function botFactionTextureKey(factionId: string): string | null {
  return BOT_FACTION_ICON_KEYS[factionId] ?? null
}
