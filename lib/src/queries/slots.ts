import { FALL } from '../map/fall.js'
import type { ClearingId } from '../map/types.js'
import type { GameState } from '../state/types.js'

/** Rule: Board > Slots — ruins occupy one slot; no open slot → cannot place building. */
export function openSlots(state: GameState, clearing: ClearingId): number {
  const mapClearing = FALL.clearings[clearing]
  if (!mapClearing) return 0

  const cs = state.clearings[clearing]
  if (!cs) return 0

  const buildings = cs.pieces.filter((p) => p.kind === 'building').length
  const ruinOccupies = cs.ruin !== undefined ? 1 : 0
  return Math.max(0, mapClearing.slots - buildings - ruinOccupies)
}
