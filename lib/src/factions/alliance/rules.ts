import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import {
  ALLIANCE_SUPPORTERS_CAP_WITHOUT_BASE,
  ALLIANCE_SYMPATHY_COST,
  ALLIANCE_SYMPATHY_TRACK_SIZE,
  ALLIANCE_SYMPATHY_VP,
  type AllianceBoard,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { RuleError } from '#rules/RuleError.js'

export function boardOf(state: GameState, seat: Seat): AllianceBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'alliance') {
    throw new RuleError('NOT_ALLIANCE', { seat })
  }
  return board
}

export function allianceSeat(state: GameState): Seat | null {
  const player = state.players.find((entry) => entry.faction === 'alliance')
  return player?.seat ?? null
}

/** Tokens already placed on the map (0..10). */
export function sympathyTokensPlaced(board: AllianceBoard): number {
  return ALLIANCE_SYMPATHY_TRACK_SIZE - board.sympathyTrack.placed
}

export function nextSympathyCost(board: AllianceBoard): number | null {
  if (board.sympathyTrack.placed <= 0) return null
  const index = sympathyTokensPlaced(board)
  return ALLIANCE_SYMPATHY_COST[index] ?? null
}

export function nextSympathyVictoryPoints(board: AllianceBoard): number {
  const index = sympathyTokensPlaced(board)
  return ALLIANCE_SYMPATHY_VP[index] ?? 0
}

export function hasAnyBaseOnMap(board: AllianceBoard): boolean {
  // Setup starts with 3 bases on the faction board; revolt removes one suit.
  return board.bases.length < ALLIANCE_BASE_COUNT_START
}

const ALLIANCE_BASE_COUNT_START = 3

export function supportersCapacity(board: AllianceBoard): number | null {
  // Rule: Alliance — no base on map → max 5; any base → unlimited.
  return hasAnyBaseOnMap(board) ? null : ALLIANCE_SUPPORTERS_CAP_WITHOUT_BASE
}

export function discardSupportersOverflow(board: AllianceBoard): Card[] {
  const capacity = supportersCapacity(board)
  if (capacity === null || board.supporters.length <= capacity) {
    return []
  }
  const overflow = board.supporters.splice(capacity)
  return overflow
}

export function addSupporter(board: AllianceBoard, card: Card): Card[] {
  board.supporters.push(card)
  return discardSupportersOverflow(board)
}

export function clearingHasSympathy(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
): boolean {
  return (
    state.clearings[clearing]?.pieces.some(
      (piece) =>
        piece.kind === 'token' &&
        piece.type === 'sympathy' &&
        piece.owner === seat,
    ) ?? false
  )
}

export function sympatheticClearings(state: GameState, seat: Seat): ClearingId[] {
  const result: ClearingId[] = []
  for (let clearing = 0; clearing < state.clearings.length; clearing++) {
    if (clearingHasSympathy(state, clearing, seat)) {
      result.push(clearing)
    }
  }
  return result
}

export function sympatheticOfSuit(
  state: GameState,
  seat: Seat,
  suit: Suit,
): number {
  let count = 0
  for (const clearing of sympatheticClearings(state, seat)) {
    if (FALL.clearings[clearing]?.suit === suit) {
      count += 1
    }
  }
  return count
}

/** Martial Law: +1 cost if target has ≥3 warriors of one other player. */
export function martialLawSurcharge(
  state: GameState,
  clearing: ClearingId,
  allianceSeatId: Seat,
): number {
  const bySeat = new Map<Seat, number>()
  for (const player of state.players) {
    if (player.seat === allianceSeatId) continue
    const count = warriors(state, clearing, player.seat)
    if (count >= 3) {
      bySeat.set(player.seat, count)
    }
  }
  return bySeat.size > 0 ? 1 : 0
}

export function pickSupportersOfSuit(
  board: AllianceBoard,
  suit: Suit,
  count: number,
): Card[] | null {
  const matching = board.supporters.filter((card) => {
    const cardSuit = defOf(card).suit
    return cardSuit === suit || cardSuit === 'bird'
  })
  if (matching.length < count) return null
  return matching.slice(0, count)
}

export function removeSupportersByIds(
  board: AllianceBoard,
  supporterIds: string[],
): Card[] {
  const removed: Card[] = []
  for (const supporterId of supporterIds) {
    const index = board.supporters.findIndex((card) => card.id === supporterId)
    if (index < 0) {
      throw new RuleError('SUPPORTER_NOT_FOUND', { supporterId })
    }
    removed.push(board.supporters.splice(index, 1)[0]!)
  }
  return removed
}
