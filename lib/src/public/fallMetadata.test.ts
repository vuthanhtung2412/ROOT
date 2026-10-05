import { describe, expect, it } from 'vitest'
import {
  FALL_FORESTS,
  fallForestDisplayId,
  fallForestLayout,
  fallForestLayouts,
} from '#public/fallMetadata.js'

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
