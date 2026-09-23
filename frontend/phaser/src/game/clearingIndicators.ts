import { FALL_CLEARING_SLOT_COUNTS } from '@root/lib/map/fallSlots'

export { FALL_CLEARING_SLOT_COUNTS }

export type ClearingIndicatorSource = {
  pieces?: Array<{ kind: string }>
  ruin?: { items: string[] }
}

/** Phaser texture key for remaining-ruin marker (see public/assets/markers/). */
export const RUIN_MARKER_TEXTURE_KEY = 'marker-ruin'

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
  // Rule: Board > Slots — ruins occupy one slot (match lib openSlots).
  const ruinOccupies = clearing?.ruin !== undefined ? 1 : 0
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
