import type { ActionOption } from '#actions/options.js'
import { riverfolkBoardOf } from '#factions/riverfolk/rules.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import {
  RIVERFOLK_SERVICE_COSTS,
  RIVERFOLK_STARTING_PAYMENTS,
  type RiverfolkServiceCosts,
} from '#state/riverfolkBoard.js'
import type { GameState } from '#state/types.js'

/** Rule: 11.3.4 — three warriors in the Payments box. */
export function placeRiverfolkSetup(state: GameState, seat: Seat): void {
  const board = riverfolkBoardOf(state, seat)
  board.supply.warriors -= RIVERFOLK_STARTING_PAYMENTS
  for (let warrior = 0; warrior < RIVERFOLK_STARTING_PAYMENTS; warrior++) {
    board.payments.push(seat)
  }
}

/** Rule: 11.3.2 — clearings touching the river (the keep blocks placement). */
export function legalRiverfolkStartClearings(
  state: GameState,
  seat: Seat,
): ClearingId[] {
  return FALL.riverClearings().filter((clearing: ClearingId): boolean =>
    canPlace(state, seat, clearing),
  )
}

/** Rule: 11.3.2 — one of the four starting warriors. */
export function placeRiverfolkStartingWarrior(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
): void {
  if (!legalRiverfolkStartClearings(state, seat).includes(clearing)) {
    throw new RuleError('NOT_RIVER_CLEARING', { clearing })
  }
  placeUpTo(state, {
    seat,
    clearing,
    spec: { kind: 'warrior' },
    count: 1,
  })
}

export function isServiceCost(cost: number): boolean {
  return RIVERFOLK_SERVICE_COSTS.some(
    (candidate: number): boolean => candidate === cost,
  )
}

/**
 * Rule: 11.3.5, 11.6.2 — each marker may stand on any space of its track.
 * One option per combination, so a single action sets all three services.
 */
export function serviceCostOptions(): ActionOption[] {
  const options: ActionOption[] = []
  for (const handCard of RIVERFOLK_SERVICE_COSTS) {
    for (const riverboats of RIVERFOLK_SERVICE_COSTS) {
      for (const mercenaries of RIVERFOLK_SERVICE_COSTS) {
        options.push({ handCard, riverboats, mercenaries })
      }
    }
  }
  return options
}

/** Rule: 11.3.5 — place each service marker on any space of its track. */
export function setStartingServiceCosts(
  state: GameState,
  seat: Seat,
  costs: RiverfolkServiceCosts,
): void {
  for (const cost of Object.values(costs)) {
    if (!isServiceCost(cost)) {
      throw new RuleError('ILLEGAL_SERVICE_COST', { cost })
    }
  }
  riverfolkBoardOf(state, seat).serviceCosts = { ...costs }
}
