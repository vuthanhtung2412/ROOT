import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { ClearingId } from '../map/types.js'
import type { Piece, Seat } from '../pieces/types.js'
import { hasKeep, keepClearingFor } from '../queries/place.js'
import { playerOf } from '../queries/seat.js'
import type { GameState } from '../state/types.js'
import type { MarquiseBoard } from '../state/boards.js'

export function returnWarriorsToSupply(state: GameState, seat: Seat, count: number): void {
  if (count <= 0) return
  const board = playerOf(state, seat).board
  if (board.kind === 'marquise') {
    ;(board as MarquiseBoard).supply.warriors += count
  } else if (board.kind === 'eyrie') {
    board.supply.warriors += count
  } else if (board.kind === 'alliance') {
    board.supply.warriors += count
  }
}

/** Rule: Victory — +1 VP per enemy building/token removed. */
export function removePieces(
  state: GameState,
  clearing: ClearingId,
  pieceIds: string[],
  scorer?: Seat,
  ctx?: Ctx,
  opts?: { skipFieldHospital?: boolean },
): LogEntry[] {
  const cs = state.clearings[clearing]
  if (!cs) return []

  const actor = scorer ?? state.currentSeat
  const idSet = new Set(pieceIds)
  const removed: Piece[] = []
  const logs: LogEntry[] = []

  cs.pieces = cs.pieces.filter((p) => {
    if (!idSet.has(p.id)) return true
    removed.push(p)
    return false
  })

  let vpDelta = 0
  let warriorCount = 0
  const victims = new Map<Seat, number>()

  for (const piece of removed) {
    if (piece.kind === 'warrior') {
      warriorCount += 1
      victims.set(piece.owner, (victims.get(piece.owner) ?? 0) + 1)
    }
    if (piece.owner === actor) continue
    if (piece.kind === 'building' || piece.kind === 'token') {
      if (piece.kind === 'token' && piece.type === 'keep') {
        // Rule: Marquise > The Keep — token never returns to supply.
        vpDelta += 1
        continue
      }
      vpDelta += 1
    }
  }

  if (vpDelta > 0) {
    playerOf(state, actor).vp += vpDelta
    logs.push({ t: 'vp', actor, delta: vpDelta, reason: 'removed building/token' })
    ctx?.emit({ s: 'vp', actor, delta: vpDelta })
  }

  for (const [victim, count] of victims) {
    if (count <= 0) continue
    const faction = playerOf(state, victim).faction
    ctx?.emit({
      s: 'warriors.removed',
      faction,
      clearing,
      count,
      toSupply: !hasKeep(state, victim) || opts?.skipFieldHospital === true,
    })

    if (opts?.skipFieldHospital || !hasKeep(state, victim)) {
      returnWarriorsToSupply(state, victim, count)
    } else {
      state.pending.push({
        type: 'fieldHospital',
        victim,
        clearing,
        count,
      })
    }
  }

  if (removed.length > 0) {
    logs.push({ t: 'pieces', clearing, removed })
  }

  return logs
}
