/** Texture keys and public paths for the Lizard Cult and Riverfolk Company. */

import { IS_BIRTHDAY_EDITION } from '#game/birthdayEdition.ts'

/** Birthday edition: party hat on the icon, hat and bows on the tokens. */
const LIZARD_FACTION_ICON_PATH: string = IS_BIRTHDAY_EDITION
  ? 'assets/factions/lizard-birthday.webp'
  : 'assets/factions/lizard.webp'
const LIZARD_TOKEN_DIRECTORY: string = IS_BIRTHDAY_EDITION
  ? 'assets/tokens/lizard/birthday'
  : 'assets/tokens/lizard'

export const RIVERFOLK_EXPANSION_ASSET_KEYS = {
  factionLizard: 'faction-lizard',
  factionRiverfolk: 'faction-riverfolk',
  characterBoardLizard: 'character-board-lizard',
  characterBoardRiverfolk: 'character-board-riverfolk',
  tokenLizardWarrior: 'token-lizard-warrior',
  tokenLizardGardenFox: 'token-lizard-garden-fox',
  tokenLizardGardenMouse: 'token-lizard-garden-mouse',
  tokenLizardGardenRabbit: 'token-lizard-garden-rabbit',
  tokenLizardOutcast: 'token-lizard-outcast',
  tokenLizardOutcastHated: 'token-lizard-outcast-hated',
  tokenRiverfolkWarrior: 'token-riverfolk-warrior',
  tokenRiverfolkTradePostFox: 'token-riverfolk-trade-post-fox',
  tokenRiverfolkTradePostMouse: 'token-riverfolk-trade-post-mouse',
  tokenRiverfolkTradePostRabbit: 'token-riverfolk-trade-post-rabbit',
} as const

export type ExpansionImageAsset = {
  key: string
  path: string
}

export const RIVERFOLK_EXPANSION_IMAGE_ASSETS: readonly ExpansionImageAsset[] = [
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.factionLizard,
    path: LIZARD_FACTION_ICON_PATH,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.factionRiverfolk,
    path: 'assets/factions/riverfolk.webp',
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardLizard,
    path: 'assets/character-boards/lizard-cult-front.webp',
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardRiverfolk,
    path: 'assets/character-boards/riverfolk-company-front.webp',
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardWarrior,
    path: `${LIZARD_TOKEN_DIRECTORY}/warrior.webp`,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenFox,
    path: `${LIZARD_TOKEN_DIRECTORY}/garden-fox.webp`,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenMouse,
    path: `${LIZARD_TOKEN_DIRECTORY}/garden-mouse.webp`,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenRabbit,
    path: `${LIZARD_TOKEN_DIRECTORY}/garden-rabbit.webp`,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardOutcast,
    path: `${LIZARD_TOKEN_DIRECTORY}/outcast.webp`,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardOutcastHated,
    path: `${LIZARD_TOKEN_DIRECTORY}/outcast-hated.webp`,
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkWarrior,
    path: 'assets/tokens/riverfolk/warrior.webp',
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostFox,
    path: 'assets/tokens/riverfolk/trade-post-fox.webp',
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostMouse,
    path: 'assets/tokens/riverfolk/trade-post-mouse.webp',
  },
  {
    key: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostRabbit,
    path: 'assets/tokens/riverfolk/trade-post-rabbit.webp',
  },
]

const FACTION_ICON_KEYS: Readonly<Record<string, string>> = {
  lizard: RIVERFOLK_EXPANSION_ASSET_KEYS.factionLizard,
  riverfolk: RIVERFOLK_EXPANSION_ASSET_KEYS.factionRiverfolk,
}

const WARRIOR_TOKEN_KEYS: Readonly<Record<string, string>> = {
  lizard: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardWarrior,
  riverfolk: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkWarrior,
}

const GARDEN_KEYS: Readonly<Record<string, string>> = {
  fox: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenFox,
  mouse: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenMouse,
  rabbit: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenRabbit,
}

const TRADE_POST_KEYS: Readonly<Record<string, string>> = {
  fox: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostFox,
  mouse: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostMouse,
  rabbit: RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostRabbit,
}

/** Faction icon of an expansion faction; null for a base faction. */
export function expansionFactionTextureKey(factionId: string): string | null {
  return FACTION_ICON_KEYS[factionId] ?? null
}

/** Warrior meeple of an expansion faction; null for a base faction. */
export function expansionWarriorTextureKey(factionId: string): string | null {
  return WARRIOR_TOKEN_KEYS[factionId] ?? null
}

/** Lizard Cult garden by clearing suit (fox when the suit is unknown). */
export function gardenTextureKey(suit: string): string {
  return GARDEN_KEYS[suit] ?? RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenFox
}

/** Riverfolk trade post by clearing suit (fox when the suit is unknown). */
export function tradePostTextureKey(suit: string): string {
  return (
    TRADE_POST_KEYS[suit] ??
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostFox
  )
}

/** Outcast marker: Outcast side, or Hated side. Rule: 10.4.1. */
export function outcastMarkerTextureKey(hated: boolean): string {
  return hated
    ? RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardOutcastHated
    : RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardOutcast
}

const SUIT_SCOPED_PIECE_TYPES: ReadonlySet<string> = new Set([
  'garden',
  'tradePost',
])

/** Pieces whose art depends on the suit of the clearing they stand in. */
export function isSuitScopedPieceType(pieceType: string | undefined): boolean {
  return pieceType !== undefined && SUIT_SCOPED_PIECE_TYPES.has(pieceType)
}

/** Art for a garden or trade post in a clearing of the given suit. */
export function suitScopedPieceTextureKey(
  pieceType: string,
  suit: string,
): string | null {
  if (pieceType === 'garden') return gardenTextureKey(suit)
  if (pieceType === 'tradePost') return tradePostTextureKey(suit)
  return null
}
