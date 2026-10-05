export type FallClearingSuit = 'fox' | 'mouse' | 'rabbit'

export type FallLayoutPoint = {
  x: number
  y: number
  r: number
}

export const FALL_CLEARING_SUITS: readonly FallClearingSuit[] = [
  'fox',
  'mouse',
  'rabbit',
  'rabbit',
  'rabbit',
  'fox',
  'mouse',
  'fox',
  'mouse',
  'rabbit',
  'mouse',
  'fox',
]

export const FALL_PATHS: ReadonlyArray<readonly [number, number]> = [
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

/** Rivers link clearings but are not paths. They still divide forests. */
export const FALL_RIVERS: ReadonlyArray<readonly [number, number]> = [
  [3, 6],
  [4, 9],
  [6, 10],
  [9, 10],
]

/**
 * Forests as bordering clearing ids (polygon corners).
 * Array index 0 = human F1 … index 10 = human F11.
 * Rule: Board > Forests (2.4)
 */
export const FALL_FORESTS: ReadonlyArray<readonly number[]> = [
  [0, 8, 9, 11], // F1
  [0, 4, 9], // F2
  [1, 4, 9], // F3
  [9, 10, 11], // F4
  [1, 5, 9, 10], // F5
  [3, 8, 11], // F6
  [3, 6, 11], // F7
  [6, 10, 11], // F8
  [2, 6, 10], // F9
  [2, 5, 10], // F10
  [3, 6, 7], // F11
]

/** Human-facing forest id (F1…F11). Internal index is 0-based. */
export function fallForestDisplayId(forestIndex: number): number {
  return forestIndex + 1
}

export type FallLayoutPoint2d = {
  x: number
  y: number
}

export type FallForestLayout = {
  forestIndex: number
  /** Border clearings in angular order around the centroid (polygon corners). */
  cornerClearingIds: readonly number[]
  corners: readonly FallLayoutPoint2d[]
  centroid: FallLayoutPoint2d
}

export const FALL_LAYOUT_CLEARINGS: Readonly<
  Record<number, FallLayoutPoint>
> = {
  0: { x: 0.113, y: 0.119, r: 0.0715 },
  1: { x: 0.881, y: 0.226, r: 0.0715 },
  2: { x: 0.836, y: 0.868, r: 0.0715 },
  3: { x: 0.104, y: 0.819, r: 0.0715 },
  4: { x: 0.548, y: 0.097, r: 0.0715 },
  5: { x: 0.894, y: 0.531, r: 0.0715 },
  6: { x: 0.583, y: 0.78, r: 0.0715 },
  7: { x: 0.354, y: 0.912, r: 0.0715 },
  8: { x: 0.108, y: 0.387, r: 0.0715 },
  9: { x: 0.437, y: 0.294, r: 0.0715 },
  10: { x: 0.645, y: 0.497, r: 0.0715 },
  11: { x: 0.313, y: 0.545, r: 0.0715 },
}

export function fallAdjacentClearings(clearingId: number): number[] {
  const neighbors: number[] = []
  for (const [left, right] of FALL_PATHS) {
    if (left === clearingId) {
      neighbors.push(right)
    } else if (right === clearingId) {
      neighbors.push(left)
    }
  }
  return neighbors
}

/**
 * Forest covered area = polygon whose corners are the bordering clearing centers,
 * ordered around the centroid.
 */
export function fallForestLayout(forestIndex: number): FallForestLayout | null {
  const border = FALL_FORESTS[forestIndex]
  if (border === undefined) return null
  const points: Array<{ clearingId: number; x: number; y: number }> = []
  for (const clearingId of border) {
    const point = FALL_LAYOUT_CLEARINGS[clearingId]
    if (point === undefined) continue
    points.push({ clearingId, x: point.x, y: point.y })
  }
  if (points.length === 0) return null
  const centroidX =
    points.reduce((sum, point) => sum + point.x, 0) / points.length
  const centroidY =
    points.reduce((sum, point) => sum + point.y, 0) / points.length
  const ordered = [...points].sort((left, right) => {
    const angleLeft = Math.atan2(left.y - centroidY, left.x - centroidX)
    const angleRight = Math.atan2(right.y - centroidY, right.x - centroidX)
    return angleLeft - angleRight
  })
  return {
    forestIndex,
    cornerClearingIds: ordered.map((point) => point.clearingId),
    corners: ordered.map((point) => ({ x: point.x, y: point.y })),
    centroid: { x: centroidX, y: centroidY },
  }
}

export function fallForestLayouts(): FallForestLayout[] {
  const layouts: FallForestLayout[] = []
  for (let forestIndex = 0; forestIndex < FALL_FORESTS.length; forestIndex++) {
    const layout = fallForestLayout(forestIndex)
    if (layout !== null) layouts.push(layout)
  }
  return layouts
}
