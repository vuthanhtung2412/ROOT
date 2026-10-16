import type { CardSuit } from '#cards/types.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { electricEyrieBoardOf } from '#factions/bots/botBoards.js'
import {
  buildingCountOf,
  canBotMove,
  defendersInOrder,
  enemyPieceCount,
  moveBotWarriors,
  pieceCountOf,
  placeBotWarriors,
  ruledClearings,
  startBotBattle,
} from '#factions/bots/botQueries.js'
import { orderedClearings } from '#factions/bots/orderCard.js'
import {
  byFewest,
  byHighestPriority,
  byLowestPriority,
  byMost,
  byMostVictoryPoints,
  bySetupPriority,
  inTargetOrder,
} from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { piecesIn, ruleStrength, warriors } from '#queries/pieces.js'
import { ELECTRIC_EYRIE_DECREE_COLUMNS } from '#state/botBoards.js'
import type { ElectricEyrieTask } from '#state/botTurn.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 5.5.1.III — the longest column deals one extra hit. */
const LONGEST_COLUMN_EXTRA_HITS = 1
/** An empty clearing is ruled by nobody (5.2.1): at least one piece rules it. */
const FEWEST_PIECES_TO_RULE = 1

export function hasRoost(state: GameState, clearing: ClearingId, seat: Seat): boolean {
  return piecesIn(state, clearing).some(
    (piece: Piece): boolean =>
      piece.owner === seat && piece.kind === 'building' && piece.type === 'roost',
  )
}

function columnLength(state: GameState, seat: Seat, column: CardSuit): number {
  return electricEyrieBoardOf(state, seat).decree[column].length
}

/** Rule: Rootbotics 5.5.1 — recruit, then move, then battle for each column, left to right. */
export function decreeTasks(state: GameState, seat: Seat): ElectricEyrieTask[] {
  const columns: CardSuit[] = ELECTRIC_EYRIE_DECREE_COLUMNS.filter(
    (column: CardSuit): boolean => columnLength(state, seat, column) > 0,
  )
  return [
    ...columns.map((column: CardSuit): ElectricEyrieTask => ({ kind: 'decreeRecruit', column })),
    ...columns.map((column: CardSuit): ElectricEyrieTask => ({ kind: 'decreeMove', column })),
    ...columns.map((column: CardSuit): ElectricEyrieTask => ({ kind: 'decreeBattle', column })),
    { kind: 'buildRoost' },
  ]
}

/**
 * Rule: Rootbotics 5.5.1.I — warriors equal to the column's cards in a
 * matching clearing with a roost: most enemy pieces, fewest Eyrie warriors,
 * lowest priority.
 */
export function decreeRecruit(state: GameState, column: CardSuit): BotTaskResult {
  const seat = state.currentSeat
  const candidates = inTargetOrder(
    orderedClearings(column).filter(
      (clearing: ClearingId): boolean =>
        hasRoost(state, clearing, seat) && canPlace(state, seat, clearing),
    ),
    [
      byMost((clearing: ClearingId): number => enemyPieceCount(state, clearing, seat)),
      byFewest((clearing: ClearingId): number => warriors(state, clearing, seat)),
      byLowestPriority,
    ],
  )
  const clearing = candidates[0]
  if (clearing === undefined) return taskDone()
  return taskDone(
    placeBotWarriors(state, { seat, clearing, count: columnLength(state, seat, column) }),
  )
}

/** Warriors that keep the Eyrie ruling the clearing (ties rule, 5.2.1). */
export function warriorsToRule(state: GameState, clearing: ClearingId, ctx: Ctx): number {
  const seat = state.currentSeat
  const strongestEnemy = Math.max(
    0,
    ...state.players
      .filter((player): boolean => player.seat !== seat)
      .map((player): number => ruleStrength(state, clearing, player.seat, ctx.hooks)),
  )
  const ownBuildings = buildingCountOf(state, clearing, seat)
  return Math.max(0, strongestEnemy - ownBuildings, FEWEST_PIECES_TO_RULE - ownBuildings)
}

