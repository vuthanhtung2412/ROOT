import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { exhaustItems, exhaustibleItemCount } from '#factions/bots/vagabot/items.js'
import { byHighestPriority, inTargetOrder, type Tiebreaker } from '#factions/bots/priority.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Pawn, Piece, Seat } from '#pieces/types.js'
import { randomIndex, type Rng } from '#rules/Rng.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 7.5 — one item exhausted per move. */
const ITEMS_PER_MOVE = 1

export type PawnTravel = {
  seat: Seat
  /** Where the Vagabot can take the action. */
  canActIn: (clearing: ClearingId) => boolean
  /** Tiebreakers among the nearest such clearings; highest priority last (2.1). */
  tiebreakers?: readonly Tiebreaker<ClearingId>[]
}

export type TravelResult = {
  logs: LogEntry[]
  /** Clearing reached, or null when it could not get there. */
  clearing: ClearingId | null
}

function pawnId(seat: Seat): string {
  return `pawn-${seat}`
}

function isPawnOf(seat: Seat): (piece: Piece) => boolean {
  return (piece: Piece): boolean => piece.kind === 'pawn' && piece.owner === seat
}

/** The clearing the Vagabot pawn is in; null in a forest. */
export function vagabotClearing(state: GameState, seat: Seat): ClearingId | null {
  if (vagabotBoardOf(state, seat).forest !== null) return null
  const clearing = state.clearings.findIndex((clearingState): boolean =>
    clearingState.pieces.some(isPawnOf(seat)),
  )
  return clearing < 0 ? null : clearing
}

function takePawnOff(state: GameState, seat: Seat): void {
  for (const clearingState of state.clearings) {
    clearingState.pieces = clearingState.pieces.filter(
      (piece: Piece): boolean => !isPawnOf(seat)(piece),
    )
  }
}

/** Put the pawn in a clearing (Rule: Rootbotics 7.2.2 Nimble — rule does not matter). */
export function placePawnInClearing(state: GameState, seat: Seat, clearing: ClearingId): LogEntry[] {
  const from = vagabotClearing(state, seat)
  takePawnOff(state, seat)
  vagabotBoardOf(state, seat).forest = null
  const pawn: Pawn = { id: pawnId(seat), kind: 'pawn', owner: seat }
  state.clearings[clearing]!.pieces.push(pawn)
  const removed: LogEntry[] = from === null ? [] : [{ t: 'pieces', clearing: from, removed: [pawn] }]
  return [...removed, { t: 'pieces', clearing, placed: [pawn] }]
}

/** Put the pawn in a forest. */
export function placePawnInForest(state: GameState, seat: Seat, forest: number): LogEntry[] {
  const from = vagabotClearing(state, seat)
  takePawnOff(state, seat)
  vagabotBoardOf(state, seat).forest = forest
  const pawn: Pawn = { id: pawnId(seat), kind: 'pawn', owner: seat }
  return from === null ? [] : [{ t: 'pieces', clearing: from, removed: [pawn] }]
}

/** Moves needed from the pawn to each clearing (paths only; a forest borders its clearings). */
export function movesToClearings(state: GameState, seat: Seat): Map<ClearingId, number> {
  const board = vagabotBoardOf(state, seat)
  const start = vagabotClearing(state, seat)
  const distances = new Map<ClearingId, number>()
  let frontier: ClearingId[] = []
  if (start !== null) {
    distances.set(start, 0)
    frontier = [start]
  } else if (board.forest !== null) {
    frontier = [...(FALL.forests[board.forest] ?? [])]
    for (const clearing of frontier) distances.set(clearing, 1)
  }
  while (frontier.length > 0) {
    const next: ClearingId[] = []
    for (const clearing of frontier) {
      for (const neighbour of FALL.adjacent(clearing)) {
        if (distances.has(neighbour)) continue
        distances.set(neighbour, distances.get(clearing)! + 1)
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return distances
}

/**
 * Rule: Rootbotics 7.5 — stay if the action can be taken here; else move to
 * the nearest clearing where it can, one item per move. Without the items for
 * the whole trip it does not move (reading, see PLAN.md).
 */
export function travelToAct(state: GameState, travel: PawnTravel): TravelResult {
  const { seat, canActIn } = travel
  const distances = movesToClearings(state, seat)
  const reachable = [...distances.keys()].filter(canActIn)
  if (reachable.length === 0) return { logs: [], clearing: null }
  const nearest = Math.min(...reachable.map((clearing: ClearingId): number => distances.get(clearing)!))
  const [destination] = inTargetOrder(
    reachable.filter((clearing: ClearingId): boolean => distances.get(clearing) === nearest),
    [...(travel.tiebreakers ?? []), byHighestPriority],
  )
  if (destination === undefined) return { logs: [], clearing: null }
  if (nearest === 0) return { logs: [], clearing: destination }
  const board = vagabotBoardOf(state, seat)
  if (exhaustibleItemCount(board) < nearest * ITEMS_PER_MOVE) return { logs: [], clearing: null }
  exhaustItems(board, nearest * ITEMS_PER_MOVE)
  return {
    logs: [
      { t: 'action', actor: seat, action: { type: 'botPawnMove', to: destination } },
      ...placePawnInClearing(state, seat, destination),
    ],
    clearing: destination,
  }
}

/** Forests next to the pawn: bordering its clearing, or adjacent to its forest. */
export function adjacentForests(state: GameState, seat: Seat): number[] {
  const board = vagabotBoardOf(state, seat)
  if (board.forest !== null) return FALL.adjacentForests(board.forest)
  const clearing = vagabotClearing(state, seat)
  if (clearing === null) return []
  return FALL.forests
    .map((border: ClearingId[], forest: number): { forest: number; borders: boolean } => ({
      forest,
      borders: border.includes(clearing),
    }))
    .filter((entry: { forest: number; borders: boolean }): boolean => entry.borders)
    .map((entry: { forest: number; borders: boolean }): number => entry.forest)
}

/** Rule: Rootbotics 7.4.3 / 7.7.3 — slip into a random adjacent forest. */
export function slipToRandomForest(state: GameState, seat: Seat, rng: Rng): LogEntry[] {
  const forests = adjacentForests(state, seat)
  if (forests.length === 0) return []
  const forest = forests[randomIndex(rng, forests.length)]!
  return [
    { t: 'action', actor: seat, action: { type: 'botSlip', forest } },
    ...placePawnInForest(state, seat, forest),
  ]
}
