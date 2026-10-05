import { describe, expect, it } from 'vitest'
import { validateMarchMoves } from '#factions/marquise/rules.js'
import { moveWarriors } from '#rules/move.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'
import { minimalState, player, testContext, withPieces } from '#test/fixtures.js'

const MARQUISE_SEAT: Seat = 0
const ALLIANCE_SEAT: Seat = 1
const ORIGIN_CLEARING = 4
const SYMPATHETIC_CLEARING = 0

function stateWithSympatheticDestination(): GameState {
  const base: GameState = minimalState({
    factions: ['marquise', 'alliance'],
    players: [
      player(MARQUISE_SEAT, 'marquise'),
      player(ALLIANCE_SEAT, 'alliance'),
    ],
  })
  const withOrigin: GameState = withPieces(base, ORIGIN_CLEARING, [
    { id: 'warrior-origin', kind: 'warrior', owner: MARQUISE_SEAT },
  ])
  return withPieces(withOrigin, SYMPATHETIC_CLEARING, [
    { id: 'sympathy-destination', kind: 'token', type: 'sympathy', owner: ALLIANCE_SEAT },
  ])
}

describe('validateMarchMoves', () => {
  it('Rule: 8.2.5 Outrage — validating a march does not enqueue Outrage', () => {
    const state: GameState = stateWithSympatheticDestination()
    validateMarchMoves(
      state,
      MARQUISE_SEAT,
      [{ from: ORIGIN_CLEARING, to: SYMPATHETIC_CLEARING, count: 1 }],
      testContext({ state }),
    )
    expect(state.pending).toEqual([])
  })

  it('Rule: 8.2.5 Outrage — one move into sympathy enqueues exactly one Outrage', () => {
    const state: GameState = stateWithSympatheticDestination()
    const movement = { seat: MARQUISE_SEAT, from: ORIGIN_CLEARING, to: SYMPATHETIC_CLEARING, count: 1 }
    validateMarchMoves(state, MARQUISE_SEAT, [movement], testContext({ state }))
    moveWarriors(state, movement, testContext({ state }))
    expect(state.pending).toEqual([
      { type: 'outrage', offender: MARQUISE_SEAT, clearing: SYMPATHETIC_CLEARING },
    ])
  })
})
