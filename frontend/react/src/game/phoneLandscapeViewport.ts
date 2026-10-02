import { GAME_LOGICAL_HEIGHT } from '#game/hiDpi.ts'

/**
 * Phone held sideways: lay the page out at the wide design height and let
 * the browser scale it down to the screen, instead of squeezing wide chrome
 * into a short viewport.
 */

/** Shorter screen side at or below this = phone (tablets and desktops are larger). */
export const PHONE_SCREEN_SHORT_SIDE_MAX_PIXELS = 500

export const DEVICE_VIEWPORT_META_CONTENT =
  'width=device-width, initial-scale=1.0'

/** Ignore small ratio jitter (browser bars, rounding) so the scale stays put. */
export const LOGICAL_WIDTH_CHANGE_TOLERANCE_PIXELS = 24

export type ViewportMeasure = {
  screenWidth: number
  screenHeight: number
  innerWidth: number
  innerHeight: number
}

/**
 * Layout width that makes the viewport `GAME_LOGICAL_HEIGHT` tall at the
 * current aspect ratio. Null when the device is not a sideways phone.
 */
export function phoneLandscapeLogicalWidth(
  measure: ViewportMeasure,
): number | null {
  const screenShortSide = Math.min(measure.screenWidth, measure.screenHeight)
  const isPhone = screenShortSide <= PHONE_SCREEN_SHORT_SIDE_MAX_PIXELS
  const isSideways = measure.innerWidth > measure.innerHeight
  if (!isPhone || !isSideways || measure.innerHeight <= 0) {
    return null
  }
  const aspectRatio = measure.innerWidth / measure.innerHeight
  return Math.round(GAME_LOGICAL_HEIGHT * aspectRatio)
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
