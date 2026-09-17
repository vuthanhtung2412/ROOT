import type { RuleHooks } from '../triggers/hooks.js'
import type { ClearingId } from '../map/types.js'
import type { Piece, Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'

export function piecesIn(state: GameState, clearing: ClearingId): Piece[] {
  return state.clearings[clearing]?.pieces ?? []
}

export function warriors(state: GameState, clearing: ClearingId, seat: Seat): number {
  return piecesIn(state, clearing).filter(
    (p) => p.kind === 'warrior' && p.owner === seat,
  ).length
}

export function buildings(state: GameState, clearing: ClearingId, seat: Seat): number {
  return piecesIn(state, clearing).filter(
    (p) => p.kind === 'building' && p.owner === seat,
  ).length
}

/** Rule: Board > Rule — warriors + buildings count; tokens/pawns base 0 unless hook boosts tokens. */
export function ruleWeightForPiece(
  state: GameState,
  piece: Piece,
  hooks: RuleHooks,
): number {
  const weight = hooks.ruleWeight(state, piece)
  if (piece.kind === 'pawn') return 0
  if (piece.kind === 'token') return weight > 1 ? weight : 0
  return weight
}

export function ruleStrength(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
  hooks: RuleHooks,
): number {
  let total = 0
  for (const piece of piecesIn(state, clearing)) {
    if (piece.owner !== seat) continue
    total += ruleWeightForPiece(state, piece, hooks)
  }
  return total
}
