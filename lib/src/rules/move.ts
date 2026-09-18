import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { ClearingId } from '../map/types.js'
import type { Seat } from '../pieces/types.js'
import { canMove } from '../queries/move.js'
import { warriors } from '../queries/pieces.js'
import type { GameState } from '../state/types.js'
import { RuleError } from './RuleError.js'

export type WarriorMovement = {
  seat: Seat
  from: ClearingId
  to: ClearingId
  count: number
}

/** Rule: Move 1–3 — move count warriors from one clearing to an adjacent clearing. */
export function moveWarriors(
  state: GameState,
  movement: WarriorMovement,
  ctx: Ctx,
): LogEntry[] {
  const { seat, from, to, count } = movement
  if (count < 1) throw new RuleError('INVALID_MOVE_COUNT', { count })

  const available = warriors(state, from, seat)
  if (count > available) {
    throw new RuleError('NOT_ENOUGH_WARRIORS', { from, count, available })
  }
  if (!canMove(state, { seat, from, to }, ctx.hooks)) {
    throw new RuleError('CANNOT_MOVE', { from, to })
  }

  const fromClearing = state.clearings[from]!
  const toClearing = state.clearings[to]!
  const moved: typeof fromClearing.pieces = []

  fromClearing.pieces = fromClearing.pieces.filter((piece) => {
    if (moved.length >= count) return true
    if (piece.kind === 'warrior' && piece.owner === seat) {
      moved.push(piece)
      return false
    }
    return true
  })

  toClearing.pieces.push(...moved)
  ctx.emit({ s: 'move', actor: seat, from, to, count })

  return [
    { t: 'pieces', clearing: from, removed: moved },
    { t: 'pieces', clearing: to, placed: moved },
  ]
}
