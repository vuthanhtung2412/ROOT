import { describe, expect, it } from 'vitest'
import { FALL } from '#map/fall.js'

describe('Fall graph', () => {
  it('has 12 clearings', () => {
    expect(FALL.clearings).toHaveLength(12)
  })

  it('adjacency is symmetric', () => {
    for (const [a, b] of FALL.paths) {
      expect(FALL.isAdjacent(a, b)).toBe(true)
      expect(FALL.isAdjacent(b, a)).toBe(true)
    }
    for (const c of FALL.clearings) {
      for (const n of FALL.adjacent(c.id)) {
        expect(FALL.adjacent(n)).toContain(c.id)
      }
    }
  })

  it('rivers are not paths', () => {
    const pathSet = new Set(FALL.paths.map(([a, b]) => `${a}-${b}`))
    for (const [a, b] of FALL.rivers) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      expect(pathSet.has(key)).toBe(false)
      expect(FALL.isAdjacent(a, b)).toBe(false)
    }
  })

  it('opposite is involutive on corners', () => {
    for (const c of FALL.corners) {
      expect(FALL.opposite(FALL.opposite(c))).toBe(c)
    }
  })

  it('suits are 4 fox / 4 rabbit / 4 mouse', () => {
    const counts = { fox: 0, rabbit: 0, mouse: 0 }
    for (const c of FALL.clearings) counts[c.suit]++
    expect(counts).toEqual({ fox: 4, rabbit: 4, mouse: 4 })
  })

  it('has 4 ruin slots', () => {
    expect(FALL.clearings.filter((c) => c.ruinSlot)).toHaveLength(4)
  })

  // Rule: Board > Forests > Adjacency (2.4.1) — path or river edge.
  it('forest adjacency is symmetric via shared path or river edge', () => {
    expect(FALL.forests).toHaveLength(11)
    for (let forestIndex = 0; forestIndex < FALL.forests.length; forestIndex++) {
      for (const neighbor of FALL.adjacentForests(forestIndex)) {
        expect(FALL.isForestAdjacent(neighbor, forestIndex)).toBe(true)
        expect(neighbor).not.toBe(forestIndex)
      }
    }
    // Human F5 (index 4) touches F3, F4, F10.
    expect(FALL.adjacentForests(FALL.vagabondForest)).toEqual([2, 3, 9])
    // F2–F3 share river 4–9 (not a path).
    expect(FALL.isForestAdjacent(1, 2)).toBe(true)
  })
})
