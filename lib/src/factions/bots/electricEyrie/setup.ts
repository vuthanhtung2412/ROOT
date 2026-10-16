import { electricEyrieBoardOf } from '#factions/bots/botBoards.js'
import { makeViziers } from '#factions/eyrie/viziers.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { canPlace, keepOwner } from '#queries/place.js'
import { openSlots } from '#queries/slots.js'
import { placeUpTo } from '#rules/place.js'
import { randomIndex, type Rng } from '#rules/Rng.js'
import {
  ELECTRIC_EYRIE_TRACK_ROOSTS,
  emptyElectricEyrieDecree,
} from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 5.3.2 — warriors placed with the starting roost. */
const STARTING_WARRIORS = 6

/** Corners where another faction already started (the keep corner). */
function startingCorners(state: GameState): ClearingId[] {
  return FALL.corners.filter(
    (corner: ClearingId): boolean => keepOwner(state, corner) !== null,
  )
}

/**
 * Rule: Rootbotics 5.3.2 — a random free corner, diagonally opposite a
 * starting corner if possible.
 */
export function electricEyrieStartCorner(
  state: GameState,
  seat: Seat,
  rng: Rng,
): ClearingId {
  const taken: ClearingId[] = startingCorners(state)
  const free: ClearingId[] = FALL.corners.filter(
    (corner: ClearingId): boolean =>
      !taken.includes(corner) &&
      openSlots(state, corner) > 0 &&
      canPlace(state, seat, corner),
  )
  const opposite: ClearingId[] = free.filter((corner: ClearingId): boolean =>
    taken.includes(FALL.opposite(corner)),
  )
  const candidates: ClearingId[] = opposite.length > 0 ? opposite : free
  const corner = candidates[randomIndex(rng, candidates.length)]
  if (corner === undefined) return FALL.corners[0]
  return corner
}

/** Rule: Rootbotics 5.3 — roost, warriors, viziers and Roosts track. */
export function placeElectricEyrieSetup(
  state: GameState,
  seat: Seat,
  rng: Rng,
): void {
  const corner = electricEyrieStartCorner(state, seat, rng)
  placeUpTo(state, {
    seat,
    clearing: corner,
    spec: { kind: 'building', type: 'roost' },
    count: 1,
  })
  placeUpTo(state, {
    seat,
    clearing: corner,
    spec: { kind: 'warrior' },
    count: STARTING_WARRIORS,
  })
  const board = electricEyrieBoardOf(state, seat)
  // Rule: Rootbotics 5.3.3 — both Loyal Viziers in the rightmost (bird) column.
  board.decree = { ...emptyElectricEyrieDecree(), bird: makeViziers() }
  // Rule: Rootbotics 5.3.4 — the track holds every roost but the leftmost space.
  board.roostTrack.placed = ELECTRIC_EYRIE_TRACK_ROOSTS
}
