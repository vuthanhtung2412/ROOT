import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { FactionId, Seat } from '#pieces/types.js'
import type { GameState, PlayerState } from '#state/types.js'

function factionAtSeat(state: GameState, seat: Seat): FactionId | null {
  const player = state.players.find(
    (entry: PlayerState): boolean => entry.seat === seat,
  )
  return player?.faction ?? null
}

/** Rule: 11.2.2 Swimmers — the Riverfolk treat rivers as paths. */
export function treatsRiversAsPaths(state: GameState, seat: Seat): boolean {
  return factionAtSeat(state, seat) === 'riverfolk'
}

/**
 * Rule: 11.2.2 Swimmers — the Riverfolk move along rivers regardless of who
 * rules the origin or destination clearing.
 */
export function swimsAlongRiver(
  state: GameState,
  seat: Seat,
  from: ClearingId,
  to: ClearingId,
): boolean {
  return (
    factionAtSeat(state, seat) === 'riverfolk' && FALL.isRiverAdjacent(from, to)
  )
}
