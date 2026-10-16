/** Faction + piece colors for vector board tokens. */
import { artFactionOf } from '@root/lib/bot-factions'

export const FACTION_COLORS = {
  marquise: 0xc45c26,
  eyrie: 0x3a5f8a,
  alliance: 0x3d7a4a,
  vagabond: 0x5a5a5a,
  lizard: 0xc9b530,
  riverfolk: 0x2f9a94,
  neutral: 0xb8a078,
} as const

export type FactionColorKey = keyof typeof FACTION_COLORS

export function factionColorForSeat(
  seat: number,
  factions: readonly string[],
): number {
  const seatFaction = factions[seat]
  // A bot wears the colour of the faction it replaces.
  const factionId =
    seatFaction === undefined ? undefined : artFactionOf(seatFaction)
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
  if (factionId === 'lizard') {
    return FACTION_COLORS.lizard
  }
  if (factionId === 'riverfolk') {
    return FACTION_COLORS.riverfolk
  }
  return FACTION_COLORS.neutral
}

const HEX_RADIX = 16
const HEX_COLOR_DIGIT_COUNT = 6

/** 0xRRGGBB as a CSS colour, e.g. `#4a8c3f`. */
export function colorToCss(color: number): string {
  return `#${color.toString(HEX_RADIX).padStart(HEX_COLOR_DIGIT_COUNT, '0')}`
}

/** CSS colour of a faction, e.g. for the menu rows where no seat exists yet. */
export function factionColorCss(factionId: string): string {
  return colorToCss(factionColorForSeat(0, [factionId]))
}

export const PIECE_DRAW = {
  warriorRadius: 7,
  buildingSize: 14,
  tokenRadius: 6,
  iconSize: 28,
  buildingIconSize: 30,
  stackGap: 34,
} as const
