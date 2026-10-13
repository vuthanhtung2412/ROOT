import {
  boardOf,
  canPlaceBaseAfterRevolt,
  isLegalSympathySpreadClearing,
  martialLawSurcharge,
  matchingSupporterCombinations,
  nextSympathyCost,
  nextSympathyVictoryPoints,
  supportersCapacity,
  sympatheticClearings,
} from '#factions/alliance/rules.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'

/** Rule: 8.4.1.II — a revolt spends two matching supporters. */
const REVOLT_SUPPORTER_COST = 2
const SINGLE_SUPPORTER = 1
const SUITS: readonly Suit[] = ['fox', 'rabbit', 'mouse']

export type SympathyTarget = {
  clearing: ClearingId
  suit: Suit
  /** Matching supporters to spend, martial law counted. Rule: 8.4.2. */
  supporterCost: number
  /** Rule: 8.4.2.II.a Martial Law — three or more warriors of one other player. */
  martialLaw: boolean
  affordable: boolean
}

export type RevoltTarget = {
  clearing: ClearingId
  suit: Suit
  supporterCost: number
  affordable: boolean
}

export type SympathyForecast = {
  sympatheticClearings: ClearingId[]
  /** Sympathy tokens still on the faction board. */
  tokensLeftOnBoard: number
  /** Base cost of the next token; null when none is left. */
  nextTokenCost: number | null
  nextTokenVictoryPoints: number
  /** Supporters that pay in a clearing of each suit: bird cards count for all. */
  matchingSupportersBySuit: Record<Suit, number>
  supporterCount: number
  /** Most supporters the stack holds; null when a base is on the map. */
  supporterLimit: number | null
  /** Clearings a token may go to now, by the placement rules. */
  spreadTargets: SympathyTarget[]
  /** Sympathetic clearings whose base is still on the faction board. */
  revoltTargets: RevoltTarget[]
  basesLeftOnBoard: Suit[]
  officers: number
  warriorsInSupply: number
}

/**
 * Where the Alliance can spread sympathy or revolt as the map stands, and
 * whether the supporters pay for it. Reads the supporters: own seat only.
 */
export function forecastSympathy(state: GameState, seat: Seat): SympathyForecast {
  const board = boardOf(state, seat)
  const countMatching = (suit: Suit): number =>
    matchingSupporterCombinations(board, suit, SINGLE_SUPPORTER).length
  const canPay = (suit: Suit, cost: number): boolean =>
    countMatching(suit) >= cost
  const sympathetic = sympatheticClearings(state, seat)
  const nextTokenCost = nextSympathyCost(board)
  const spreadTargets: SympathyTarget[] =
    nextTokenCost === null
      ? []
      : FALL.clearings
          .filter((clearing): boolean =>
            isLegalSympathySpreadClearing(state, seat, clearing.id),
          )
          .map((clearing): SympathyTarget => {
            const surcharge = martialLawSurcharge(state, clearing.id, seat)
            const supporterCost = nextTokenCost + surcharge
            return {
              clearing: clearing.id,
              suit: clearing.suit,
              supporterCost,
              martialLaw: surcharge > 0,
              affordable: canPay(clearing.suit, supporterCost),
            }
          })
  return {
    sympatheticClearings: sympathetic,
    tokensLeftOnBoard: board.sympathyTrack.placed,
    nextTokenCost,
    nextTokenVictoryPoints: nextSympathyVictoryPoints(board),
    matchingSupportersBySuit: {
      fox: countMatching('fox'),
      rabbit: countMatching('rabbit'),
      mouse: countMatching('mouse'),
    },
    supporterCount: board.supporters.length,
    supporterLimit: supportersCapacity(board),
    spreadTargets,
    revoltTargets: sympathetic
      .map((clearing: ClearingId): RevoltTarget => {
        const suit: Suit = FALL.clearings[clearing]!.suit
        return {
          clearing,
          suit,
          supporterCost: REVOLT_SUPPORTER_COST,
          affordable: canPay(suit, REVOLT_SUPPORTER_COST),
        }
      })
      .filter(
        (target: RevoltTarget): boolean =>
          board.bases.includes(target.suit) &&
          canPlaceBaseAfterRevolt(state, target.clearing, seat),
      ),
    basesLeftOnBoard: SUITS.filter((suit: Suit): boolean =>
      board.bases.includes(suit),
    ),
    officers: board.officers,
    warriorsInSupply: board.supply.warriors,
  }
}
