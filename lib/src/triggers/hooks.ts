import { defOf } from '../cards/Deck.js'
import type { Card } from '../cards/types.js'
import type { BattleEvent } from '../events/types.js'
import type { GameMap } from '../map/GameMap.js'
import type { ClearingId } from '../map/types.js'
import type { FactionId, Piece, Seat } from '../pieces/types.js'
import type { GameState } from '../state/types.js'

export type RuleHooks = {
  isAdjacent: (
    state: GameState,
    a: ClearingId,
    b: ClearingId,
    faction: FactionId,
  ) => boolean
  ruleWeight: (state: GameState, piece: Piece, faction: FactionId) => number
  needsRuleToMove: (state: GameState, faction: FactionId) => boolean
  extraHits: (
    state: GameState,
    ev: BattleEvent,
    side: 'attacker' | 'defender',
  ) => number
  craftVp: (state: GameState, seat: Seat, card: Card) => number
}

/** Base hooks before card-effect overrides. */
export function defaultRuleHooks(map: GameMap): RuleHooks {
  return {
    isAdjacent: (_state, a, b, _faction) => map.isAdjacent(a, b),
    ruleWeight: (_state, _piece, _faction) => 1,
    needsRuleToMove: () => true,
    extraHits: () => 0,
    craftVp: (_state, _seat, card) => defOf(card).vp ?? 0,
  }
}
