/** Faction + piece colors for vector board tokens. */

export const FACTION_COLORS = {
  marquise: 0xc45c26,
  eyrie: 0x3a5f8a,
  alliance: 0x3d7a4a,
  vagabond: 0x5a5a5a,
  neutral: 0xb8a078,
} as const

export type FactionColorKey = keyof typeof FACTION_COLORS

export function factionColorForSeat(
  seat: number,
  factions: readonly string[],
): number {
  const factionId = factions[seat]
  if (factionId === 'marquise') {
    return FACTION_COLORS.marquise
  }
  if (factionId === 'eyrie') {
    return FACTION_COLORS.eyrie
  }
  if (factionId === 'alliance') {
    return FACTION_COLORS.alliance
  }
  if (factionId === 'vagabond') {
    return FACTION_COLORS.vagabond
  }
  return FACTION_COLORS.neutral
}

export const PIECE_DRAW = {
  warriorRadius: 7,
  buildingSize: 14,
  tokenRadius: 6,
  iconSize: 28,
  buildingIconSize: 24,
  stackGap: 34,
} as const
