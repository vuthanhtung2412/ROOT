import { describe, expect, it } from 'vitest'
import {
  buildItemSupplyRows,
  countItemsInSupply,
  type ItemSupplyCounts,
  type ItemSupplyRow,
} from '#ui/itemSupply.ts'

function makeItemSupply(overrides: ItemSupplyCounts = {}): ItemSupplyCounts {
  return {
    boot: 2,
    bag: 2,
    crossbow: 1,
    hammer: 1,
    sword: 2,
    tea: 2,
    coin: 2,
    torch: 0,
    ...overrides,
  }
}

function rowOf(rows: readonly ItemSupplyRow[], itemType: string): ItemSupplyRow {
  const row: ItemSupplyRow | undefined = rows.find(
    (candidate: ItemSupplyRow): boolean => candidate.itemType === itemType,
  )
  if (row === undefined) {
    throw new Error(`no row for ${itemType}`)
  }
  return row
}

describe('buildItemSupplyRows', () => {
  it('Rule: 5.1 Step 5 — a full supply holds the 12 starting items', () => {
    const rows: ItemSupplyRow[] = buildItemSupplyRows(makeItemSupply())

    expect(rows.map((row: ItemSupplyRow): string => row.itemType)).toEqual([
      'boot',
      'bag',
      'crossbow',
      'hammer',
      'sword',
      'tea',
      'coin',
    ])
    expect(countItemsInSupply(makeItemSupply())).toBe(12)
  })

  it('keeps an exhausted item in the list with nothing remaining', () => {
    const rows: ItemSupplyRow[] = buildItemSupplyRows(makeItemSupply({ tea: 0 }))

    expect(rowOf(rows, 'tea')).toEqual({
      itemType: 'tea',
      name: 'Tea',
      remaining: 0,
      total: 2,
    })
    expect(countItemsInSupply(makeItemSupply({ tea: 0 }))).toBe(10)
  })

  it('shows every item as taken when the state carries no supply', () => {
    const rows: ItemSupplyRow[] = buildItemSupplyRows(undefined)

    expect(rows.every((row: ItemSupplyRow): boolean => row.remaining === 0)).toBe(
      true,
    )
    expect(rowOf(rows, 'crossbow').total).toBe(1)
  })
})
