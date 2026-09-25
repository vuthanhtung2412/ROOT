import {
  FALL_CLEARING_SUITS as PUBLIC_FALL_CLEARING_SUITS,
  FALL_LAYOUT_CLEARINGS,
} from '@root/lib/fall-metadata'

export type ClearingLayoutPoint = {
  x: number
  y: number
  r: number
}

export type BoardLayout = {
  clearings: Record<string, ClearingLayoutPoint>
}

export type ClearingSuit = 'fox' | 'mouse' | 'rabbit'

export const FALL_CLEARING_SUITS: readonly ClearingSuit[] =
  PUBLIC_FALL_CLEARING_SUITS

export function fallClearingSuit(clearingId: number): ClearingSuit | null {
  const suit = FALL_CLEARING_SUITS[clearingId]
  if (suit === undefined) {
    return null
  }
  return suit
}

export const FALL_BOARD_LAYOUT: BoardLayout = {
  clearings: Object.fromEntries(
    Object.entries(FALL_LAYOUT_CLEARINGS).map(
      ([clearingId, point]): [string, ClearingLayoutPoint] => [
        clearingId,
        point,
      ],
    ),
  ),
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
