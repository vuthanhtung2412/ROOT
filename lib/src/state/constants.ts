import type { FactionId, ItemType } from '../pieces/types.js'

/** Seat order = join order = setup A→D: marquise → eyrie → alliance → vagabond. */
export const DEFAULT_FACTIONS: FactionId[] = ['marquise', 'eyrie']

/** Rule: Setup 5 — item supply on map. */
export const ITEM_SUPPLY: Record<ItemType, number> = {
  boot: 2,
  bag: 2,
  crossbow: 1,
  hammer: 1,
  sword: 2,
  tea: 2,
  coin: 2,
  torch: 0,
}

/** Rule: Vagabond > Setup 4 — one item under each ruin. */
export const RUIN_ITEMS: ItemType[] = ['bag', 'boot', 'hammer', 'sword']

/** Rule: Cards — hand limit. */
export const HAND_LIMIT = 5

/** Rule: Setup 2 — starting hand size. */
export const STARTING_HAND = 3
