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
})
