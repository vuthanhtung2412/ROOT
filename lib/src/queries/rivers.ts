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

/**
 * Rule: 11.2.2 Swimmers — the Riverfolk treat rivers as paths.
 * Rule: 11.2.7.II Riverboats — so does the buyer until the end of their turn.
 */
export function treatsRiversAsPaths(state: GameState, seat: Seat): boolean {
  if (factionAtSeat(state, seat) === 'riverfolk') return true
  return state.turnScratch.riverboats && seat === state.currentSeat
}

/** Clearings one move away: by path, and by river for seats that use them. */
export function moveNeighbors(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
): ClearingId[] {
  const byPath = FALL.adjacent(clearing)
  if (!treatsRiversAsPaths(state, seat)) return byPath
  const byRiver = FALL.riverClearings().filter(
    (candidate: ClearingId): boolean =>
      FALL.isRiverAdjacent(clearing, candidate) && !byPath.includes(candidate),
  )
  return [...byPath, ...byRiver]
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
