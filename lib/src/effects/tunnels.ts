import type { CardEffect } from '#triggers/effects.js'
import type { GameState } from '#state/types.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'

const TUNNELS_DEF_ID = 'ROOT-108'

function hasTunnels(state: GameState, seat: Seat): boolean {
  return playerOf(state, seat).playArea.some((playCard) => playCard.defId === TUNNELS_DEF_ID)
}

function isCraftingPiece(piece: Piece): boolean {
  if (piece.kind === 'building' && (piece.type === 'workshop' || piece.type === 'roost')) {
    return true
  }
  if (piece.kind === 'token' && piece.type === 'sympathy') return true
  return false
}

function clearingHasCraftingPiece(state: GameState, seat: Seat, clearingId: ClearingId): boolean {
  for (const piece of state.clearings[clearingId]!.pieces) {
    if (piece.owner === seat && isCraftingPiece(piece)) return true
  }
  return false
}

/** Rule: Cards > Craft — Tunnels: clearings with your crafting pieces are adjacent. */
export const tunnelsEffect: CardEffect = {
  defId: TUNNELS_DEF_ID,
  hooks: {
    isAdjacent(state, seat, fromClearing, toClearing) {
      if (!hasTunnels(state, seat)) return undefined
      if (fromClearing === toClearing) return undefined
      if (!clearingHasCraftingPiece(state, seat, fromClearing)) return undefined
      if (!clearingHasCraftingPiece(state, seat, toClearing)) return undefined
      return true
    },
  },
}
