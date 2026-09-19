import { describe, expect, it } from 'vitest'
import { randomIndex, SeededRng } from './Rng.js'

describe('SeededRng', () => {
  it('roll returns 0..3', () => {
    const rng = new SeededRng({ seed: 42, cursor: 0 })
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      const face = rng.roll()
      expect(face).toBeGreaterThanOrEqual(0)
      expect(face).toBeLessThanOrEqual(3)
      seen.add(face)
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]))
  })

  it('deterministic from seed and cursor', () => {
    const a = new SeededRng({ seed: 99, cursor: 0 })
    const b = new SeededRng({ seed: 99, cursor: 0 })
    const rollsA = [a.roll(), a.roll(), a.roll()]
    const rollsB = [b.roll(), b.roll(), b.roll()]
    expect(rollsA).toEqual(rollsB)
  })

  it('serializable seed and cursor', () => {
    const rng = new SeededRng({ seed: 123, cursor: 0 })
    const first = rng.roll()
    const snapshot = rng.toJSON()
    expect(snapshot).toEqual({ seed: 123, cursor: 1 })

    const restored = SeededRng.fromJSON(snapshot)
    const second = restored.roll()
    const rngCont = new SeededRng({ seed: 123, cursor: 0 })
    rngCont.roll()
    expect(second).toBe(rngCont.roll())
    expect(first).not.toBe(second)
  })
})

describe('randomIndex', () => {
  it('stays in range and uses only Root dice', () => {
    const rng = new SeededRng({ seed: 7, cursor: 0 })
    for (let i = 0; i < 100; i++) {
      const index = randomIndex(rng, 54)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(54)
    }
  })

  it('returns 0 when max is 1', () => {
    const rng = new SeededRng({ seed: 1, cursor: 0 })
    expect(randomIndex(rng, 1)).toBe(0)
  })
})
