import { describe, expect, it } from 'vitest'
import {
  landscapeMapHostSize,
  landscapePlayfieldCenterFraction,
  landscapePlayfieldSideFraction,
  portraitMapHostSize,
  resolveViewportLayoutMode,
  VIEWPORT_WIDE_MIN_WIDTH_PIXELS,
} from '#game/viewportLayout.ts'

describe('resolveViewportLayoutMode', () => {
  it('marks widths below Tailwind md as portrait', () => {
    expect(resolveViewportLayoutMode(390, 844)).toBe('portrait')
    expect(resolveViewportLayoutMode(VIEWPORT_WIDE_MIN_WIDTH_PIXELS - 1)).toBe(
      'portrait',
    )
  })

  it('marks widths at or above Tailwind md as landscape', () => {
    expect(resolveViewportLayoutMode(VIEWPORT_WIDE_MIN_WIDTH_PIXELS)).toBe(
      'landscape',
    )
    expect(resolveViewportLayoutMode(1280, 720)).toBe('landscape')
    expect(resolveViewportLayoutMode(844, 390)).toBe('landscape')
  })
})

describe('portraitMapHostSize', () => {
  it('reserves top and bottom chrome insets', () => {
    const host = portraitMapHostSize({ width: 390, height: 844 })
    expect(host.width).toBe(370)
    expect(host.height).toBe(516)
  })
})

describe('landscape playfield 1-3-1', () => {
  it('splits viewport into side and center fractions', () => {
    expect(landscapePlayfieldSideFraction()).toBe(0.2)
    expect(landscapePlayfieldCenterFraction()).toBe(0.6)
  })

  it('sizes map host to center column', () => {
    const host = landscapeMapHostSize({ width: 1600, height: 900 })
    expect(host.width).toBe(960)
    expect(host.height).toBe(900)
  })
})
