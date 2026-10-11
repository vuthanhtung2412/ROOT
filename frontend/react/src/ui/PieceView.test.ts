import { describe, expect, it } from 'vitest'
import {
  BUILDING_PIECE_KIND,
  groupPiecesIntoStacks,
  type PieceViewModel,
} from '#ui/PieceView.ts'

function pieceFixture(
  overrides: Partial<PieceViewModel> & Pick<PieceViewModel, 'id' | 'kind'>,
): PieceViewModel {
  return {
    owner: 0,
    color: 0xff0000,
    factionId: 'marquise',
    ...overrides,
  }
}

describe('groupPiecesIntoStacks', () => {
  it('keeps each building as its own icon', () => {
    const stacks = groupPiecesIntoStacks([
      pieceFixture({
        id: 'sawmill-a',
        kind: BUILDING_PIECE_KIND,
        type: 'sawmill',
      }),
      pieceFixture({
        id: 'sawmill-b',
        kind: BUILDING_PIECE_KIND,
        type: 'sawmill',
      }),
    ])

    expect(stacks).toHaveLength(2)
    expect(stacks.every((stack) => stack.count === 1)).toBe(true)
    expect(stacks.map((stack) => stack.sampleIds[0])).toEqual([
      'sawmill-a',
      'sawmill-b',
    ])
  })

  it('still stacks warriors of the same owner', () => {
    const stacks = groupPiecesIntoStacks([
      pieceFixture({ id: 'w1', kind: 'warrior' }),
      pieceFixture({ id: 'w2', kind: 'warrior' }),
      pieceFixture({ id: 'w3', kind: 'warrior' }),
    ])

    expect(stacks).toHaveLength(1)
    expect(stacks[0]?.count).toBe(3)
  })
})
