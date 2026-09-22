import { describe, expect, it, beforeEach } from 'vitest'
import { FALL } from '#map/fall.js'
import { marquiseBoard, minimalState, withPieces } from '#test/fixtures.js'
import { placeUpTo, resetPlaceIds } from '#rules/place.js'

describe('placeUpTo', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Pieces — place as much as possible if you cannot do the full amount', () => {
    const state = minimalState()
    const placed = placeUpTo(state, {
      seat: 0,
      clearing: 4,
      spec: { kind: 'warrior' },
      count: 5,
    })
    expect(placed).toBe(5)
    expect(state.clearings[4]!.pieces).toHaveLength(5)
    const board = state.players[0]!.board
    expect(board.kind === 'marquise' && board.supply.warriors).toBe(20)
  })

  it('Rule: Pieces — capped by supply', () => {
    const state = minimalState({
      players: [
        {
          ...minimalState().players[0]!,
          board: marquiseBoard({ warriors: 2 }),
        },
        minimalState().players[1]!,
      ],
    })
    const placed = placeUpTo(state, {
      seat: 0,
      clearing: 4,
      spec: { kind: 'warrior' },
      count: 10,
    })
    expect(placed).toBe(2)
  })

  it('Rule: Pieces — capped by open slots for buildings', () => {
    const state = minimalState()
    const placed = placeUpTo(state, {
      seat: 0,
      clearing: 0,
      spec: { kind: 'building', type: 'sawmill' },
      count: 3,
    })
    expect(placed).toBe(1)
    expect(state.clearings[0]!.pieces).toHaveLength(1)
  })

  it('Rule: Marquise > The Keep — enemy cannot place in keep clearing', () => {
    const keep = FALL.corners[0]!
    const state = withPieces(minimalState(), keep, [
      { id: 'k0', kind: 'token', owner: 0, type: 'keep' },
    ])
    expect(
      placeUpTo(state, { seat: 1, clearing: keep, spec: { kind: 'warrior' }, count: 1 }),
    ).toBe(0)
  })
})
