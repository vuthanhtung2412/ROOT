import { describe, expect, it } from 'vitest'
import { minimalState, withPieces } from '../test/fixtures.js'
import { removePieces } from './remove.js'

describe('removePieces', () => {
  it('Rule: Victory — +1 VP per enemy building removed', () => {
    const state = withPieces(minimalState(), 4, [
      {
        id: 'b1',
        kind: 'building',
        owner: 1,
        type: 'sawmill',
        used: false,
      },
    ])
    const logs = removePieces(state, 4, ['b1'], 0)
    expect(state.players[0]!.vp).toBe(1)
    expect(logs.some((l) => l.t === 'vp')).toBe(true)
    expect(state.clearings[4]!.pieces).toHaveLength(0)
  })

  it('Rule: Victory — +1 VP per enemy token removed', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'wood1', kind: 'token', owner: 1, type: 'wood' },
    ])
    removePieces(state, 4, ['wood1'], 0)
    expect(state.players[0]!.vp).toBe(1)
  })

  it('Rule: Victory — no VP for removing own pieces', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'b0', kind: 'building', owner: 0, type: 'sawmill', used: false },
    ])
    removePieces(state, 4, ['b0'], 0)
    expect(state.players[0]!.vp).toBe(0)
  })
})
