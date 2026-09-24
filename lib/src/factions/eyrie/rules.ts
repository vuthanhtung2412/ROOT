import type { Card } from '#cards/types.js'
import { matchesSuit } from '#cards/suit.js'
import type { ClearingId } from '#map/types.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { playerOf } from '#queries/seat.js'
import { openSlots } from '#queries/slots.js'
import { RuleError } from '#rules/RuleError.js'
import {
  EYRIE_ROOST_DRAW_BONUS_THRESHOLDS,
  type EyrieBoard,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'

export function boardOf(state: GameState, seat: Seat): EyrieBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'eyrie') throw new RuleError('NOT_EYRIE', { seat })
  return board
}

export function roostClearings(state: GameState, seat: Seat): ClearingId[] {
  const clearings: ClearingId[] = []
  for (let clearing = 0; clearing < state.clearings.length; clearing++) {
    if (
      state.clearings[clearing]!.pieces.some(
        (piece) =>
          piece.kind === 'building' &&
          piece.type === 'roost' &&
          piece.owner === seat,
      )
    ) {
      clearings.push(clearing)
    }
  }
  return clearings
}

export function roostsOnMap(state: GameState, seat: Seat): number {
  let count = 0
  for (const clearing of state.clearings) {
    for (const piece of clearing.pieces) {
      if (
        piece.kind === 'building' &&
        piece.type === 'roost' &&
        piece.owner === seat
      ) {
        count += 1
      }
    }
  }
  return count
}

export function cardMatchesClearing(
  card: Card,
  clearing: ClearingId,
): boolean {
  return matchesSuit(card, FALL.clearings[clearing]!.suit)
}

function warriorCount(state: GameState, clearing: ClearingId): number {
  return state.clearings[clearing]!.pieces.filter(
    (piece) => piece.kind === 'warrior',
  ).length
}

export function fewestWarriorClearings(
  state: GameState,
  seat: Seat,
): ClearingId[] {
  const candidates: ClearingId[] = []
  for (let clearing = 0; clearing < state.clearings.length; clearing++) {
    if (!canPlace(state, seat, clearing)) continue
    if (openSlots(state, clearing) < 1) continue
    if (boardOf(state, seat).roostTrack.placed < 1) continue
    candidates.push(clearing)
  }
  if (candidates.length === 0) return []

  let minimumWarriors = Infinity
  for (const clearing of candidates) {
    minimumWarriors = Math.min(
      minimumWarriors,
      warriorCount(state, clearing),
    )
  }
  return candidates.filter(
    (clearing) => warriorCount(state, clearing) === minimumWarriors,
  )
}

export function eveningDrawBonus(roostCount: number): number {
  let bonus = 0
  for (const threshold of EYRIE_ROOST_DRAW_BONUS_THRESHOLDS) {
    if (roostCount >= threshold) bonus += 1
  }
  return bonus
}
