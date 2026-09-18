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
 * Hand-tuned against autumn-map.jpg board art.
 */
export const FALL_BOARD_LAYOUT: BoardLayout = {
  clearings: {
    '0': { x: 0.113, y: 0.119, r: 0.055 },
    '1': { x: 0.881, y: 0.226, r: 0.055 },
    '2': { x: 0.836, y: 0.868, r: 0.055 },
    '3': { x: 0.104, y: 0.819, r: 0.055 },
    '4': { x: 0.548, y: 0.097, r: 0.05 },
    '5': { x: 0.894, y: 0.531, r: 0.05 },
    '6': { x: 0.583, y: 0.78, r: 0.05 },
    '7': { x: 0.354, y: 0.912, r: 0.05 },
    '8': { x: 0.108, y: 0.387, r: 0.05 },
    '9': { x: 0.437, y: 0.294, r: 0.05 },
    '10': { x: 0.645, y: 0.497, r: 0.055 },
    '11': { x: 0.313, y: 0.545, r: 0.055 },
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
