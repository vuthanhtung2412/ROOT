/** Boot / letterbox / page chrome behind wallpapers. */
export const CANVAS_FALLBACK_HEX = '#24362e'

/** CSS object-fit: cover scale for a source image into bounds. */
export function coverScaleForBounds(
  sourceWidth: number,
  sourceHeight: number,
  boundWidth: number,
  boundHeight: number,
): number {
  return Math.max(boundWidth / sourceWidth, boundHeight / sourceHeight)
}
