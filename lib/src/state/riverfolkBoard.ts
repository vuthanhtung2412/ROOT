import type { Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'

/** Rule: 11.3.1 — supply of 15 warriors. */
export const RIVERFOLK_WARRIOR_COUNT = 15
/** Rule: 11.3.2 — warriors placed in clearings touching the river. */
export const RIVERFOLK_STARTING_WARRIORS = 4
/** Rule: 11.3.4 — warriors placed in the Payments box. */
export const RIVERFOLK_STARTING_PAYMENTS = 3
/** Rule: 11.3.3 — three trade posts per suit. */
export const RIVERFOLK_TRADE_POSTS_PER_SUIT = 3
/** Rule: 11.5.6.III — victory points under each Trade Posts track space. */
export const RIVERFOLK_TRADE_POST_VICTORY_POINTS = [2, 2, 2] as const
/** Rule: 11.4.1 Protectionism — warriors added to an empty Payments box. */
export const RIVERFOLK_PROTECTIONISM_WARRIORS = 2
/** Rule: 11.4.2 Score Dividends — one victory point per this many funds. */
export const RIVERFOLK_FUNDS_PER_DIVIDEND = 2
/** Rule: 11.5.6 — funds spent to establish a trade post. */
export const RIVERFOLK_TRADE_POST_FUND_COST = 2
/** Rule: 11.2.6.II — one service per turn before trade post bonuses. */
export const RIVERFOLK_BASE_SERVICES_PER_TURN = 1

export const RIVERFOLK_SERVICES = [
  'handCard',
  'riverboats',
  'mercenaries',
] as const

export type RiverfolkService = (typeof RIVERFOLK_SERVICES)[number]

/** Rule: 11.3.5 — spaces of each Services track. */
export const RIVERFOLK_SERVICE_COSTS = [1, 2, 3, 4] as const

export const RIVERFOLK_DEFAULT_SERVICE_COST = 1

export type RiverfolkServiceCosts = Record<RiverfolkService, number>

/**
 * Warriors in one box of the faction board, one entry per warrior, naming the
 * seat that owns it (spent funds return to their owner's supply).
 */
export type RiverfolkFundBox = Seat[]

export type RiverfolkBoard = {
  kind: 'riverfolk'
  supply: { warriors: number }
  payments: RiverfolkFundBox
  funds: RiverfolkFundBox
  committed: RiverfolkFundBox
  /** Trade posts still on each Trade Posts track. */
  tradePosts: Record<Suit, number>
  /** Funds committed to empty Trade Posts spaces to craft. Rule: 11.5.3. */
  craftCommitted: Record<Suit, RiverfolkFundBox>
  serviceCosts: RiverfolkServiceCosts
}

export function createRiverfolkBoard(): RiverfolkBoard {
  return {
    kind: 'riverfolk',
    supply: { warriors: RIVERFOLK_WARRIOR_COUNT },
    payments: [],
    funds: [],
    committed: [],
    tradePosts: {
      fox: RIVERFOLK_TRADE_POSTS_PER_SUIT,
      rabbit: RIVERFOLK_TRADE_POSTS_PER_SUIT,
      mouse: RIVERFOLK_TRADE_POSTS_PER_SUIT,
    },
    craftCommitted: { fox: [], rabbit: [], mouse: [] },
    serviceCosts: {
      handCard: RIVERFOLK_DEFAULT_SERVICE_COST,
      riverboats: RIVERFOLK_DEFAULT_SERVICE_COST,
      mercenaries: RIVERFOLK_DEFAULT_SERVICE_COST,
    },
  }
}
