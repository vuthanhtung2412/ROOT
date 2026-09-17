import { describe, expect, it } from 'vitest'
import { SeededRng } from './Rng.js'

describe('SeededRng', () => {
  it('roll returns 1..6', () => {
    const rng = new SeededRng({ seed: 42, cursor: 0 })
    for (let i = 0; i < 100; i++) {
      const r = rng.roll()
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(6)
    }
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
