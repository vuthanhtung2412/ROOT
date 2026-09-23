/** Fall map building slots per clearing (Autumn). Mirrors lib/src/map/fall.ts. */
export const FALL_CLEARING_SLOT_COUNTS = [
  1, 2, 1, 1, 2, 2, 2, 2, 2, 2, 3, 2,
] as const

export type ClearingIndicatorSource = {
  pieces?: Array<{ kind: string }>
  ruin?: { items: string[] }
}

export const RUIN_MARKER_LABEL = 'R'

/** Open building slots: map slots minus buildings minus ruin occupancy. */
export function clearingOpenSlotCount(
  clearingId: number,
  clearing: ClearingIndicatorSource | undefined,
): number {
  const slotCapacity = FALL_CLEARING_SLOT_COUNTS[clearingId]
  if (slotCapacity === undefined) {
    return 0
  }
  const pieces = clearing?.pieces ?? []
  const buildingCount = pieces.filter((piece) => piece.kind === 'building').length
  const ruinOccupies = clearingHasRuin(clearing) ? 1 : 0
  const openSlots = slotCapacity - buildingCount - ruinOccupies
  return openSlots > 0 ? openSlots : 0
}

/** True when clearing still has ruin items (not yet explored). */
export function clearingHasRuin(clearing: ClearingIndicatorSource | undefined): boolean {
  if (clearing === undefined) {
    return false
  }
  const items = clearing.ruin?.items
  return items !== undefined && items.length > 0
}
