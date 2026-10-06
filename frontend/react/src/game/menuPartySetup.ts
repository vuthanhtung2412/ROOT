/**
 * Menu party setup — player count + unique faction seats.
 */

export const MENU_FACTION_IDS = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
] as const

export type MenuFactionId = (typeof MENU_FACTION_IDS)[number]

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
  return MENU_FACTION_IDS.some((factionId) => factionId === value)
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
    if (seen.has(faction)) {
      return { ok: false, reason: 'Each player needs a different faction' }
    }
    seen.add(faction)
    resolved.push(faction)
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
  const previousIndex = next.indexOf(nextFaction)
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
      return 'Lizard Cult'
    case 'riverfolk':
      return 'Riverfolk Company'
  }
}
