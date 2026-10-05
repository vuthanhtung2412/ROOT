import { GameMap } from '#map/GameMap.js'
import type { Clearing, ClearingId, Path } from '#map/types.js'
import { FALL_CLEARING_SLOT_COUNTS } from '#map/fallSlots.js'
import {
  FALL_CLEARING_SUITS,
  FALL_FORESTS,
  FALL_PATHS,
  FALL_RIVERS,
} from '#public/fallMetadata.js'

/** Fall (Autumn) clearing ids are 0..11. Source: therootdatabase.com/map/autumn + rootgame autumn_map_setup. */
const RUIN_CLEARINGS = new Set([5, 9, 10, 11])

const clearings: Clearing[] = FALL_CLEARING_SUITS.map(
  (suit, id): Clearing => ({
    id,
    suit,
    slots: FALL_CLEARING_SLOT_COUNTS[id]!,
    ruinSlot: RUIN_CLEARINGS.has(id),
  }),
)

const paths: Path[] = FALL_PATHS.map(
  ([left, right]): Path => [left, right],
)

/** Forests as bordering clearing ids (11 on Autumn). */
const FORESTS: ClearingId[][] = FALL_FORESTS.map((border) => [...border])

/** Rivers link clearings but are not paths. Rule: Board > Rivers */
const RIVERS: Path[] = FALL_RIVERS.map(
  ([left, right]): Path => [left, right],
)

export class FallMap extends GameMap {
  /** NW, NE, SE, SW corner clearing ids. */
  readonly corners: readonly [ClearingId, ClearingId, ClearingId, ClearingId] = [
    0, 1, 2, 3,
  ]

  /** Default forest index for Vagabond setup (human F5 — central). */
  readonly vagabondForest = 4

  /** Diagonally opposite corner. Involutive on corners. */
  opposite(corner: ClearingId): ClearingId {
    const i = this.corners.indexOf(corner)
    if (i < 0) throw new Error(`not a corner clearing: ${corner}`)
    return this.corners[(i + 2) % 4]!
  }
}

export const FALL = new FallMap({
  clearings,
  paths,
  rivers: RIVERS,
  forests: FORESTS,
})
