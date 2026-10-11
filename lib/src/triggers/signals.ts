import type { BattleEvent } from '#events/types.js'
import type { ClearingId } from '#map/types.js'
import type { FactionId, ItemType, Seat } from '#pieces/types.js'
import type { Phase } from '#state/types.js'

export type GameSignal =
  | { s: 'phase.start'; actor: Seat; phase: Phase }
  | { s: 'phase.end'; actor: Seat; phase: Phase }
  | { s: 'craft.item'; actor: Seat; cardId: string; item: ItemType }
  | { s: 'craft.persistent'; actor: Seat; cardId: string }
  | {
      s: 'warriors.removed'
      victim: Seat
      faction: FactionId
      clearing: ClearingId
      count: number
      toSupply: boolean
      /** Rule: G.1.21 Replace — removed as the first half of a replace. */
      replaced: boolean
    }
  | { s: 'battle.start'; ev: BattleEvent }
  | { s: 'battle.hits'; ev: BattleEvent; side: 'attacker' | 'defender' }
  | { s: 'battle.end'; ev: BattleEvent }
  | { s: 'move'; actor: Seat; from: ClearingId; to: ClearingId; count: number }
  | { s: 'draw'; actor: Seat; count: number }
  | { s: 'vp'; actor: Seat; delta: number }
