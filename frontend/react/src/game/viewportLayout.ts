/** Viewport chrome layout for landscape vs portrait. */

export type ViewportLayoutMode = 'landscape' | 'portrait'

/** Portrait: reserve top for turn banner + player rail. */
export const PORTRAIT_MAP_TOP_INSET_PIXELS = 128

/** Portrait: reserve bottom for hand, status, drawer, tray. */
export const PORTRAIT_MAP_BOTTOM_INSET_PIXELS = 200

export const PORTRAIT_MAP_HORIZONTAL_INSET_PIXELS = 10

/**
 * Landscape playfield columns: VP rail | map | action tray.
 * Ratio 1-3-1 of viewport width.
 */
export const LANDSCAPE_PLAYFIELD_SIDE_WEIGHT = 1
export const LANDSCAPE_PLAYFIELD_CENTER_WEIGHT = 3
export const LANDSCAPE_PLAYFIELD_TOTAL_WEIGHT =
  LANDSCAPE_PLAYFIELD_SIDE_WEIGHT * 2 + LANDSCAPE_PLAYFIELD_CENTER_WEIGHT

export function landscapePlayfieldSideFraction(): number {
  return LANDSCAPE_PLAYFIELD_SIDE_WEIGHT / LANDSCAPE_PLAYFIELD_TOTAL_WEIGHT
}

export function landscapePlayfieldCenterFraction(): number {
  return LANDSCAPE_PLAYFIELD_CENTER_WEIGHT / LANDSCAPE_PLAYFIELD_TOTAL_WEIGHT
}

export function resolveViewportLayoutMode(
  width: number,
  height: number,
): ViewportLayoutMode {
  if (height > width) {
    return 'portrait'
  }
  return 'landscape'
}

export function readWindowViewportLayoutMode(): ViewportLayoutMode {
  if (typeof window === 'undefined') {
    return 'landscape'
  }
  return resolveViewportLayoutMode(window.innerWidth, window.innerHeight)
}

export function portraitMapHostSize(viewport: {
  width: number
  height: number
}): { width: number; height: number } {
  const width = Math.max(
    1,
    viewport.width - PORTRAIT_MAP_HORIZONTAL_INSET_PIXELS * 2,
  )
  const height = Math.max(
    1,
    viewport.height -
      PORTRAIT_MAP_TOP_INSET_PIXELS -
      PORTRAIT_MAP_BOTTOM_INSET_PIXELS,
  )
  return { width, height }
}

/** Map host = center column of landscape 1-3-1 playfield. */
export function landscapeMapHostSize(viewport: {
  width: number
  height: number
}): { width: number; height: number } {
  return {
    width: Math.max(
      1,
      Math.floor(viewport.width * landscapePlayfieldCenterFraction()),
    ),
    height: Math.max(1, viewport.height),
  }
}
