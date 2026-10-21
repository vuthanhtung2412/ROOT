import type { Card, CardSuit } from '#cards/types.js'
import type { BuildingTrack } from '#state/boards.js'

/** Rule: Rootbotics 4.3.1 — supply of 25 warriors. */
export const MECHANICAL_MARQUISE_WARRIOR_COUNT = 25
/** Rule: Rootbotics 4.3.5 — five of each building on its track (one starts on the map). */
export const MECHANICAL_MARQUISE_TRACK_BUILDINGS = 5
/**
 * Rule: Rootbotics 4.6.1 / Mechanical Marquise 2.0 board — every Buildings
 * track shows +0 … +5, left to right (unlike the Marquise de Cat tracks).
 */
export const MECHANICAL_MARQUISE_TRACK_VICTORY_POINTS = [0, 1, 2, 3, 4, 5] as const

/** Rule: Rootbotics 5.3.1 — supply of 20 warriors. */
export const ELECTRIC_EYRIE_WARRIOR_COUNT = 20
/** Rule: Rootbotics 5.3.4 — six roosts on the track (one starts on the map). */
export const ELECTRIC_EYRIE_TRACK_ROOSTS = 6
/** Rule: Rootbotics 5.6 / errata board — Roosts track VP by roosts on the map (index 0..7). */
export const ELECTRIC_EYRIE_ROOST_VICTORY_POINTS = [0, 0, 1, 2, 3, 4, 5, 6] as const

/**
 * Rule: Rootbotics 5.4.3 / errata board — Decree columns left to right.
 * Loyal Viziers start in the rightmost (bird) column (5.3.3).
 */
export const ELECTRIC_EYRIE_DECREE_COLUMNS: readonly CardSuit[] = [
  'fox',
  'mouse',
  'rabbit',
  'bird',
]

export type MechanicalMarquiseBoard = {
  kind: 'mechanicalMarquise'
  supply: { warriors: number }
  tracks: {
    sawmill: BuildingTrack
    workshop: BuildingTrack
    recruiter: BuildingTrack
  }
  /** Rule: Rootbotics 2.7 — the revealed order card of this turn. */
  orderCard: Card | null
}

export type ElectricEyrieBoard = {
  kind: 'electricEyrie'
  supply: { warriors: number }
  /** Decree columns by suit (fox, mouse, rabbit, bird). */
  decree: Record<CardSuit, Card[]>
  roostTrack: { placed: number }
  /** Rule: Rootbotics 2.7 — the revealed order card of this turn. */
  orderCard: Card | null
}

export function emptyElectricEyrieDecree(): Record<CardSuit, Card[]> {
  return { fox: [], mouse: [], rabbit: [], bird: [] }
}

export function createMechanicalMarquiseBoard(): MechanicalMarquiseBoard {
  return {
    kind: 'mechanicalMarquise',
    supply: { warriors: MECHANICAL_MARQUISE_WARRIOR_COUNT },
    tracks: {
      sawmill: { placed: 0 },
      workshop: { placed: 0 },
      recruiter: { placed: 0 },
    },
    orderCard: null,
  }
}

export function createElectricEyrieBoard(): ElectricEyrieBoard {
  return {
    kind: 'electricEyrie',
    supply: { warriors: ELECTRIC_EYRIE_WARRIOR_COUNT },
    decree: emptyElectricEyrieDecree(),
    roostTrack: { placed: 0 },
    orderCard: null,
  }
}
