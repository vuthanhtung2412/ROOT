/**
 * Boot / letterbox / page chrome behind wallpapers.
 * Keep in sync with `style.css` html/body/#root background.
 */
export const CANVAS_FALLBACK_HEX = '#121810'

/** CSS object-fit: cover scale for a source image into bounds. */
export function coverScaleForBounds(
  sourceWidth: number,
  sourceHeight: number,
  boundWidth: number,
  boundHeight: number,
): number {
  return Math.max(boundWidth / sourceWidth, boundHeight / sourceHeight)
}
