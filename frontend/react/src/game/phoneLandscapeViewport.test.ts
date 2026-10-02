import { describe, expect, it } from 'vitest'
import {
  DEVICE_VIEWPORT_META_CONTENT,
  phoneLandscapeLogicalWidth,
  stableLogicalWidth,
  viewportMetaContent,
  type ViewportMeasure,
} from '#game/phoneLandscapeViewport.ts'

function makeMeasure(overrides: Partial<ViewportMeasure> = {}): ViewportMeasure {
  return {
    screenWidth: 844,
    screenHeight: 390,
    innerWidth: 844,
    innerHeight: 390,
    ...overrides,
  }
}

describe('phoneLandscapeLogicalWidth', () => {
  it('scales a sideways phone to the wide design height', () => {
    expect(phoneLandscapeLogicalWidth(makeMeasure())).toBe(1558)
  })

  it('keeps the same width once the scaled layout is applied', () => {
    const scaled = makeMeasure({ innerWidth: 1558, innerHeight: 720 })
    expect(phoneLandscapeLogicalWidth(scaled)).toBe(1558)
  })

  it('reads the phone from the screen even when reported upright', () => {
    const measure = makeMeasure({ screenWidth: 390, screenHeight: 844 })
    expect(phoneLandscapeLogicalWidth(measure)).toBe(1558)
  })

  it('leaves an upright phone alone', () => {
    const measure = makeMeasure({ innerWidth: 390, innerHeight: 844 })
    expect(phoneLandscapeLogicalWidth(measure)).toBeNull()
  })

  it('leaves tablets and desktops alone', () => {
    const tablet = makeMeasure({
      screenWidth: 1024,
      screenHeight: 768,
      innerWidth: 1024,
      innerHeight: 768,
    })
    expect(phoneLandscapeLogicalWidth(tablet)).toBeNull()
  })
})

describe('stableLogicalWidth', () => {
  it('keeps the applied width through small jitter', () => {
    expect(stableLogicalWidth(1558, 1570)).toBe(1558)
  })

  it('follows a real change', () => {
    expect(stableLogicalWidth(1558, 1700)).toBe(1700)
    expect(stableLogicalWidth(1558, null)).toBeNull()
    expect(stableLogicalWidth(null, 1558)).toBe(1558)
  })
})

describe('viewportMetaContent', () => {
  it('uses the device width unless a logical width is given', () => {
    expect(viewportMetaContent(null)).toBe(DEVICE_VIEWPORT_META_CONTENT)
    expect(viewportMetaContent(1558)).toBe('width=1558')
  })
})
