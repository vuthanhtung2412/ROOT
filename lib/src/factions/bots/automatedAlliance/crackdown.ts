import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { AUTOMATED_ALLIANCE_SYMPATHY_TOKENS } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

export type BaseRemoval = {
  seat: Seat
  clearing: ClearingId
}

function isSympathyOf(seat: Seat): (piece: Piece) => boolean {
  return (piece: Piece): boolean =>
    piece.owner === seat && piece.kind === 'token' && piece.type === 'sympathy'
}

/**
 * The removed base goes back to the Bases box. Rule: Rootbotics 6.2.4
 * Crackdown — every sympathy token in clearings of the base's suit is
 * removed too (back on the Sympathy track, no points for anyone).
 */
export function applyCrackdown(state: GameState, removal: BaseRemoval): LogEntry[] {
  const board = automatedAllianceBoardOf(state, removal.seat)
  const suit = FALL.clearings[removal.clearing]!.suit
  if (!board.bases.includes(suit)) board.bases = [...board.bases, suit]
  const isSympathy = isSympathyOf(removal.seat)
  const logs: LogEntry[] = []
  for (const clearing of FALL.clearings) {
    if (clearing.suit !== suit) continue
    const clearingState = state.clearings[clearing.id]!
    const tokens: Piece[] = clearingState.pieces.filter(isSympathy)
    if (tokens.length === 0) continue
    clearingState.pieces = clearingState.pieces.filter(
      (piece: Piece): boolean => !isSympathy(piece),
    )
    board.sympathyTrack.placed = Math.min(
      AUTOMATED_ALLIANCE_SYMPATHY_TOKENS,
      board.sympathyTrack.placed + tokens.length,
    )
    logs.push({ t: 'pieces', clearing: clearing.id, removed: tokens })
  }
  return logs
}
