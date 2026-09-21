import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { ClearingId } from '../map/types.js'
import type { Piece, Seat } from '../pieces/types.js'
import { hasKeep } from '../queries/place.js'
import { playerOf } from '../queries/seat.js'
import type { GameState } from '../state/types.js'

export type PieceRemoval = {
  clearing: ClearingId
  pieceIds: string[]
  scorer?: Seat
  options?: { skipFieldHospital?: boolean; fromBattle?: boolean }
}

export function returnWarriorsToSupply(state: GameState, seat: Seat, count: number): void {
  if (count <= 0) return
  const board = playerOf(state, seat).board
  if (board.kind === 'marquise') {
    board.supply.warriors += count
  } else if (board.kind === 'eyrie') {
    board.supply.warriors += count
  } else if (board.kind === 'alliance') {
    board.supply.warriors += count
  }
}

function returnPieceToOwner(state: GameState, piece: Piece): void {
  const board = playerOf(state, piece.owner).board
  // Rule: Glossary > Return — supply, or rightmost empty track space.
  if (piece.kind === 'warrior') {
    returnWarriorsToSupply(state, piece.owner, 1)
    return
  }
  if (piece.kind === 'token' && piece.type === 'wood' && board.kind === 'marquise') {
    board.supply.wood += 1
    return
  }
  if (piece.kind === 'token' && piece.type === 'keep') {
    // Rule: Marquise > The Keep — token never returns to supply.
    return
  }
  if (piece.kind === 'building' && board.kind === 'marquise') {
    const type = piece.type
    if (type === 'sawmill' || type === 'workshop' || type === 'recruiter') {
      board.tracks[type].placed = Math.min(5, board.tracks[type].placed + 1)
    }
  }
  if (piece.kind === 'building' && piece.type === 'roost' && board.kind === 'eyrie') {
    // Rule: Eyrie — destroyed roosts return to rightmost empty track space.
    board.roostTrack.placed = Math.min(6, board.roostTrack.placed + 1)
  }
}

/** Rule: Victory — +1 VP per enemy building/token removed. */
export function removePieces(
  state: GameState,
  removal: PieceRemoval,
  ctx?: Ctx,
): LogEntry[] {
  const { clearing, pieceIds, scorer, options } = removal
  const clearingState = state.clearings[clearing]
  if (!clearingState) return []

  const actor = scorer ?? state.currentSeat
  const idSet = new Set(pieceIds)
  const removed: Piece[] = []
  const logs: LogEntry[] = []

  clearingState.pieces = clearingState.pieces.filter((piece) => {
    if (!idSet.has(piece.id)) return true
    removed.push(piece)
    return false
  })

  let victoryPointsDelta = 0
  const victims = new Map<Seat, number>()

  for (const piece of removed) {
    if (piece.kind === 'warrior') {
      victims.set(piece.owner, (victims.get(piece.owner) ?? 0) + 1)
    } else {
      returnPieceToOwner(state, piece)
    }
    if (piece.owner === actor) continue
    if (piece.kind === 'building' || piece.kind === 'token') {
      if (piece.kind === 'token' && piece.type === 'keep') {
        // Rule: Marquise > The Keep — token never returns to supply.
        victoryPointsDelta += 1
        continue
      }
      victoryPointsDelta += 1
    }
  }

  if (victoryPointsDelta > 0) {
    playerOf(state, actor).vp += victoryPointsDelta
    logs.push({
      t: 'vp',
      actor,
      delta: victoryPointsDelta,
      reason: 'removed building/token',
    })
    ctx?.emit({ s: 'vp', actor, delta: victoryPointsDelta })

    // Rule: 7.8.4 Despot — in battle, ≥1 enemy building/token → +1 extra VP.
    if (options?.fromBattle === true) {
      const board = playerOf(state, actor).board
      if (board.kind === 'eyrie' && board.leader === 'despot') {
        playerOf(state, actor).vp += 1
        logs.push({ t: 'vp', actor, delta: 1, reason: 'despot' })
        ctx?.emit({ s: 'vp', actor, delta: 1 })
      }
    }
  }

  for (const [victim, count] of victims) {
    if (count <= 0) continue
    const faction = playerOf(state, victim).faction
    ctx?.emit({
      s: 'warriors.removed',
      faction,
      clearing,
      count,
      toSupply: !hasKeep(state, victim) || options?.skipFieldHospital === true,
    })

    if (options?.skipFieldHospital || !hasKeep(state, victim)) {
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
