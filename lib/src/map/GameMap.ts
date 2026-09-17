import type { Clearing, ClearingId, Path } from './types.js'

export class GameMap {
  readonly clearings: Clearing[]
  readonly paths: Path[]
  readonly rivers: Path[]
  readonly forests: ClearingId[][]

  private readonly adjacency: Map<ClearingId, ClearingId[]>

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
  }

  adjacent(id: ClearingId): ClearingId[] {
    return this.adjacency.get(id) ?? []
  }

  isAdjacent(a: ClearingId, b: ClearingId): boolean {
    return this.adjacent(a).includes(b)
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
