import { describe, expect, it, beforeEach } from 'vitest'
import { FALL } from '#map/fall.js'
import { canPlace } from '#queries/place.js'
import { resetPlaceIds } from '#rules/place.js'
import { eyrieBoard, card, minimalState, player, withPieces } from '#test/fixtures.js'
import { removePieces } from '#rules/remove.js'

describe('removePieces', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Victory — +1 VP per enemy building removed', () => {
    const state = withPieces(minimalState(), 4, [
      {
        id: 'b1',
        kind: 'building',
        owner: 1,
        type: 'sawmill',
      },
    ])
    const logs = removePieces(state, { clearing: 4, pieceIds: ['b1'], scorer: 0 })
    expect(state.players[0]!.vp).toBe(1)
    expect(logs.some((l) => l.t === 'vp')).toBe(true)
    expect(state.clearings[4]!.pieces).toHaveLength(0)
  })

  it('Rule: Victory — +1 VP per enemy token removed', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise'),
          player(1, 'marquise', {
            board: {
              kind: 'marquise',
              supply: { warriors: 25, wood: 5 },
              tracks: {
                sawmill: { placed: 5 },
                workshop: { placed: 5 },
                recruiter: { placed: 5 },
              },
            },
          }),
        ],
      }),
      4,
      [{ id: 'wood1', kind: 'token', owner: 1, type: 'wood' }],
    )
    removePieces(state, { clearing: 4, pieceIds: ['wood1'], scorer: 0 })
    expect(state.players[0]!.vp).toBe(1)
    if (state.players[1]!.board.kind === 'marquise') {
      expect(state.players[1]!.board.supply.wood).toBe(6)
    }
  })

  it('Rule: Glossary > Return — destroyed Marquise building returns to track', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'marquise'),
          player(1, 'marquise', {
            board: {
              kind: 'marquise',
              supply: { warriors: 25, wood: 8 },
              tracks: {
                sawmill: { placed: 4 },
                workshop: { placed: 5 },
                recruiter: { placed: 5 },
              },
            },
          }),
        ],
      }),
      4,
      [{ id: 'b1', kind: 'building', owner: 1, type: 'sawmill' }],
    )
    removePieces(state, { clearing: 4, pieceIds: ['b1'], scorer: 0 })
    if (state.players[1]!.board.kind === 'marquise') {
      expect(state.players[1]!.board.tracks.sawmill.placed).toBe(5)
    }
  })

  it('Rule: Victory — no VP for removing own pieces', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'b0', kind: 'building', owner: 0, type: 'sawmill' },
    ])
    removePieces(state, { clearing: 4, pieceIds: ['b0'], scorer: 0 })
    expect(state.players[0]!.vp).toBe(0)
  })

  it('Rule: Marquise > Field Hospitals — removePieces enqueues when victim has keep and card', () => {
    const base = minimalState({
      players: [
        player(0, 'marquise', {
          hand: [card('ROOT-200')],
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
    const keep = FALL.corners[0]!
    const state = withPieces(
      withPieces(base, keep, [{ id: 'keep', kind: 'token', owner: 0, type: 'keep' }]),
      4,
      [{ id: 'w1', kind: 'warrior', owner: 0 }],
    )
    removePieces(state, { clearing: 4, pieceIds: ['w1'], scorer: 1 })
    expect(state.pending).toHaveLength(1)
    expect(state.pending[0]!.type).toBe('fieldHospital')
    if (state.players[0]!.board.kind === 'marquise') {
      expect(state.players[0]!.board.supply.warriors).toBe(20)
    }
  })

  it('Rule: Marquise > Field Hospitals — no card auto-declines to supply', () => {
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
    const keep = FALL.corners[0]!
    const state = withPieces(
      withPieces(base, keep, [{ id: 'keep', kind: 'token', owner: 0, type: 'keep' }]),
      4,
      [{ id: 'w1', kind: 'warrior', owner: 0 }],
    )
    removePieces(state, { clearing: 4, pieceIds: ['w1'], scorer: 1 })
    expect(state.pending).toHaveLength(0)
    if (state.players[0]!.board.kind === 'marquise') {
      expect(state.players[0]!.board.supply.warriors).toBe(21)
    }
  })

  it('Rule: Marquise > The Keep — token never returns; canPlace opens', () => {
    const state = withPieces(minimalState(), 0, [
      { id: 'keep', kind: 'token', owner: 0, type: 'keep' },
    ])
    removePieces(state, { clearing: 0, pieceIds: ['keep'], scorer: 1 })
    expect(canPlace(state, 1, 0)).toBe(true)
    expect(state.clearings[0]!.pieces).toHaveLength(0)
  })

  it('Rule: 7.8.4 Despot — +1 extra VP when battle removes building/token', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'eyrie', { board: eyrieBoard({ leader: 'despot' }) }),
          player(1, 'marquise'),
        ],
      }),
      4,
      [
        {
          id: 'b1',
          kind: 'building',
          owner: 1,
          type: 'sawmill',
        },
      ],
    )
    removePieces(
      state,
      { clearing: 4, pieceIds: ['b1'], scorer: 0, options: { fromBattle: true } },
    )
    // 1 from 3.2.1 + 1 Despot
    expect(state.players[0]!.vp).toBe(2)
  })

  it('Rule: 7.8.4 Despot — no bonus outside battle', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'eyrie', { board: eyrieBoard({ leader: 'despot' }) }),
          player(1, 'marquise'),
        ],
      }),
      4,
      [
        {
          id: 'b1',
          kind: 'building',
          owner: 1,
          type: 'sawmill',
        },
      ],
    )
    removePieces(state, { clearing: 4, pieceIds: ['b1'], scorer: 0 })
    expect(state.players[0]!.vp).toBe(1)
  })

  it('Rule: 7.8.4 Despot — warriors-only remove grants no bonus', () => {
    const state = withPieces(
      minimalState({
        players: [
          player(0, 'eyrie', { board: eyrieBoard({ leader: 'despot' }) }),
          player(1, 'marquise'),
        ],
      }),
      4,
      [{ id: 'w1', kind: 'warrior', owner: 1 }],
    )
    removePieces(
      state,
      {
        clearing: 4,
        pieceIds: ['w1'],
        scorer: 0,
        options: { fromBattle: true, skipFieldHospital: true },
      },
    )
    expect(state.players[0]!.vp).toBe(0)
  })
})
