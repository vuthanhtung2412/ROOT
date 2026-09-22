import { GameMap } from '#map/GameMap.js'
import type { Clearing, ClearingId, Path } from '#map/types.js'

/** Fall (Autumn) clearing ids are 0..11. Source: therootdatabase.com/map/autumn + rootgame autumn_map_setup. */
const SLOTS = [1, 2, 1, 1, 2, 2, 2, 2, 2, 2, 3, 2] as const
const RUIN_CLEARINGS = new Set([5, 9, 10, 11])

const FOX = new Set([0, 5, 7, 11])
const RABBIT = new Set([2, 3, 4, 9])
const MOUSE = new Set([1, 6, 8, 10])

function suitOf(id: number): Clearing['suit'] {
  if (FOX.has(id)) return 'fox'
  if (RABBIT.has(id)) return 'rabbit'
  if (MOUSE.has(id)) return 'mouse'
  throw new Error(`unknown clearing suit: ${id}`)
}

const clearings: Clearing[] = Array.from({ length: 12 }, (_, id) => ({
  id,
  suit: suitOf(id),
  slots: SLOTS[id]!,
  ruinSlot: RUIN_CLEARINGS.has(id),
}))

/** Undirected path edges (a < b). */
const PATHS: Path[] = [
  [0, 4],
  [0, 8],
  [0, 9],
  [1, 4],
  [1, 5],
  [1, 9],
  [2, 5],
  [2, 6],
  [2, 10],
  [3, 7],
  [3, 8],
  [3, 11],
  [5, 10],
  [6, 7],
  [6, 11],
  [8, 11],
  [9, 11],
  [10, 11],
]

/** Forests as bordering clearing ids (7 on Autumn). */
const FORESTS: ClearingId[][] = [
  [0, 4, 9],
  [0, 8, 9, 11],
  [1, 4, 5],
  [1, 5, 9, 10, 11],
  [2, 5, 10, 11],
  [2, 6, 10, 11],
  [3, 6, 7, 8, 11],
]

/** Rivers link clearings but are not paths. Rule: Board > Rivers */
const RIVERS: Path[] = [
  [3, 6],
  [4, 9],
  [6, 10],
  [9, 10],
]

export class FallMap extends GameMap {
  /** NW, NE, SE, SW corner clearing ids. */
  readonly corners: readonly [ClearingId, ClearingId, ClearingId, ClearingId] = [
    0, 1, 2, 3,
  ]

  /** Default forest index for Vagabond setup (central-ish). */
  readonly vagabondForest = 3

  /** Diagonally opposite corner. Involutive on corners. */
  opposite(corner: ClearingId): ClearingId {
    const i = this.corners.indexOf(corner)
    if (i < 0) throw new Error(`not a corner clearing: ${corner}`)
    return this.corners[(i + 2) % 4]!
  }
}

export const FALL = new FallMap({
  clearings,
  paths: PATHS,
  rivers: RIVERS,
  forests: FORESTS,
})
