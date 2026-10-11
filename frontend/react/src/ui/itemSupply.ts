/**
 * Rule: 5.1 Step 5 — the item supply on the map: 2 boots, 2 bags, 1 crossbow,
 * 1 hammer, 2 swords, 2 teas, 2 coins. Order = the supply strip of the map.
 */
const STARTING_ITEM_SUPPLY: ReadonlyArray<readonly [string, number]> = [
  ['boot', 2],
  ['bag', 2],
  ['crossbow', 1],
  ['hammer', 1],
  ['sword', 2],
  ['tea', 2],
  ['coin', 2],
]

const ITEM_NAMES: Readonly<Record<string, string>> = {
  boot: 'Boot',
  bag: 'Bag',
  crossbow: 'Crossbow',
  hammer: 'Hammer',
  sword: 'Sword',
  tea: 'Tea',
  coin: 'Coin',
  torch: 'Torch',
}

/** One item type of the supply: how many are left of how many it started with. */
export type ItemSupplyRow = {
  itemType: string
  name: string
  remaining: number
  total: number
}

export type ItemSupplyCounts = Readonly<Record<string, number>>

export function itemName(itemType: string): string {
  return ITEM_NAMES[itemType] ?? itemType
}

/** Rows of the supply modal; a taken item still shows, as an empty slot. */
export function buildItemSupplyRows(
  supply: ItemSupplyCounts | undefined,
): ItemSupplyRow[] {
  return STARTING_ITEM_SUPPLY.map(
    ([itemType, startingCount]: readonly [string, number]): ItemSupplyRow => {
      const remaining: number = supply?.[itemType] ?? 0
      return {
        itemType,
        name: itemName(itemType),
        remaining,
        // A supply above its starting count (test snapshots) still fits its row.
        total: Math.max(startingCount, remaining),
      }
    },
  )
}

/** Items still in the supply, all types together. */
export function countItemsInSupply(supply: ItemSupplyCounts | undefined): number {
  return buildItemSupplyRows(supply).reduce(
    (sum: number, row: ItemSupplyRow): number => sum + row.remaining,
    0,
  )
}
