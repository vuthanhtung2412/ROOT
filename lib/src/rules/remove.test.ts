import { describe, expect, it, beforeEach } from 'vitest'
import { keepCornerFor } from '../factions/Marquise.js'
import { canPlace } from '../queries/place.js'
import { resetPlaceIds } from './place.js'
import { minimalState, player, withPieces } from '../test/fixtures.js'
import { removePieces } from './remove.js'

describe('removePieces', () => {
  beforeEach(() => resetPlaceIds())

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

  it('Rule: Marquise > Field Hospitals — removePieces enqueues when victim has keep', () => {
    const base = minimalState({
      players: [
        player(0, 'marquise', {
          board: {
            kind: 'marquise',
            supply: { warriors: 20, wood: 8 },
            tracks: {
              sawmill: { placed: 5 },
              workshop: { placed: 5 },
              recruiter: { placed: 5 },
            },
          },
        }),
        player(1, 'marquise'),
      ],
    })
    const keep = keepCornerFor(base, 0)
    const state = withPieces(
      withPieces(base, keep, [{ id: 'keep', kind: 'token', owner: 0, type: 'keep' }]),
      4,
      [{ id: 'w1', kind: 'warrior', owner: 0 }],
    )
    removePieces(state, 4, ['w1'], 1)
    expect(state.pending).toHaveLength(1)
    expect(state.pending[0]!.type).toBe('fieldHospital')
    if (state.players[0]!.board.kind === 'marquise') {
      expect(state.players[0]!.board.supply.warriors).toBe(20)
    }
  })

  it('Rule: Marquise > The Keep — token never returns; canPlace opens', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'keep', kind: 'token', owner: 0, type: 'keep' },
    ])
    removePieces(state, 0, ['keep'], 1)
    expect(canPlace(state, 1, 0)).toBe(true)
    expect(state.clearings[0]!.pieces).toHaveLength(0)
  })
})
