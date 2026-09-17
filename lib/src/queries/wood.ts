import type { RuleHooks } from '../triggers/hooks.js'
import type { ClearingId } from '../map/types.js'
import type { Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'
import { connectedRuled } from './connected.js'

/** Rule: Marquise > Build 3 — wood in clearing + ruled connected chain. */
export function woodReachable(
  state: GameState,
  seat: Seat,
  from: ClearingId,
  hooks: RuleHooks,
): number {
  const region = connectedRuled(state, seat, from, hooks)
  let total = 0
  for (const id of region) {
    total += state.clearings[id]!.pieces.filter(
      (p) => p.kind === 'token' && p.type === 'wood' && p.owner === seat,
    ).length
  }
  return total
}
