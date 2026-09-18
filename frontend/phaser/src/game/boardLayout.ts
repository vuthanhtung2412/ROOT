export type ClearingLayoutPoint = {
  x: number
  y: number
  r: number
}

export type BoardLayout = {
  clearings: Record<string, ClearingLayoutPoint>
}

/**
 * Fallback Autumn clearing coords (normalized 0–1).
 * Prefer live GET /map/fall/layout when available.
 */
export const FALL_BOARD_LAYOUT: BoardLayout = {
  clearings: {
    '0': { x: 0.175, y: 0.175, r: 0.048 },
    '1': { x: 0.825, y: 0.185, r: 0.048 },
    '2': { x: 0.83, y: 0.705, r: 0.048 },
    '3': { x: 0.17, y: 0.705, r: 0.048 },
    '4': { x: 0.5, y: 0.155, r: 0.045 },
    '5': { x: 0.79, y: 0.4, r: 0.045 },
    '6': { x: 0.64, y: 0.665, r: 0.045 },
    '7': { x: 0.36, y: 0.68, r: 0.045 },
    '8': { x: 0.135, y: 0.405, r: 0.045 },
    '9': { x: 0.365, y: 0.31, r: 0.045 },
    '10': { x: 0.635, y: 0.47, r: 0.05 },
    '11': { x: 0.43, y: 0.51, r: 0.05 },
  },
}

export type BoardPixelBounds = {
  originX: number
  originY: number
  width: number
  height: number
}

export type ClearingPixelHitTarget = {
  clearingId: number
  centerX: number
  centerY: number
  radius: number
}

export function layoutToPixelHitTargets(
  layout: BoardLayout,
  bounds: BoardPixelBounds,
): ClearingPixelHitTarget[] {
  const targets: ClearingPixelHitTarget[] = []
  for (const [key, point] of Object.entries(layout.clearings)) {
    const clearingId = Number(key)
    if (!Number.isInteger(clearingId)) {
      continue
    }
    targets.push({
      clearingId,
      centerX: bounds.originX + point.x * bounds.width,
      centerY: bounds.originY + point.y * bounds.height,
      radius: point.r * Math.min(bounds.width, bounds.height),
    })
  }
  return targets.sort((left, right) => left.clearingId - right.clearingId)
}

export function boardLayoutFromFallResponse(response: {
  clearings: Record<string, ClearingLayoutPoint>
}): BoardLayout {
  return { clearings: response.clearings }
}
