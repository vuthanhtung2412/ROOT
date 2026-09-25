/** Viewport chrome layout for landscape vs portrait. */

export type ViewportLayoutMode = 'landscape' | 'portrait'

/** Portrait: reserve top for turn banner + player rail. */
export const PORTRAIT_MAP_TOP_INSET_PIXELS = 128

/** Portrait: reserve bottom for hand, status, drawer, tray. */
export const PORTRAIT_MAP_BOTTOM_INSET_PIXELS = 200

export const PORTRAIT_MAP_HORIZONTAL_INSET_PIXELS = 10

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
