/** Autumn undirected path edges (clearing ids 0–11). */
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
