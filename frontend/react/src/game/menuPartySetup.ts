/**
 * Menu party setup — player count + unique faction seats.
 */
import { artFactionOf, isBotFaction } from '@root/lib/bot-factions'
import { LIZARD_CULT_DISPLAY_NAME } from '#game/birthdayEdition.ts'

export const MENU_FACTION_IDS = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
] as const

/** Rootbotics bots: a hotseat seat the engine plays by itself. */
export const MENU_BOT_FACTION_IDS = [
  'mechanicalMarquise',
  'electricEyrie',
  'automatedAlliance',
  'vagabot',
] as const

/** Hotseat choices: every faction, then the bots. */
export const HOTSEAT_FACTION_IDS = [
  ...MENU_FACTION_IDS,
  ...MENU_BOT_FACTION_IDS,
] as const

export type MenuFactionId = (typeof HOTSEAT_FACTION_IDS)[number]

export type MenuPlayerCount = 2 | 3 | 4

export const MENU_PLAYER_COUNTS: readonly MenuPlayerCount[] = [2, 3, 4]

const DEFAULT_FACTIONS_BY_COUNT: Record<MenuPlayerCount, MenuFactionId[]> = {
  2: ['marquise', 'eyrie'],
  3: ['marquise', 'eyrie', 'alliance'],
  4: ['marquise', 'eyrie', 'alliance', 'vagabond'],
}

export function defaultFactionsForPlayerCount(
  playerCount: MenuPlayerCount,
): MenuFactionId[] {
  return [...DEFAULT_FACTIONS_BY_COUNT[playerCount]]
}

export function isMenuFactionId(value: string): value is MenuFactionId {
  return HOTSEAT_FACTION_IDS.some((factionId) => factionId === value)
}

export function isMenuPlayerCount(value: number): value is MenuPlayerCount {
  return MENU_PLAYER_COUNTS.some((count) => count === value)
}

export type PartySetupValidation =
  | { ok: true; factions: MenuFactionId[] }
  | { ok: false; reason: string }

/** Unique seats, length 2–4. */
export function validatePartyFactions(
  factions: readonly string[],
): PartySetupValidation {
  if (
    factions.length !== 2 &&
    factions.length !== 3 &&
    factions.length !== 4
  ) {
    return { ok: false, reason: 'Pick 2, 3, or 4 players' }
  }
  const resolved: MenuFactionId[] = []
  const seen = new Set<string>()
  for (const faction of factions) {
    if (!isMenuFactionId(faction)) {
      return { ok: false, reason: `Unknown faction: ${faction}` }
    }
    // A bot uses the pieces of the faction it replaces (Rootbotics 3.2).
    const pieces: string = artFactionOf(faction)
    if (seen.has(pieces)) {
      return { ok: false, reason: 'Each player needs a different faction' }
    }
    seen.add(pieces)
    resolved.push(faction)
  }
  if (resolved.every((faction: MenuFactionId): boolean => isBotFaction(faction))) {
    return { ok: false, reason: 'Seat at least one human player' }
  }
  return { ok: true, factions: resolved }
}

/** Swap seat to faction; if taken, swap with that seat. */
export function assignFactionAtSeat(
  factions: readonly MenuFactionId[],
  seatIndex: number,
  nextFaction: MenuFactionId,
): MenuFactionId[] {
  if (seatIndex < 0 || seatIndex >= factions.length) {
    return [...factions]
  }
  const next = [...factions]
  // A bot and the faction it replaces share pieces: one of them per game.
  const previousIndex = next.findIndex(
    (faction: MenuFactionId): boolean =>
      artFactionOf(faction) === artFactionOf(nextFaction),
  )
  const previousFaction = next[seatIndex]!
  if (previousIndex >= 0 && previousIndex !== seatIndex) {
    next[previousIndex] = previousFaction
  }
  next[seatIndex] = nextFaction
  return next
}

export function factionDisplayName(factionId: MenuFactionId): string {
  switch (factionId) {
    case 'marquise':
      return 'Marquise de Cat'
    case 'eyrie':
      return 'Eyrie Dynasties'
    case 'alliance':
      return 'Woodland Alliance'
    case 'vagabond':
      return 'Vagabond'
    case 'lizard':
      return LIZARD_CULT_DISPLAY_NAME
    case 'riverfolk':
      return 'Riverfolk Company'
    case 'mechanicalMarquise':
      return 'Mechanical Marquise'
    case 'electricEyrie':
      return 'Electric Eyrie'
    case 'automatedAlliance':
      return 'Automated Alliance'
    case 'vagabot':
      return 'Vagabot'
  }
}
