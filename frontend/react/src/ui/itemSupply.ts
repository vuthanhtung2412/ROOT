/**
 * Rule: 5.1 Step 5 — the item supply on the map: 2 boots, 2 bags, 1 crossbow,
 * 1 hammer, 2 swords, 2 teas, 2 coins. Order = the supply strip of the map
 * (left → right columns; two slots per column).
 */
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

/** Starting counts, list order for counts / tests. */
const STARTING_ITEM_SUPPLY: ReadonlyArray<readonly [string, number]> = [
  ['bag', 2],
  ['boot', 2],
  ['crossbow', 1],
  ['hammer', 1],
  ['sword', 2],
  ['tea', 2],
  ['coin', 2],
]

/**
 * Map strip columns (reference board art): pairs stack in a column; crossbow
 * sits above hammer in the mixed column.
 */
const SUPPLY_STRIP_COLUMNS: ReadonlyArray<
  | { kind: 'pair'; itemType: string }
  | { kind: 'mixed'; top: string; bottom: string }
> = [
  { kind: 'pair', itemType: 'bag' },
  { kind: 'pair', itemType: 'boot' },
  { kind: 'mixed', top: 'crossbow', bottom: 'hammer' },
  { kind: 'pair', itemType: 'sword' },
  { kind: 'pair', itemType: 'tea' },
  { kind: 'pair', itemType: 'coin' },
]

/** One item type of the supply: how many are left of how many it started with. */
export type ItemSupplyRow = {
  itemType: string
  name: string
  remaining: number
  total: number
}

/** One framed slot of the map strip (top or bottom of a column). */
export type ItemSupplySlot = {
  itemType: string
  name: string
  inSupply: boolean
}

/** One column of the 2×6 map strip. */
export type ItemSupplyColumn = {
  key: string
  top: ItemSupplySlot
  bottom: ItemSupplySlot
}

export type ItemSupplyCounts = Readonly<Record<string, number>>

export function itemName(itemType: string): string {
  return ITEM_NAMES[itemType] ?? itemType
}

function startingTotal(itemType: string): number {
  const found: readonly [string, number] | undefined = STARTING_ITEM_SUPPLY.find(
    ([type]: readonly [string, number]): boolean => type === itemType,
  )
  return found?.[1] ?? 0
}

function remainingOf(
  supply: ItemSupplyCounts | undefined,
  itemType: string,
): number {
  if (supply === undefined) return 0
  return supply[itemType] ?? 0
}

function slot(
  itemType: string,
  inSupply: boolean,
): ItemSupplySlot {
  return { itemType, name: itemName(itemType), inSupply }
}

/**
 * 2×6 map strip: six columns, top and bottom slots. Taken items keep an empty
 * frame so the tray shape stays.
 */
export function buildItemSupplyGrid(
  supply: ItemSupplyCounts | undefined,
): ItemSupplyColumn[] {
  return SUPPLY_STRIP_COLUMNS.map((column): ItemSupplyColumn => {
    if (column.kind === 'mixed') {
      return {
        key: `${column.top}-${column.bottom}`,
        top: slot(column.top, remainingOf(supply, column.top) > 0),
        bottom: slot(column.bottom, remainingOf(supply, column.bottom) > 0),
      }
    }
    const remaining: number = remainingOf(supply, column.itemType)
    return {
      key: column.itemType,
      top: slot(column.itemType, remaining >= 1),
      bottom: slot(column.itemType, remaining >= 2),
    }
  })
}

/** Rows of the supply (one per item type); a taken item still shows as empty. */
export function buildItemSupplyRows(
  supply: ItemSupplyCounts | undefined,
): ItemSupplyRow[] {
  return STARTING_ITEM_SUPPLY.map(
    ([itemType, startingCount]: readonly [string, number]): ItemSupplyRow => {
      const remaining: number = remainingOf(supply, itemType)
      return {
        itemType,
        name: itemName(itemType),
        remaining,
        // A supply above its starting count (test snapshots) still fits its row.
        total: Math.max(startingCount, remaining, startingTotal(itemType)),
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
