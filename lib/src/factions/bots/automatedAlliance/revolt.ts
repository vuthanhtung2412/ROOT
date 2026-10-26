import type { CardSuit } from '#cards/types.js'
import { sympatheticClearings } from '#factions/alliance/rules.js'
import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import { enemyPieceCount, isEnemyOfBot } from '#factions/bots/botQueries.js'
import { byHighestPriority, byMost, inTargetOrder } from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { keepOwner } from '#queries/place.js'
import { piecesIn } from '#queries/pieces.js'
import { openSlots } from '#queries/slots.js'
import { placeUpTo } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import type { GameState } from '#state/types.js'

export type Revolt = {
  seat: Seat
  clearing: ClearingId
}

function suitOf(clearing: ClearingId): Suit {
  return FALL.clearings[clearing]!.suit
}

function enemyPieces(state: GameState, revolt: Revolt): Piece[] {
  return piecesIn(state, revolt.clearing).filter((piece: Piece): boolean =>
    isEnemyOfBot(state, revolt.seat, piece.owner),
  )
}

/**
 * The base fits once the enemy pieces are gone: a free slot (enemy buildings
 * free theirs) and no keep left of a player it spares (co-op, 3.5.1).
 */
function baseFitsAfterRevolt(state: GameState, revolt: Revolt): boolean {
  const removed = enemyPieces(state, revolt)
  const freedSlots = removed.filter((piece: Piece): boolean => piece.kind === 'building').length
  const keep = keepOwner(state, revolt.clearing)
  const keepStays = keep !== null && keep !== revolt.seat && !isEnemyOfBot(state, revolt.seat, keep)
  return openSlots(state, revolt.clearing) + freedSlots > 0 && !keepStays
}

/**
 * Rule: Rootbotics 6.4.3 / 6.5.2 — a sympathetic clearing whose suit still has
 * its base on the board (only the ordered suit unless bird), with the most
 * enemy pieces; ties highest priority; 2.3 — skip clearings the base cannot fit.
 */
export function revoltTarget(
  state: GameState,
  revolt: { seat: Seat; suit: CardSuit },
): ClearingId | null {
  const { seat, suit } = revolt
  const bases = automatedAllianceBoardOf(state, seat).bases
  const candidates = sympatheticClearings(state, seat).filter(
    (clearing: ClearingId): boolean =>
      bases.includes(suitOf(clearing)) && (suit === 'bird' || suitOf(clearing) === suit),
  )
  const ordered = inTargetOrder(candidates, [
    byMost((clearing: ClearingId): number => enemyPieceCount(state, clearing, seat)),
    byHighestPriority,
  ])
  return (
    ordered.find((clearing: ClearingId): boolean => baseFitsAfterRevolt(state, { seat, clearing })) ??
    null
  )
}

/**
 * Rule: Rootbotics 6.4.3 Revolt — remove all enemy pieces from the clearing
 * (the Alliance scores buildings and tokens), then place the matching base.
 */
export function revolt(state: GameState, target: Revolt, ctx: Ctx): LogEntry[] {
  const { seat, clearing } = target
  const suit = suitOf(clearing)
  const logs: LogEntry[] = [
    { t: 'action', actor: seat, action: { type: 'botRevolt', clearing } },
    ...removePieces(
      state,
      {
        clearing,
        pieceIds: enemyPieces(state, target).map((piece: Piece): string => piece.id),
        scorer: seat,
      },
      ctx,
    ),
  ]
  placeUpTo(state, { seat, clearing, spec: { kind: 'building', type: 'base' }, count: 1 })
  const board = automatedAllianceBoardOf(state, seat)
  board.bases = board.bases.filter((baseSuit: Suit): boolean => baseSuit !== suit)
  logs.push({ t: 'pieces', clearing, placed: piecesIn(state, clearing).slice(-1) })
  return logs
}
