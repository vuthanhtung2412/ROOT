import { describe, expect, it } from 'vitest'
import {
  FALL_FORESTS,
  fallAdjacentClearings,
  fallForestDisplayId,
  fallForestLayout,
  fallForestLayouts,
  fallMoveNeighborClearings,
  fallRiverAdjacentClearings,
} from '#public/fallMetadata.js'

describe('fallMoveNeighborClearings', () => {
  it('Rule: Boat Builders — rivers join path neighbors when treated as paths', () => {
    expect(fallAdjacentClearings(3)).not.toContain(6)
    expect(fallRiverAdjacentClearings(3)).toEqual([6])
    expect(fallMoveNeighborClearings(3, false)).not.toContain(6)
    expect(fallMoveNeighborClearings(3, true)).toContain(6)
  })
})

describe('fallForestLayout', () => {
  it('builds 11 forests from bordering clearings', () => {
    expect(FALL_FORESTS).toHaveLength(11)
    const layouts = fallForestLayouts()
    expect(layouts).toHaveLength(11)
    for (const layout of layouts) {
      expect(layout.corners).toHaveLength(layout.cornerClearingIds.length)
      expect(layout.centroid.x).toBeGreaterThan(0)
      expect(layout.centroid.x).toBeLessThan(1)
    }
  })

  it('F5 (index 4) is the central ruin-adjacent forest', () => {
    expect(fallForestDisplayId(4)).toBe(5)
    expect(FALL_FORESTS[4]).toEqual([1, 5, 9, 10])
    const layout = fallForestLayout(4)
    expect(layout).not.toBeNull()
    if (layout === null) return
    expect(new Set(layout.cornerClearingIds)).toEqual(new Set([1, 5, 9, 10]))
  })
})
