import type { LogEntry } from '../log/types.js'
import type { ClearingId } from '../map/types.js'
import type { Piece, Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'
import { playerOf } from '../queries/seat.js'

/** Rule: Victory — +1 VP per enemy building/token removed. */
export function removePieces(
  state: GameState,
  clearing: ClearingId,
  pieceIds: string[],
  scorer?: Seat,
): LogEntry[] {
  const cs = state.clearings[clearing]
  if (!cs) return []

  const actor = scorer ?? state.currentSeat
  const idSet = new Set(pieceIds)
  const removed: Piece[] = []
  const logs: LogEntry[] = []

  cs.pieces = cs.pieces.filter((p) => {
    if (!idSet.has(p.id)) return true
    removed.push(p)
    return false
  })

  let vpDelta = 0
  for (const piece of removed) {
    if (piece.owner === actor) continue
    if (piece.kind === 'building' || piece.kind === 'token') {
      vpDelta += 1
    }
  }

  if (vpDelta > 0) {
    playerOf(state, actor).vp += vpDelta
    logs.push({ t: 'vp', actor, delta: vpDelta, reason: 'removed building/token' })
  }

  if (removed.length > 0) {
    logs.push({ t: 'pieces', clearing, removed })
  }

  return logs
}
