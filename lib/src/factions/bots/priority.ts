import {
  baseFactionOf,
  type HumanFactionId,
} from '#factions/bots/botFactions.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

/**
 * Rule: Rootbotics 3.1 — Fall priority markers follow the printed clearing
 * numbers: clearing id 0 is marked "1" (highest), id 11 is marked "12".
 */
const PRIORITY_MARKER_OFFSET = 1

/** Rule: Rootbotics 2.2 — setup priority A (Marquise) … F (Riverfolk). */
const SETUP_PRIORITY: readonly HumanFactionId[] = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
]

/** Negative: `left` goes first. */
export type Tiebreaker<Candidate> = (left: Candidate, right: Candidate) => number

export function clearingPriority(clearing: ClearingId): number {
  return clearing + PRIORITY_MARKER_OFFSET
}

/** Rule: Rootbotics 2.1 — "1" is the highest priority. */
export const byHighestPriority: Tiebreaker<ClearingId> = (
  left: ClearingId,
  right: ClearingId,
): number => clearingPriority(left) - clearingPriority(right)

export const byLowestPriority: Tiebreaker<ClearingId> = (
  left: ClearingId,
  right: ClearingId,
): number => clearingPriority(right) - clearingPriority(left)

/** Larger score first. */
export function byMost<Candidate>(
  score: (candidate: Candidate) => number,
): Tiebreaker<Candidate> {
  return (left: Candidate, right: Candidate): number =>
    score(right) - score(left)
}

/** Smaller score first. */
export function byFewest<Candidate>(
  score: (candidate: Candidate) => number,
): Tiebreaker<Candidate> {
  return (left: Candidate, right: Candidate): number =>
    score(left) - score(right)
}

/**
 * Candidates in target order: the first tiebreaker decides, the next ones
 * only break its ties (Rootbotics 2.1 / 2.3 — try the next on illegality).
 */
export function inTargetOrder<Candidate>(
  candidates: readonly Candidate[],
  tiebreakers: readonly Tiebreaker<Candidate>[],
): Candidate[] {
  return [...candidates].sort((left: Candidate, right: Candidate): number => {
    for (const tiebreaker of tiebreakers) {
      const order = tiebreaker(left, right)
      if (order !== 0) return order
    }
    return 0
  })
}

export function setupPriorityOf(state: GameState, seat: Seat): number {
  return SETUP_PRIORITY.indexOf(baseFactionOf(playerOf(state, seat).faction))
}

/** Rule: Rootbotics 2.2 — players fall back to setup priority, Marquise first. */
export function bySetupPriority(state: GameState): Tiebreaker<Seat> {
  return (left: Seat, right: Seat): number =>
    setupPriorityOf(state, left) - setupPriorityOf(state, right)
}

/** Rule: Rootbotics 4.5.1.I / 5.5.1.IIIe — "such a player with the most victory points". */
export function byMostVictoryPoints(state: GameState): Tiebreaker<Seat> {
  return byMost((seat: Seat): number => playerOf(state, seat).vp)
}
