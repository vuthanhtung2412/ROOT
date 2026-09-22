import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { BattleEvent } from '#events/types.js'
import type { GameMap } from '#map/GameMap.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

export type RuleHooks = {
  isAdjacent: (state: GameState, seat: Seat, a: ClearingId, b: ClearingId) => boolean
  ruleWeight: (state: GameState, piece: Piece) => number
  needsRuleToMove: (state: GameState, seat: Seat) => boolean
  extraHits: (
    state: GameState,
    event: BattleEvent,
    side: 'attacker' | 'defender',
  ) => number
  craftVp: (state: GameState, seat: Seat, card: Card) => number
}

/** Base hooks before card-effect overrides. */
export function defaultRuleHooks(map: GameMap): RuleHooks {
  return {
    isAdjacent: (_state, _seat, a, b) => map.isAdjacent(a, b),
    ruleWeight: (_state, piece) => (piece.kind === 'token' ? 0 : 1),
    needsRuleToMove: () => true,
    extraHits: () => 0,
    craftVp(state, seat, card) {
      const printed = defOf(card).vp ?? 0
      const player = state.players.find((p) => p.seat === seat)
      if (!player || player.faction !== 'eyrie') return printed
      if (defOf(card).type !== 'item') return printed
      const board = playerOf(state, seat).board
      // Rule: 7.2.3 Disdain — item → 1 VP; 7.8.1 Builder ignores Disdain.
      if (board.kind === 'eyrie' && board.leader !== 'builder') return 1
      return printed
    },
  }
}
