import { describe, expect, it } from 'vitest'
import {
  applyMarchMovesToClearings,
  type ClearingPiecesSnapshot,
} from '#game/marchClearingsPreview.ts'

function makeClearings(
  warriorsByClearing: ReadonlyMap<number, readonly string[]>,
  clearingCount: number,
): ClearingPiecesSnapshot[] {
  const clearings: ClearingPiecesSnapshot[] = []
  for (let clearingId = 0; clearingId < clearingCount; clearingId += 1) {
    const warriorIds = warriorsByClearing.get(clearingId) ?? []
    clearings.push({
      pieces: warriorIds.map((id) => ({
        id,
        kind: 'warrior',
        owner: 0,
      })),
    })
  }
  return clearings
}

describe('applyMarchMovesToClearings', () => {
  it('moves warriors for one march leg', () => {
    const before = makeClearings(
      new Map([
        [0, ['w1', 'w2']],
        [4, []],
      ]),
      5,
    )
    before[4] = {
      pieces: [{ id: 'keep', kind: 'token', owner: 0, type: 'keep' }],
    }

    const after = applyMarchMovesToClearings(before, 0, [
      { from: 0, to: 4, count: 1 },
    ])

    expect(after[0]?.pieces.map((piece) => piece.id)).toEqual(['w2'])
    expect(after[4]?.pieces.map((piece) => piece.id)).toEqual(['keep', 'w1'])
    // Original untouched
    expect(before[0]?.pieces).toHaveLength(2)
  })

  it('applies sequential legs (second uses arrived warriors)', () => {
    const before = makeClearings(
      new Map([
        [0, ['w1', 'w2']],
        [4, []],
        [9, []],
      ]),
      10,
    )

    const after = applyMarchMovesToClearings(before, 0, [
      { from: 0, to: 4, count: 2 },
      { from: 4, to: 9, count: 1 },
    ])

    expect(after[0]?.pieces).toHaveLength(0)
    expect(after[4]?.pieces.map((piece) => piece.id)).toEqual(['w2'])
    expect(after[9]?.pieces.map((piece) => piece.id)).toEqual(['w1'])
  })

  it('leaves board unchanged when not enough warriors', () => {
    const before = makeClearings(new Map([[0, ['w1']]]), 2)
    const after = applyMarchMovesToClearings(before, 0, [
      { from: 0, to: 1, count: 2 },
    ])
    expect(after[0]?.pieces.map((piece) => piece.id)).toEqual(['w1'])
    expect(after[1]?.pieces).toHaveLength(0)
  })

  it('copies used only for crafting buildings', () => {
    const before: ClearingPiecesSnapshot[] = [
      {
        pieces: [
          {
            id: 'saw',
            kind: 'building',
            owner: 0,
            type: 'sawmill',
            used: true,
          },
          {
            id: 'shop',
            kind: 'building',
            owner: 0,
            type: 'workshop',
            used: true,
          },
          { id: 'w1', kind: 'warrior', owner: 0 },
        ],
      },
      { pieces: [] },
    ]
    const after = applyMarchMovesToClearings(before, 0, [
      { from: 0, to: 1, count: 1 },
    ])
    const remaining = after[0]?.pieces ?? []
    const sawmill = remaining.find((piece) => piece.id === 'saw')
    const workshop = remaining.find((piece) => piece.id === 'shop')
    expect(sawmill?.used).toBeUndefined()
    expect(workshop?.used).toBe(true)
  })
})
