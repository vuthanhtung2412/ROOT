import { describe, expect, it, beforeEach } from 'vitest'
import { warriors } from '../queries/pieces.js'
import { keepCornerFor } from '../factions/Marquise.js'
import { resetPlaceIds } from '../rules/place.js'
import { card, minimalState, player, testContext, withPieces } from '../test/fixtures.js'
import { fieldHospitalResolver } from './fieldHospital.js'
import type { FieldHospitalEvent } from './types.js'

describe('fieldHospitalResolver', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Marquise > Field Hospitals — pay matching card or decline; bird ok', () => {
    const base = minimalState({
      players: [
        player(0, 'marquise', {
          hand: [card('ROOT-200'), card('ROOT-209')],
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
    const state = withPieces(base, keep, [{ id: 'keep', kind: 'token', owner: 0, type: 'keep' }])
    const event: FieldHospitalEvent = {
      type: 'fieldHospital',
      victim: 0,
      clearing: keep,
      count: 2,
    }
    state.pending = [event]
    const context = testContext()
    fieldHospitalResolver.apply(
      state,
      event,
      { type: 'resolveEvent', cardId: 'ROOT-200#1' },
      0,
      context,
    )
    expect(state.pending).toHaveLength(0)
    expect(warriors(state, keep, 0)).toBe(2)
    expect(state.players[0]!.hand).toHaveLength(1)
    if (state.players[0]!.board.kind === 'marquise') {
      // Must not drain supply — warriors were already off the map.
      expect(state.players[0]!.board.supply.warriors).toBe(20)
    }
  })

  it('Rule: Marquise > Field Hospitals — decline sends warriors to supply', () => {
    const state = withPieces(
      minimalState({
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
      }),
      0,
      [{ id: 'keep', kind: 'token', owner: 0, type: 'keep' }],
    )
    const event: FieldHospitalEvent = {
      type: 'fieldHospital',
      victim: 0,
      clearing: 4,
      count: 2,
    }
    state.pending = [event]
    fieldHospitalResolver.apply(
      state,
      event,
      { type: 'resolveEvent', decline: true },
      0,
      testContext(),
    )
    expect(state.players[0]!.board.kind).toBe('marquise')
    if (state.players[0]!.board.kind === 'marquise') {
      expect(state.players[0]!.board.supply.warriors).toBe(22)
    }
  })
})
