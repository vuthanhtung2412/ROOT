import type { RuleHooks } from '../triggers/hooks.js'
import type { ClearingId } from '../map/types.js'
import type { Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'
import { warriors } from './pieces.js'
import { rules } from './ruler.js'

export type MovePath = {
  seat: Seat
  from: ClearingId
  to: ClearingId
}

/** Rule: Move 1–3 — >0 movers; adjacent; rule origin or destination unless hook waives. */
export function canMove(state: GameState, path: MovePath, hooks: RuleHooks): boolean {
  const { seat, from, to } = path
  const movers = warriors(state, from, seat)
  if (movers < 1) return false

  if (!hooks.isAdjacent(state, seat, from, to)) return false

  if (!hooks.needsRuleToMove(state, seat)) return true
  return rules(state, from, seat, hooks) || rules(state, to, seat, hooks)
}