/** Rule: 5.5.1.II + errata — no roost first; then fewest enemy pieces, lowest priority. */
function destinationsInOrder(state: GameState, origin: ClearingId): ClearingId[] {
  const seat = state.currentSeat
  const adjacent = FALL.adjacent(origin)
  const withoutRoost = adjacent.filter(
    (clearing: ClearingId): boolean => !hasRoost(state, clearing, seat),
  )
  return inTargetOrder(withoutRoost.length > 0 ? withoutRoost : adjacent, [
    byFewest((clearing: ClearingId): number => enemyPieceCount(state, clearing, seat)),
    byLowestPriority,
  ])
}

/**
 * Rule: Rootbotics 5.5.1.II — from the matching ruled clearing with the most
 * Eyrie warriors, leaving enough to rule it or the column's card count.
 */
export function decreeMove(state: GameState, column: CardSuit, ctx: Ctx): BotTaskResult {
  const seat = state.currentSeat
  const ruled = ruledClearings(state, seat, ctx)
  const origins = inTargetOrder(
    orderedClearings(column).filter((clearing: ClearingId): boolean => ruled.includes(clearing)),
    [byMost((clearing: ClearingId): number => warriors(state, clearing, seat)), byHighestPriority],
  )
  for (const origin of origins) {
    const leave = Math.max(warriorsToRule(state, origin, ctx), columnLength(state, seat, column))
    const count = warriors(state, origin, seat) - leave
    if (count < 1) continue
    const destination = destinationsInOrder(state, origin).find(
      (candidate: ClearingId): boolean =>
        canBotMove(state, { seat, from: origin, to: candidate, count }, ctx),
    )
    if (destination === undefined) continue
    return taskDone(moveBotWarriors(state, { seat, from: origin, to: destination, count }, ctx))
  }
  return taskDone()
}

function defenselessBuildingCount(state: GameState, clearing: ClearingId, seat: Seat): number {
  const pieces = piecesIn(state, clearing)
  return pieces.filter(
    (piece: Piece): boolean =>
      piece.kind === 'building' &&
      piece.owner !== seat &&
      !pieces.some(
        (other: Piece): boolean => other.kind === 'warrior' && other.owner === piece.owner,
      ),
  ).length
}

function isLongestColumn(state: GameState, seat: Seat, column: CardSuit): boolean {
  const length = columnLength(state, seat, column)
  return ELECTRIC_EYRIE_DECREE_COLUMNS.every(
    (other: CardSuit): boolean => other === column || columnLength(state, seat, other) < length,
  )
}

/**
 * Rule: Rootbotics 5.5.1.III — battle in a matching clearing (no roost, most
 * defenseless buildings, lowest priority) the player with the most buildings
 * (most pieces, most points); the longest column deals one extra hit.
 */
export function decreeBattle(state: GameState, column: CardSuit, ctx: Ctx): BotTaskResult {
  const seat = state.currentSeat
  const clearings = inTargetOrder(orderedClearings(column), [
    byFewest((clearing: ClearingId): number => (hasRoost(state, clearing, seat) ? 1 : 0)),
    byMost((clearing: ClearingId): number => defenselessBuildingCount(state, clearing, seat)),
    byLowestPriority,
  ])
  for (const clearing of clearings) {
    const [defender] = defendersInOrder(state, { seat, clearing }, [
      byMost((candidate: Seat): number => buildingCountOf(state, clearing, candidate)),
      byMost((candidate: Seat): number => pieceCountOf(state, clearing, candidate)),
      byMostVictoryPoints(state),
      bySetupPriority(state),
    ])
    if (defender === undefined) continue
    const extraHits = isLongestColumn(state, seat, column) ? LONGEST_COLUMN_EXTRA_HITS : 0
    return taskDone(
      startBotBattle(state, { seat, clearing, defender, attackerExtraHits: extraHits }, ctx),
    )
  }
  return taskDone()
}
