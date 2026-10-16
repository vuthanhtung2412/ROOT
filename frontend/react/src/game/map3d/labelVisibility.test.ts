import { describe, expect, it } from 'vitest'
import {
  isLabelShown,
  LABELS_ON_HOVER_FROM_ZOOM,
} from '#game/map3d/labelVisibility.ts'

const ZOOMED_OUT = 0
const ZOOM_STEP = 0.01

describe('isLabelShown', () => {
  it('shows every label below the threshold', () => {
    expect(isLabelShown({ zoom: ZOOMED_OUT, isHovered: false })).toBe(true)
    expect(
      isLabelShown({
        zoom: LABELS_ON_HOVER_FROM_ZOOM - ZOOM_STEP,
        isHovered: false,
      }),
    ).toBe(true)
  })

  it('hides labels from the threshold on, unless hovered', () => {
    expect(
      isLabelShown({ zoom: LABELS_ON_HOVER_FROM_ZOOM, isHovered: false }),
    ).toBe(false)
    expect(
      isLabelShown({ zoom: LABELS_ON_HOVER_FROM_ZOOM, isHovered: true }),
    ).toBe(true)
  })
})
