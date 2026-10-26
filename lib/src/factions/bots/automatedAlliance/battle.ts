import type { BattleEvent } from '#events/types.js'
import { warriors } from '#queries/pieces.js'
import { factionOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 6.2.2 — one extra hit. */
const AUTOMATED_AMBUSH_EXTRA_HITS = 1

/**
 * Rule: Rootbotics 6.2.2 Automated Ambush — as defender with at least one
 * Alliance warrior in the clearing, the Automated Alliance deals an extra hit.
 */
export function automatedAmbushHits(state: GameState, event: BattleEvent): number {
  if (factionOf(state, event.defender) !== 'automatedAlliance') return 0
  if (warriors(state, event.clearing, event.defender) < 1) return 0
  return AUTOMATED_AMBUSH_EXTRA_HITS
}
