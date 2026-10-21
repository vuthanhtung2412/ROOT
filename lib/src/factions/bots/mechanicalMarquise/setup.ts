import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import { shuffleWithRng } from '#game/setup.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { openSlots } from '#queries/slots.js'
import { placeUpTo } from '#rules/place.js'
import { randomIndex, type Rng } from '#rules/Rng.js'
import { MECHANICAL_MARQUISE_TRACK_BUILDINGS } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

export type MechanicalMarquiseBuilding = 'sawmill' | 'workshop' | 'recruiter'

export const MECHANICAL_MARQUISE_BUILDINGS: readonly MechanicalMarquiseBuilding[] = [
  'sawmill',
  'workshop',
  'recruiter',
]

/** Rule: Rootbotics 4.3.3 — one more warrior in the keep clearing. */
const KEEP_CLEARING_EXTRA_WARRIORS = 1

/** Rule: Rootbotics 4.3.2 — the keep goes in a random corner clearing. */
export function randomKeepCorner(rng: Rng): ClearingId {
  return FALL.corners[randomIndex(rng, FALL.corners.length)]!
}

/** Rule: Rootbotics 4.3.3 — every clearing but the corner opposite the keep. */
function garrisonClearings(keep: ClearingId): ClearingId[] {
  const opposite = FALL.opposite(keep)
  return FALL.clearings
    .map((clearing): ClearingId => clearing.id)
    .filter((clearing: ClearingId): boolean => clearing !== opposite)
}

/**
 * Rule: Rootbotics 4.3.4 — sawmill, workshop and recruiter at random among
 * the keep clearing and its adjacent clearings, at most one per clearing.
 */
function placeStartingBuildings(
  state: GameState,
  seat: Seat,
  placement: { keep: ClearingId; rng: Rng },
): void {
  const zone: ClearingId[] = [
    placement.keep,
    ...FALL.adjacent(placement.keep),
  ].filter(
    (clearing: ClearingId): boolean =>
      openSlots(state, clearing) > 0 && canPlace(state, seat, clearing),
  )
  const clearings: ClearingId[] = shuffleWithRng(zone, placement.rng)
  MECHANICAL_MARQUISE_BUILDINGS.forEach(
    (building: MechanicalMarquiseBuilding, index: number): void => {
      const clearing = clearings[index]
      if (clearing === undefined) return
      placeUpTo(state, {
        seat,
        clearing,
        spec: { kind: 'building', type: building },
        count: 1,
      })
    },
  )
}

/** Rule: Rootbotics 4.3 — keep, garrison, starting buildings and tracks. */
export function placeMechanicalMarquiseSetup(
  state: GameState,
  seat: Seat,
  rng: Rng,
): void {
  const keep = randomKeepCorner(rng)
  placeUpTo(state, {
    seat,
    clearing: keep,
    spec: { kind: 'token', type: 'keep' },
    count: 1,
  })
  for (const clearing of garrisonClearings(keep)) {
    placeUpTo(state, { seat, clearing, spec: { kind: 'warrior' }, count: 1 })
  }
  placeUpTo(state, {
    seat,
    clearing: keep,
    spec: { kind: 'warrior' },
    count: KEEP_CLEARING_EXTRA_WARRIORS,
  })
  placeStartingBuildings(state, seat, { keep, rng })

  // Rule: Rootbotics 4.3.5 — the rest fill each track but its leftmost space.
  const board = mechanicalMarquiseBoardOf(state, seat)
  for (const building of MECHANICAL_MARQUISE_BUILDINGS) {
    board.tracks[building].placed = MECHANICAL_MARQUISE_TRACK_BUILDINGS
  }
}
