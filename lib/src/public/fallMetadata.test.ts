import { describe, expect, it } from 'vitest'
import {
  FALL_FORESTS,
  fallForestLayout,
  fallForestLayouts,
} from '#public/fallMetadata.js'

describe('fallForestLayout', () => {
  it('builds polygon corners from bordering clearings', () => {
    expect(FALL_FORESTS).toHaveLength(7)
    const layouts = fallForestLayouts()
    expect(layouts).toHaveLength(7)
    for (const layout of layouts) {
      expect(layout.corners).toHaveLength(layout.cornerClearingIds.length)
      expect(layout.centroid.x).toBeGreaterThan(0)
      expect(layout.centroid.x).toBeLessThan(1)
      expect(layout.centroid.y).toBeGreaterThan(0)
      expect(layout.centroid.y).toBeLessThan(1)
    }
  })

  it('orders corners around centroid (closed polygon)', () => {
    const layout = fallForestLayout(3)
    expect(layout).not.toBeNull()
    if (layout === null) return
    // Central forest borders five clearings.
    expect(layout.cornerClearingIds).toHaveLength(5)
    expect(new Set(layout.cornerClearingIds)).toEqual(
      new Set(FALL_FORESTS[3]),
    )
  })
})
