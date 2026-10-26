import type { CardSuit } from '#cards/types.js'
import { clearingHasSympathy, sympatheticClearings } from '#factions/alliance/rules.js'
import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import { enemyPieceCount, isEnemyOfBot } from '#factions/bots/botQueries.js'
import { orderSuitOf, orderedClearings } from '#factions/bots/orderCard.js'
import {
  byFewest,
  byHighestPriority,
  inTargetOrder,
} from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { piecesIn, warriors } from '#queries/pieces.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { placeUpTo } from '#rules/place.js'
import {
  AUTOMATED_ALLIANCE_SYMPATHY_TOKENS,
  AUTOMATED_ALLIANCE_SYMPATHY_VICTORY_POINTS,
} from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 6.5.1.II — no token could be placed: score five points. */
const CANNOT_SPREAD_VICTORY_POINTS = 5
/** Rule: Rootbotics 6.2.5 — three or more warriors of one enemy. */
const MARTIAL_LAW_WARRIORS = 3
/** Rule: Rootbotics 6.2.5 — one fewer point. */
const MARTIAL_LAW_PENALTY = 1

export type SympathySpread = {
  seat: Seat
  /** Trait Wildfire — the token scores nothing. */
  scores: boolean
}

export function sympathyTokensOnMap(state: GameState, seat: Seat): number {
  return (
    AUTOMATED_ALLIANCE_SYMPATHY_TOKENS -
    automatedAllianceBoardOf(state, seat).sympathyTrack.placed
  )
}

function enemyWarriorCount(state: GameState, clearing: ClearingId, seat: Seat): number {
  return piecesIn(state, clearing).filter(
    (piece: Piece): boolean =>
      piece.kind === 'warrior' && isEnemyOfBot(state, seat, piece.owner),
  ).length
}

/** Rule: Rootbotics 6.2.1.I / 6.2.5 — one token per clearing; no token in an enemy keep. */
function canHoldSympathy(state: GameState, seat: Seat, clearing: ClearingId): boolean {
  return !clearingHasSympathy(state, clearing, seat) && canPlace(state, seat, clearing)
}

/**
 * Rule: Rootbotics 6.5.1 — an ordered unsympathetic clearing adjacent to a
 * sympathetic clearing, fewest enemy warriors; 6.5.1.I — else the clearing
 * with the fewest enemy pieces. Ties: highest priority (2.1).
 */
export function spreadTarget(
  state: GameState,
  spread: { seat: Seat; suit: CardSuit },
): ClearingId | null {
  const { seat, suit } = spread
  const sympathetic = sympatheticClearings(state, seat)
  const adjacentOrdered = orderedClearings(suit).filter(
    (clearing: ClearingId): boolean =>
      canHoldSympathy(state, seat, clearing) &&
      sympathetic.some((origin: ClearingId): boolean => FALL.adjacent(origin).includes(clearing)),
  )
  if (adjacentOrdered.length > 0) {
    return (
      inTargetOrder(adjacentOrdered, [
        byFewest((clearing: ClearingId): number => enemyWarriorCount(state, clearing, seat)),
        byHighestPriority,
      ])[0] ?? null
    )
  }
  const anyClearing = FALL.clearings
    .map((clearing): ClearingId => clearing.id)
    .filter((clearing: ClearingId): boolean => canHoldSympathy(state, seat, clearing))
  return (
    inTargetOrder(anyClearing, [
      byFewest((clearing: ClearingId): number => enemyPieceCount(state, clearing, seat)),
      byHighestPriority,
    ])[0] ?? null
  )
}

/** Rule: Rootbotics 6.2.5 Martial Law — three or more warriors of one enemy there. */
export function isUnderMartialLaw(state: GameState, clearing: ClearingId, seat: Seat): boolean {
  return state.players.some(
    (enemy): boolean =>
      isEnemyOfBot(state, seat, enemy.seat) &&
      warriors(state, clearing, enemy.seat) >= MARTIAL_LAW_WARRIORS,
  )
}

function scoreSympathy(
  state: GameState,
  placement: { seat: Seat; clearing: ClearingId; points: number },
  ctx: Ctx,
): LogEntry[] {
  const { seat, clearing } = placement
  const penalty = isUnderMartialLaw(state, clearing, seat) ? MARTIAL_LAW_PENALTY : 0
  const scored = addVictoryPoints(state, seat, Math.max(0, placement.points - penalty))
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta: scored })
  return [{ t: 'vp', actor: seat, delta: scored, reason: 'sympathy' }]
}

function scoreCannotSpread(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const scored = addVictoryPoints(state, seat, CANNOT_SPREAD_VICTORY_POINTS)
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta: scored })
  return [{ t: 'vp', actor: seat, delta: scored, reason: 'cannot spread sympathy' }]
}

/**
 * Rule: Rootbotics 6.5.1 Spread Sympathy — place a token and score the space
 * it revealed (Martial Law: one fewer); 6.5.1.II — no token or no clearing: 5 points.
 */
export function spreadSympathy(state: GameState, spread: SympathySpread, ctx: Ctx): LogEntry[] {
  const { seat } = spread
  const board = automatedAllianceBoardOf(state, seat)
  const suit = orderSuitOf(board)
  if (suit === null) return []
  const clearing = board.sympathyTrack.placed > 0 ? spreadTarget(state, { seat, suit }) : null
  if (clearing === null) {
    return spread.scores ? scoreCannotSpread(state, seat, ctx) : []
  }
  const points = AUTOMATED_ALLIANCE_SYMPATHY_VICTORY_POINTS[sympathyTokensOnMap(state, seat)] ?? 0
  placeUpTo(state, { seat, clearing, spec: { kind: 'token', type: 'sympathy' }, count: 1 })
  board.sympathyTrack.placed -= 1
  const logs: LogEntry[] = [
    { t: 'action', actor: seat, action: { type: 'botSpreadSympathy', clearing } },
    { t: 'pieces', clearing, placed: piecesIn(state, clearing).slice(-1) },
  ]
  if (!spread.scores) return logs
  return [...logs, ...scoreSympathy(state, { seat, clearing, points }, ctx)]
}
