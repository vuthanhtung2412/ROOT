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
