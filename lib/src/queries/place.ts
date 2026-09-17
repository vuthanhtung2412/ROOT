import type { ClearingId } from '../map/types.js'
import type { Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'

/** Rule: Marquise > The Keep — only keep owner may place; move-in / battle / rule unaffected. */
export function canPlace(state: GameState, seat: Seat, clearing: ClearingId): boolean {
  const cs = state.clearings[clearing]
  if (!cs) return false

  const keep = cs.pieces.find((p) => p.kind === 'token' && p.type === 'keep')
  if (!keep) return true
  return keep.owner === seat
}

export function keepOwner(state: GameState, clearing: ClearingId): Seat | null {
  const cs = state.clearings[clearing]
  if (!cs) return null
  const keep = cs.pieces.find((p) => p.kind === 'token' && p.type === 'keep')
  return keep?.owner ?? null
}

export function keepClearingFor(state: GameState, seat: Seat): ClearingId | null {
  for (let id = 0; id < state.clearings.length; id++) {
    if (keepOwner(state, id as ClearingId) === seat) return id as ClearingId
  }
  return null
}

export function hasKeep(state: GameState, seat: Seat): boolean {
  return keepClearingFor(state, seat) !== null
}
