import type { ClearingId } from '../map/types.js'
import type { BuildingType, Seat } from '../pieces/types.js'

export type MarchMove = {
  from: ClearingId
  to: ClearingId
  count: number
}

export type Action =
  | { type: 'join'; playerId: string }
  | { type: 'start' }
  | { type: 'birdsongWood' }
  | { type: 'eveningDraw' }
  | { type: 'endPhase' }
  | { type: 'spendBird'; cardId: string }
  | { type: 'recruit' }
  | { type: 'march'; moves: MarchMove[] }
  | { type: 'build'; clearing: ClearingId; building: BuildingType }
  | { type: 'overwork'; clearing: ClearingId; cardId: string }
  | { type: 'craft'; cardId: string }
  | { type: 'battle'; clearing: ClearingId; defender: Seat }
  | { type: 'discard'; cardIds: string[] }
  | {
      type: 'resolveEvent'
      order?: Seat[]
      pieceIds?: string[]
      cardId?: string
      decline?: boolean
    }

export type ActionSpec = {
  type: string
  actor: Seat
  params?: Record<string, unknown[]>
}

export type ActionResult = {
  state: import('../state/types.js').GameState
  log: import('../log/types.js').LogEntry[]
}
