/** Logical game design size (coords, layout). */
export const GAME_LOGICAL_WIDTH = 1280
export const GAME_LOGICAL_HEIGHT = 720

/** Cap DPR so mid-tier GPUs not crushed (3x/4x phones). */
export const MAX_DEVICE_PIXEL_RATIO = 2

export function resolveDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1
  }
  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
}

export function gameViewSize(): { width: number; height: number } {
  return {
    width: GAME_LOGICAL_WIDTH,
    height: GAME_LOGICAL_HEIGHT,
  }
}
