import type { Action } from '../actions/types.js'
import type { Event } from '../events/types.js'
import type { ClearingId } from '../map/types.js'
import type { FactionId, Piece, Seat } from '../pieces/types.js'
import type { Phase } from '../state/types.js'

export type LogEntry =
  | { t: 'join'; playerId: string; faction: FactionId }
  | { t: 'start' }
  | { t: 'action'; actor: Seat; action: Action }
  | { t: 'vp'; actor: Seat; delta: number; reason: string }
  | {
      t: 'pieces'
      clearing: ClearingId
      placed?: Piece[]
      removed?: Piece[]
    }
  | { t: 'phase'; actor: Seat; phase: Phase; step: string }
  | { t: 'event'; event: Event }
  | { t: 'win'; winner: Seat }
