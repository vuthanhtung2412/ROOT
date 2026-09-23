import { describe, expect, it } from 'vitest'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { minimalState, withPieces } from '#test/fixtures.js'

describe('enemySeatsInClearing', () => {
  it('Rule: Battle 4.3 — includes warrior and pawn enemies', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w0', kind: 'warrior', owner: 0 },
      { id: 'w1', kind: 'warrior', owner: 1 },
      { id: 'p1', kind: 'pawn', owner: 1 },
    ])
    expect(enemySeatsInClearing(state, 4, 0).sort()).toEqual([1])
  })

  it('Rule: Battle 4.3.3.II — includes building-only and token-only enemies', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w0', kind: 'warrior', owner: 0 },
      { id: 'b1', kind: 'building', owner: 1, type: 'sawmill' },
      { id: 't1', kind: 'token', owner: 1, type: 'wood' },
    ])
    expect(enemySeatsInClearing(state, 4, 0).sort()).toEqual([1])
  })

  it('excludes own pieces', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w0', kind: 'warrior', owner: 0 },
      { id: 'b0', kind: 'building', owner: 0, type: 'workshop', used: false },
    ])
    expect(enemySeatsInClearing(state, 4, 0)).toEqual([])
  })
})
