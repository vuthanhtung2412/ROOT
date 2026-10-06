import type { Card } from '#cards/types.js'
import type { Suit } from '#map/types.js'

/** Rule: 10.3.1 — supply of 25 warriors. */
export const LIZARD_WARRIOR_COUNT = 25
/** Rule: 10.3.2 — warriors in the starting corner clearing. */
export const LIZARD_STARTING_CORNER_WARRIORS = 4
/** Rule: 10.3.4 — five gardens per suit (15 total, one starts on the map). */
export const LIZARD_GARDENS_PER_SUIT = 5
/** Rule: 10.5.3 — victory points above each Gardens track space, left to right. */
export const LIZARD_GARDEN_VICTORY_POINTS = [0, 2, 2, 3, 4] as const
/** Gardens of one suit on the map that uncover that track's draw bonus. */
export const LIZARD_DRAW_BONUS_GARDEN_COUNT = 2
/** Rule: 10.4.3 — if the Outcast is Hated, a conspiracy costs one fewer acolyte. */
export const LIZARD_HATED_DISCOUNT = 1
export const LIZARD_SUITS: readonly Suit[] = ['fox', 'rabbit', 'mouse']

export type LizardConspiracy = 'crusade' | 'convert' | 'sanctify'

/** Rule: 10.4.3 — acolytes spent per conspiracy. */
export const LIZARD_CONSPIRACY_COST: Record<LizardConspiracy, number> = {
  crusade: 2,
  convert: 2,
  sanctify: 3,
}

export type LizardBoard = {
  kind: 'lizard'
  supply: { warriors: number }
  /** Warriors in the Acolytes box. Rule: 10.2.3 Revenge / 10.5.4 Sacrifice. */
  acolytes: number
  /** Null until chosen in setup. Rule: 10.3.3. */
  outcast: Suit | null
  /** Outcast marker shows its Hated side. Rule: 10.4.1. */
  hated: boolean
  /** Gardens still on each Gardens track (not on the map). */
  gardens: Record<Suit, number>
  /** Cards revealed this turn; back to hand in Evening. Rule: 10.5 / 10.6.1. */
  revealed: Card[]
}

export function createLizardBoard(): LizardBoard {
  return {
    kind: 'lizard',
    supply: { warriors: LIZARD_WARRIOR_COUNT },
    acolytes: 0,
    outcast: null,
    hated: false,
    gardens: {
      fox: LIZARD_GARDENS_PER_SUIT,
      rabbit: LIZARD_GARDENS_PER_SUIT,
      mouse: LIZARD_GARDENS_PER_SUIT,
    },
    revealed: [],
  }
}
