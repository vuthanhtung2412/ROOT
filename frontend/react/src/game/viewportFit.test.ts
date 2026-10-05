import { describe, expect, it } from 'vitest'
import {
  DEVICE_VIEWPORT_META_CONTENT,
  fittedLogicalWidth,
  logicalViewportSize,
  stableLogicalWidth,
  UNSCALED_ZOOM,
  viewportMetaContent,
  viewportZoom,
  type ViewportMeasure,
} from '#game/viewportFit.ts'

/** Default: phone held sideways, before any scaling. */
function makeMeasure(overrides: Partial<ViewportMeasure> = {}): ViewportMeasure {
  return {
    screenWidth: 844,
    screenHeight: 390,
    innerWidth: 844,
    innerHeight: 390,
    ...overrides,
  }
}

function makeDesktopMeasure(
  innerWidth: number,
  innerHeight: number,
): ViewportMeasure {
  return makeMeasure({
    screenWidth: 1512,
    screenHeight: 982,
    innerWidth,
    innerHeight,
  })
}

describe('fittedLogicalWidth', () => {
  it('fits a sideways phone to the design height', () => {
    expect(fittedLogicalWidth(makeMeasure())).toBe(1558)
  })

  it('keeps the same width once the meta tag scaled the page', () => {
    const scaled = makeMeasure({ innerWidth: 1558, innerHeight: 720 })
    expect(fittedLogicalWidth(scaled)).toBe(1558)
  })

  it('reads the device from the screen even when reported upright', () => {
    const measure = makeMeasure({ screenWidth: 390, screenHeight: 844 })
    expect(fittedLogicalWidth(measure)).toBe(1558)
  })

  it('fits a sideways tablet to the design width', () => {
    const tablet = makeMeasure({
      screenWidth: 1024,
      screenHeight: 768,
      innerWidth: 1024,
      innerHeight: 768,
    })
    expect(fittedLogicalWidth(tablet)).toBe(1280)
  })

  it('fits a small desktop window', () => {
    expect(fittedLogicalWidth(makeDesktopMeasure(1100, 560))).toBe(1414)
  })

  it('leaves an upright phone alone', () => {
    const measure = makeMeasure({ innerWidth: 390, innerHeight: 844 })
    expect(fittedLogicalWidth(measure)).toBeNull()
  })

  it('leaves a viewport at or above the design size alone', () => {
    expect(fittedLogicalWidth(makeDesktopMeasure(1280, 720))).toBeNull()
    expect(fittedLogicalWidth(makeDesktopMeasure(1512, 860))).toBeNull()
  })
})

describe('viewportZoom', () => {
  it('zooms a small desktop window down to the design size', () => {
    expect(viewportZoom(makeDesktopMeasure(1100, 560))).toBeCloseTo(0.778, 3)
  })

  it('stays unscaled once the meta tag scaled the page', () => {
    const scaled = makeMeasure({ innerWidth: 1558, innerHeight: 720 })
    expect(viewportZoom(scaled)).toBe(UNSCALED_ZOOM)
  })

  it('stays unscaled below the wide breakpoint', () => {
    expect(viewportZoom(makeDesktopMeasure(700, 400))).toBe(UNSCALED_ZOOM)
  })

  it('stays unscaled when large enough', () => {
    expect(viewportZoom(makeDesktopMeasure(1512, 860))).toBe(UNSCALED_ZOOM)
  })
})

describe('logicalViewportSize', () => {
  it('reports the design-sized viewport inside a zoomed window', () => {
    const size = logicalViewportSize(makeDesktopMeasure(1100, 560))
    expect(Math.round(size.width)).toBe(1414)
    expect(Math.round(size.height)).toBe(720)
  })

  it('reports the real viewport when unscaled', () => {
    const size = logicalViewportSize(makeDesktopMeasure(1512, 860))
    expect(size).toEqual({ width: 1512, height: 860 })
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
