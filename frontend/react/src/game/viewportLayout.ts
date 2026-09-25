/** Viewport chrome layout for landscape vs portrait. */

export type ViewportLayoutMode = 'landscape' | 'portrait'

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
