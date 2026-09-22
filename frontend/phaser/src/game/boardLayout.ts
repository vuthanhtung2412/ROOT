export type ClearingLayoutPoint = {
  x: number
  y: number
  r: number
}

export type BoardLayout = {
  clearings: Record<string, ClearingLayoutPoint>
}

export type ClearingSuit = 'fox' | 'mouse' | 'rabbit'

/** Autumn clearing suits — same as lib FallMap. */
export const FALL_CLEARING_SUITS: Readonly<Record<number, ClearingSuit>> = {
  0: 'fox',
  1: 'mouse',
  2: 'rabbit',
  3: 'rabbit',
  4: 'rabbit',
  5: 'fox',
  6: 'mouse',
  7: 'fox',
  8: 'mouse',
  9: 'rabbit',
  10: 'mouse',
  11: 'fox',
}

export function fallClearingSuit(clearingId: number): ClearingSuit | null {
  const suit = FALL_CLEARING_SUITS[clearingId]
  if (suit === undefined) {
    return null
  }
  return suit
}

/**
 * Fallback Autumn clearing coords (normalized 0–1).
 * Prefer live GET /map/fall/layout when available.
 * Hand-tuned against autumn-map.jpg board art.
 */
export const FALL_BOARD_LAYOUT: BoardLayout = {
  clearings: {
    '0': { x: 0.113, y: 0.119, r: 0.0715 },
    '1': { x: 0.881, y: 0.226, r: 0.0715 },
    '2': { x: 0.836, y: 0.868, r: 0.0715 },
    '3': { x: 0.104, y: 0.819, r: 0.0715 },
    '4': { x: 0.548, y: 0.097, r: 0.0715 },
    '5': { x: 0.894, y: 0.531, r: 0.0715 },
    '6': { x: 0.583, y: 0.78, r: 0.0715 },
    '7': { x: 0.354, y: 0.912, r: 0.0715 },
    '8': { x: 0.108, y: 0.387, r: 0.0715 },
    '9': { x: 0.437, y: 0.294, r: 0.0715 },
    '10': { x: 0.645, y: 0.497, r: 0.0715 },
    '11': { x: 0.313, y: 0.545, r: 0.0715 },
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
