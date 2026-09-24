import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import { canPlace, keepClearingFor } from '#queries/place.js'
import { playerOf } from '#queries/seat.js'
import { openSlots } from '#queries/slots.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import type { MarquiseBoard } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'

export const MARQUISE_BUILDINGS = ['sawmill', 'workshop', 'recruiter'] as const
export type MarquiseBuilding = (typeof MARQUISE_BUILDINGS)[number]

export function isMarquiseBuilding(type: string): type is MarquiseBuilding {
  for (const building of MARQUISE_BUILDINGS) {
    if (building === type) return true
  }
  return false
}

/** Rule: Marquise > Setup 1–2 — keep clearing (must already be placed). */
export function keepCornerFor(state: GameState, seat: Seat): ClearingId {
  if (playerOf(state, seat).faction !== 'marquise') {
    throw new RuleError('NOT_MARQUISE', { seat })
  }
  const keep = keepClearingFor(state, seat)
  if (keep === null) throw new RuleError('NO_KEEP', { seat })
  return keep
}

function garrisonClearings(keep: ClearingId): ClearingId[] {
  const opposite = FALL.opposite(keep)
  return Array.from({ length: 12 }, (_, id) => id).filter((id) => id !== opposite)
}

function placeStartingBuildings(state: GameState, seat: Seat, keep: ClearingId): void {
  const targets = [keep, ...FALL.adjacent(keep).sort((a, b) => a - b)]
  for (const type of MARQUISE_BUILDINGS) {
    for (const clearing of targets) {
      if (placeUpTo(state, { seat, clearing, spec: { kind: 'building', type }, count: 1 }) > 0) break
    }
  }
}

function fillTracks(board: MarquiseBoard): void {
  board.tracks.sawmill.placed = 5
  board.tracks.workshop.placed = 5
  board.tracks.recruiter.placed = 5
}

/** Keep clearing + adjacent clearings (Law 6.3.4 zone). */
export function startingBuildingZone(state: GameState, seat: Seat): ClearingId[] {
  const keep = keepCornerFor(state, seat)
  return [keep, ...FALL.adjacent(keep)]
}

/** Clearings in the starting zone that can accept a building. */
export function legalStartingBuildingClearings(
  state: GameState,
  seat: Seat,
): ClearingId[] {
  return startingBuildingZone(state, seat).filter(
    (clearing) => openSlots(state, clearing) > 0 && canPlace(state, seat, clearing),
  )
}

/** Rule: Marquise > Setup 2–3 — keep token + garrison (buildings via pending). */
export function placeMarquiseKeepAndGarrison(
  state: GameState,
  seat: Seat,
  keep: ClearingId,
): void {
  if (playerOf(state, seat).faction !== 'marquise') {
    throw new RuleError('NOT_MARQUISE', { seat })
  }
  if (!FALL.corners.some((corner) => corner === keep)) {
    throw new RuleError('NOT_CORNER', { clearing: keep })
  }
  placeUpTo(state, { seat, clearing: keep, spec: { kind: 'token', type: 'keep' }, count: 1 })

  for (const clearing of garrisonClearings(keep)) {
    placeUpTo(state, { seat, clearing, spec: { kind: 'warrior' }, count: 1 })
  }
}

/** Rule: Marquise > Setup 4 — place one starting building in keep∪adjacent. */
export function placeMarquiseStartingBuilding(
  state: GameState,
  placement: {
    seat: Seat
    clearing: ClearingId
    building: MarquiseBuilding
  },
): void {
  const { seat, clearing, building } = placement
  if (playerOf(state, seat).faction !== 'marquise') {
    throw new RuleError('NOT_MARQUISE', { seat })
  }
  const zone = startingBuildingZone(state, seat)
  if (!zone.some((id) => id === clearing)) {
    throw new RuleError('OUTSIDE_STARTING_ZONE', { clearing })
  }
  if (openSlots(state, clearing) < 1) {
    throw new RuleError('NO_SLOT', { clearing })
  }
  const placed = placeUpTo(state, {
    seat,
    clearing,
    spec: { kind: 'building', type: building },
    count: 1,
  })
  if (placed < 1) {
    throw new RuleError('CANNOT_PLACE', { clearing, building })
  }
}

/** Rule: Marquise > Setup 5 — remaining buildings on tracks (leftmost empty). */
export function fillMarquiseSetupTracks(state: GameState, seat: Seat): void {
  const board = playerOf(state, seat).board
  if (board.kind !== 'marquise') throw new RuleError('NOT_MARQUISE', { seat })
  fillTracks(board)
}

/** Rule: Marquise > Setup 2–5 — full auto setup. */
export function placeMarquiseSetup(
  state: GameState,
  seat: Seat,
  keep: ClearingId,
): void {
  placeMarquiseKeepAndGarrison(state, seat, keep)
  placeStartingBuildings(state, seat, keep)
  fillMarquiseSetupTracks(state, seat)
}
