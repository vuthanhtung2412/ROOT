import type { RuleHooks } from '../triggers/hooks.js'
import type { ClearingId } from '../map/types.js'
import type { Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'
import { rules } from './ruler.js'
import { factionOf } from './seat.js'

/** Clearings connected through a chain of clearings ruled by seat, including from when ruled. */
export function connectedRuled(
  state: GameState,
  seat: Seat,
  from: ClearingId,
  hooks: RuleHooks,
): Set<ClearingId> {
  const out = new Set<ClearingId>()
  if (!rules(state, from, seat, hooks)) return out

  const faction = factionOf(state, seat)
  const queue: ClearingId[] = [from]
  out.add(from)

  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const n of adjacentClearings(state, cur, faction, hooks)) {
      if (out.has(n)) continue
      if (!rules(state, n, seat, hooks)) continue
      out.add(n)
      queue.push(n)
    }
  }

  return out
}

function adjacentClearings(
  state: GameState,
  clearing: ClearingId,
  faction: ReturnType<typeof factionOf>,
  hooks: RuleHooks,
): ClearingId[] {
  const neighbors: ClearingId[] = []
  for (let id = 0; id < state.clearings.length; id++) {
    if (hooks.isAdjacent(state, clearing, id, faction)) neighbors.push(id)
  }
  return neighbors
}
