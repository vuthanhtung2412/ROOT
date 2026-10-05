import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import { VIEWPORT_WIDE_MIN_WIDTH_PIXELS } from '#game/viewportLayout.ts'

/**
 * Wide layout on a viewport smaller than the design size: lay the page out
 * at the design size and scale it down, instead of cropping the chrome.
 * - Phones and tablets: the viewport meta tag (browser scales the page).
 * - Desktop browsers ignore that tag: CSS zoom on the app root.
 */

export const DEVICE_VIEWPORT_META_CONTENT =
  'width=device-width, initial-scale=1.0'

export const UNSCALED_ZOOM = 1

/** Ignore small ratio jitter (browser bars, rounding) so the scale stays put. */
export const LOGICAL_WIDTH_CHANGE_TOLERANCE_PIXELS = 24

export type ViewportMeasure = {
  screenWidth: number
  screenHeight: number
  innerWidth: number
  innerHeight: number
}

export type ViewportPixelSize = {
  width: number
  height: number
}

/**
 * Layout width that fits the design size at the current aspect ratio.
 * Null when upright (narrow layout) or already large enough.
 */
export function fittedLogicalWidth(measure: ViewportMeasure): number | null {
  const isSideways = measure.innerWidth > measure.innerHeight
  if (!isSideways || measure.innerHeight <= 0) {
    return null
  }
  const aspectRatio = measure.innerWidth / measure.innerHeight
  const logicalWidth = Math.round(
    Math.max(GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT * aspectRatio),
  )
  // Once the meta tag applies, innerWidth is the logical width: the screen
  // still tells the real device width.
  const deviceWidth = Math.min(
    measure.innerWidth,
    Math.max(measure.screenWidth, measure.screenHeight),
  )
  if (logicalWidth <= deviceWidth + LOGICAL_WIDTH_CHANGE_TOLERANCE_PIXELS) {
    return null
  }
  return logicalWidth
}

/** Keep the applied width while the wanted one only jitters around it. */
export function stableLogicalWidth(
  appliedWidth: number | null,
  wantedWidth: number | null,
): number | null {
  if (appliedWidth === null || wantedWidth === null) {
    return wantedWidth
  }
  const change = Math.abs(wantedWidth - appliedWidth)
  return change <= LOGICAL_WIDTH_CHANGE_TOLERANCE_PIXELS
    ? appliedWidth
    : wantedWidth
}

export function viewportMetaContent(logicalWidth: number | null): string {
  if (logicalWidth === null) {
    return DEVICE_VIEWPORT_META_CONTENT
  }
  return `width=${String(logicalWidth)}`
}

/**
 * CSS zoom for the app root. Stays unscaled when the meta tag already did
 * the scaling, and below the wide breakpoint where the narrow layout shows.
 */
export function viewportZoom(measure: ViewportMeasure): number {
  const logicalWidth = fittedLogicalWidth(measure)
  if (
    logicalWidth === null ||
    measure.innerWidth < VIEWPORT_WIDE_MIN_WIDTH_PIXELS ||
    measure.innerWidth + LOGICAL_WIDTH_CHANGE_TOLERANCE_PIXELS >= logicalWidth
  ) {
    return UNSCALED_ZOOM
  }
  return measure.innerWidth / logicalWidth
}

/** Viewport size in layout pixels as seen inside the zoomed app root. */
export function logicalViewportSize(
  measure: ViewportMeasure,
): ViewportPixelSize {
  const zoom = viewportZoom(measure)
  return {
    width: measure.innerWidth / zoom,
    height: measure.innerHeight / zoom,
  }
}

export function readWindowViewportMeasure(): ViewportMeasure {
  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }
}
