import type { Clearing, ClearingId, Path } from '#map/types.js'

export class GameMap {
  readonly clearings: Clearing[]
  readonly paths: Path[]
  readonly rivers: Path[]
  readonly forests: ClearingId[][]

  private readonly adjacency: Map<ClearingId, ClearingId[]>
  /** Forest index → adjacent forest indexes. Rule: 2.4.1 */
  private readonly forestAdjacency: Map<number, number[]>

  constructor(args: {
    clearings: Clearing[]
    paths: Path[]
    rivers?: Path[]
    forests?: ClearingId[][]
  }) {
    this.clearings = args.clearings
    this.paths = args.paths
    this.rivers = args.rivers ?? []
    this.forests = args.forests ?? []
    this.adjacency = new Map()
    for (const c of this.clearings) {
      this.adjacency.set(c.id, [])
    }
    for (const [a, b] of this.paths) {
      this.adjacency.get(a)!.push(b)
      this.adjacency.get(b)!.push(a)
    }
    for (const [, neighbors] of this.adjacency) {
      neighbors.sort((x, y) => x - y)
    }
    this.forestAdjacency = buildForestAdjacency(this.forests, this.paths)
  }

  adjacent(id: ClearingId): ClearingId[] {
    return this.adjacency.get(id) ?? []
  }

  isAdjacent(a: ClearingId, b: ClearingId): boolean {
    return this.adjacent(a).includes(b)
  }

  /**
   * Forests separated by exactly one printed path.
   * Rule: Board > Forests > Adjacency (2.4.1)
   */
  adjacentForests(forestIndex: number): number[] {
    return this.forestAdjacency.get(forestIndex) ?? []
  }

  isForestAdjacent(forestA: number, forestB: number): boolean {
    return this.adjacentForests(forestA).includes(forestB)
  }

  shortestPath(a: ClearingId, b: ClearingId): ClearingId[] | null {
    if (a === b) return [a]
    const queue: ClearingId[] = [a]
    const prev = new Map<ClearingId, ClearingId | null>([[a, null]])
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const n of this.adjacent(cur)) {
        if (prev.has(n)) continue
        prev.set(n, cur)
        if (n === b) {
          const path: ClearingId[] = []
          let x: ClearingId | null = b
          while (x !== null) {
            path.push(x)
            x = prev.get(x) ?? null
          }
          path.reverse()
          return path
        }
        queue.push(n)
      }
    }
    return null
  }
}

/**
 * Two forests share a path edge when both endpoints of that path sit on both
 * forests' bordering clearing sets — i.e. one printed path separates them.
 * Rule: Board > Forests > Adjacency (2.4.1)
 */
function buildForestAdjacency(
  forests: ClearingId[][],
  paths: Path[],
): Map<number, number[]> {
  const adjacency = new Map<number, number[]>()
  for (let forestIndex = 0; forestIndex < forests.length; forestIndex++) {
    adjacency.set(forestIndex, [])
  }
  for (let left = 0; left < forests.length; left++) {
    const leftBorder = new Set(forests[left] ?? [])
    for (let right = left + 1; right < forests.length; right++) {
      const rightBorder = new Set(forests[right] ?? [])
      const sharePathEdge = paths.some(([pathLeft, pathRight]) => {
        return (
          leftBorder.has(pathLeft) &&
          leftBorder.has(pathRight) &&
          rightBorder.has(pathLeft) &&
          rightBorder.has(pathRight)
        )
      })
      if (!sharePathEdge) continue
      adjacency.get(left)!.push(right)
      adjacency.get(right)!.push(left)
    }
  }
  for (const [, neighbors] of adjacency) {
    neighbors.sort((a, b) => a - b)
  }
  return adjacency
}
