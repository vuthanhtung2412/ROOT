export type ClearingIndicatorSource = {
  ruin?: { items: string[] }
}

export const RUIN_MARKER_LABEL = 'R'

/** True when clearing still has ruin items (not yet explored). */
export function clearingHasRuin(clearing: ClearingIndicatorSource | undefined): boolean {
  if (clearing === undefined) {
    return false
  }
  const items = clearing.ruin?.items
  return items !== undefined && items.length > 0
}
