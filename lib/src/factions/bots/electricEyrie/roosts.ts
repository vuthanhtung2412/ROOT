import { Deck, defOf } from '#cards/Deck.js'
import type { Card, CardSuit } from '#cards/types.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { electricEyrieBoardOf } from '#factions/bots/botBoards.js'
import { ruledClearings } from '#factions/bots/botQueries.js'
import { botHasTrait } from '#factions/bots/botSettings.js'
import { hasRoost } from '#factions/bots/electricEyrie/decree.js'
import { orderSuitOf, orderedClearings } from '#factions/bots/orderCard.js'
import { byHighestPriority, inTargetOrder } from '#factions/bots/priority.js'
import { isVizier } from '#factions/eyrie/viziers.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { piecesIn } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { openSlots } from '#queries/slots.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { placeUpTo } from '#rules/place.js'
import {
  ELECTRIC_EYRIE_DECREE_COLUMNS,
  ELECTRIC_EYRIE_ROOST_VICTORY_POINTS,
} from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 5.4.4 — warriors placed with a new roost. */
const NEW_ROOST_WARRIORS = 4

export function roostsOnMap(state: GameState, seat: Seat): number {
  return state.clearings
    .flatMap((clearing): Piece[] => clearing.pieces)
    .filter(
      (piece: Piece): boolean =>
        piece.owner === seat && piece.kind === 'building' && piece.type === 'roost',
    ).length
}

function canPlaceRoost(state: GameState, seat: Seat, clearing: ClearingId): boolean {
  return (
    electricEyrieBoardOf(state, seat).roostTrack.placed > 0 &&
    openSlots(state, clearing) > 0 &&
    canPlace(state, seat, clearing)
  )
}

function placeRoost(state: GameState, seat: Seat, clearing: ClearingId): LogEntry[] {
  placeUpTo(state, { seat, clearing, spec: { kind: 'building', type: 'roost' }, count: 1 })
  electricEyrieBoardOf(state, seat).roostTrack.placed -= 1
  return [
    { t: 'action', actor: seat, action: { type: 'botBuild', clearing, building: 'roost' } },
    { t: 'pieces', clearing, placed: piecesIn(state, clearing).slice(-1) },
  ]
}

/** Rule: Rootbotics 5.4.3 — the order card joins the Decree column of its suit. */
export function addOrderToDecree(state: GameState, seat: Seat): void {
  const board = electricEyrieBoardOf(state, seat)
  const suit = orderSuitOf(board)
  if (board.orderCard === null || suit === null) return
  board.decree[suit].push(board.orderCard)
}

/**
 * Rule: Rootbotics 5.4.4 — no roost on the map: a roost and four warriors in
 * the ordered clearing of highest priority where all of them can be placed.
 */
export function newRoost(state: GameState, seat: Seat): BotTaskResult {
  const board = electricEyrieBoardOf(state, seat)
  const suit = orderSuitOf(board)
  if (suit === null || roostsOnMap(state, seat) > 0) return taskDone()
  if (board.supply.warriors < NEW_ROOST_WARRIORS) return taskDone()
  const clearing = inTargetOrder(orderedClearings(suit), [byHighestPriority]).find(
    (candidate: ClearingId): boolean => canPlaceRoost(state, seat, candidate),
  )
  if (clearing === undefined) return taskDone()
  const logs = placeRoost(state, seat, clearing)
  placeUpTo(state, { seat, clearing, spec: { kind: 'warrior' }, count: NEW_ROOST_WARRIORS })
  return taskDone([
    ...logs,
    {
      t: 'action',
      actor: seat,
      action: { type: 'botRecruit', clearing, count: NEW_ROOST_WARRIORS },
    },
  ])
}

/**
 * Rule: Rootbotics 5.7.1 — lose a point per bird card (viziers too); with
 * Nobility, score a point per bird card instead.
 */
function humiliate(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const board = electricEyrieBoardOf(state, seat)
  const player = playerOf(state, seat)
  const birdCards = ELECTRIC_EYRIE_DECREE_COLUMNS.flatMap(
    (column: CardSuit): Card[] => board.decree[column],
  ).filter((decreeCard: Card): boolean => defOf(decreeCard).suit === 'bird').length
  if (botHasTrait(state, seat, 'nobility')) {
    const scored = addVictoryPoints(state, seat, birdCards)
    if (scored === 0) return []
    ctx.emit({ s: 'vp', actor: seat, delta: scored })
    return [{ t: 'vp', actor: seat, delta: scored, reason: 'turmoil nobility' }]
  }
  // Rule: 7.7.1 — the score track has no space below zero.
  const victoryPointsAfter = Math.max(0, player.vp - birdCards)
  const delta = victoryPointsAfter - player.vp
  player.vp = victoryPointsAfter
  if (delta === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta })
  return [{ t: 'vp', actor: seat, delta, reason: 'turmoil humiliate' }]
}

/**
 * Rule: Rootbotics 5.7 — Turmoil: humiliate, discard the Decree but the
 * viziers, then go to Evening (the rest of Daylight is dropped).
 */
export function turmoil(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const board = electricEyrieBoardOf(state, seat)
  const logs: LogEntry[] = [
    { t: 'action', actor: seat, action: { type: 'botTurmoil' } },
    ...humiliate(state, seat, ctx),
  ]
  const plan = state.turnScratch.botPlan
  if (plan !== null && plan !== undefined) {
    state.turnScratch.botPlan = { ...plan, tasks: [] }
  }
  const viziers: Card[] = []
  for (const column of ELECTRIC_EYRIE_DECREE_COLUMNS) {
    for (const decreeCard of board.decree[column]) {
      if (isVizier(decreeCard)) {
        viziers.push(decreeCard)
        continue
      }
      Deck.discard(state.deck, decreeCard, {
        onDominance: (dominanceCard: Card): void => {
          state.dominanceAvailable.push(dominanceCard)
        },
      })
    }
  }
  board.decree = { fox: [], mouse: [], rabbit: [], bird: viziers }
  return logs
}

/**
 * Rule: Rootbotics 5.5.1.IV — a roost in the ruled clearing of highest
 * priority with no roost; if it cannot, turmoil (5.7).
 */
export function buildRoost(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const clearing = inTargetOrder(ruledClearings(state, seat, ctx), [byHighestPriority]).find(
    (candidate: ClearingId): boolean =>
      !hasRoost(state, candidate, seat) && canPlaceRoost(state, seat, candidate),
  )
  if (clearing === undefined) return taskDone(turmoil(state, seat, ctx))
  return taskDone(placeRoost(state, seat, clearing))
}

/** Rule: Rootbotics 5.6 — points on the rightmost empty space of the Roosts track. */
export function scoreRoosts(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const points = ELECTRIC_EYRIE_ROOST_VICTORY_POINTS[roostsOnMap(state, seat)] ?? 0
  electricEyrieBoardOf(state, seat).orderCard = null
  const scored = addVictoryPoints(state, seat, points)
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta: scored })
  return [{ t: 'vp', actor: seat, delta: scored, reason: 'roosts' }]
}
