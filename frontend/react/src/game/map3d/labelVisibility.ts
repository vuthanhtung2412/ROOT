/**
 * Zoomed in this far (0 = out, 1 = in) the 3D pieces stand at full size and
 * speak for themselves: the 2D piece icons and clearing suit badges hide,
 * and come back only for what the pointer is over.
 */
export const LABELS_ON_HOVER_FROM_ZOOM = 0.5

export type LabelVisibilityInput = {
  zoom: number
  isHovered: boolean
}

export function isLabelShown(input: LabelVisibilityInput): boolean {
  return input.zoom < LABELS_ON_HOVER_FROM_ZOOM || input.isHovered
}
