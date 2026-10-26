import type { QuestCard } from '#cards/quests.js'
import type { Card, CardSuit } from '#cards/types.js'
import type { Suit } from '#map/types.js'
import type { ItemType } from '#pieces/types.js'
import { DEFAULT_VAGABOT_CHARACTER, type VagabotCharacter } from '#public/botSettings.js'
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

/** Rule: Rootbotics 6.3.1 — supply of 10 warriors. */
export const AUTOMATED_ALLIANCE_WARRIOR_COUNT = 10
/** Rule: Rootbotics 6.2.1 / 6.3.3 — ten sympathy tokens on the Sympathy track. */
export const AUTOMATED_ALLIANCE_SYMPATHY_TOKENS = 10
/** Rule: Rootbotics 6.5.1 / Automated Alliance board — VP of each Sympathy track space, left to right. */
export const AUTOMATED_ALLIANCE_SYMPATHY_VICTORY_POINTS = [0, 1, 1, 1, 1, 2, 2, 3, 3, 4] as const
/** Rule: Rootbotics 6.3.2 / Bases box — one base per suit, left to right. */
export const AUTOMATED_ALLIANCE_BASE_SUITS: readonly Suit[] = ['fox', 'rabbit', 'mouse']

export type AutomatedAllianceBoard = {
  kind: 'automatedAlliance'
  supply: { warriors: number }
  /** Bases still in the Bases box (not yet revolted onto the map). */
  bases: Suit[]
  /** Sympathy tokens still on the track. */
  sympathyTrack: { placed: number }
  /** Rule: Rootbotics 2.7 — the revealed order card of this turn. */
  orderCard: Card | null
}

/** Rule: Rootbotics 7.2.3 — all items are alike; face up / face down, maybe damaged. */
export type VagabotItem = {
  type: ItemType
  exhausted: boolean
  damaged: boolean
  /** Rule: Rootbotics 7.2.4 — on the Battle Track: never exhausted. */
  onBattleTrack: boolean
}

export type VagabotBoard = {
  kind: 'vagabot'
  character: VagabotCharacter
  /** Satchel, Battle Track and Damaged box together. */
  items: VagabotItem[]
  /** Trait Questing — Battle Track slots never empty again once filled. */
  battleTrackRecord: number
  /** Rule: Rootbotics 7.3.3 — the quest only the Vagabot can complete. */
  quest: QuestCard | null
  /** Non-null when the pawn is in a forest (not on a clearing). */
  forest: number | null
  /** Rule: Rootbotics 2.7 — the revealed order card of this turn. */
  orderCard: Card | null
}

export function createAutomatedAllianceBoard(): AutomatedAllianceBoard {
  return {
    kind: 'automatedAlliance',
    supply: { warriors: AUTOMATED_ALLIANCE_WARRIOR_COUNT },
    bases: [...AUTOMATED_ALLIANCE_BASE_SUITS],
    sympathyTrack: { placed: AUTOMATED_ALLIANCE_SYMPATHY_TOKENS },
    orderCard: null,
  }
}

export function createVagabotBoard(): VagabotBoard {
  return {
    kind: 'vagabot',
    character: DEFAULT_VAGABOT_CHARACTER,
    items: [],
    battleTrackRecord: 0,
    quest: null,
    forest: null,
    orderCard: null,
  }
}
