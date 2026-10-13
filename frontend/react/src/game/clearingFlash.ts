/** A clearing the map points at for a moment: clicked in the game log. */
export type ClearingFlash = {
  clearingId: number
  /** Goes up with every flash, so the same clearing can flash again. */
  flashNumber: number
}

/** How long the soil of a flashed clearing takes to fade back. */
export const CLEARING_FLASH_MS = 1500
