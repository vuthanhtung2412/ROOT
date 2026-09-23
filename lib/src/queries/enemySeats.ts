import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'

/**
 * Rule: Battle 4.3 — enemy defender = any enemy piece in clearing
 * (warrior, pawn, building, or token). Building/token-only = defenseless.
 */
export function enemySeatsInClearing(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
): Seat[] {
  const enemies = new Set<Seat>()
  for (const piece of state.clearings[clearing]!.pieces) {
    if (piece.owner !== seat) {
      enemies.add(piece.owner)
    }
  }
  return [...enemies]
}
