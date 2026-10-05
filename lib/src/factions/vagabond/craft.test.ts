import { describe, expect, it } from 'vitest'
import { VAGABOND } from '#factions/Vagabond.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import { createFactionBoard } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import {
  card,
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

const VAGABOND_SEAT = 1
/** Swap Meet — persistent, costs one rabbit. */
const RABBIT_COST_CARD = card('ROOT-103')
const RABBIT_CLEARING: ClearingId = FALL.clearings.findIndex(
  (clearing) => clearing.suit === 'rabbit',
)
const MOUSE_CLEARING: ClearingId = FALL.clearings.findIndex(
  (clearing) => clearing.suit === 'mouse',
)

function stateWithVagabondIn(clearing: ClearingId): GameState {
  const board = createFactionBoard('vagabond')
  if (board.kind !== 'vagabond') throw new Error('expected vagabond board')
  board.satchel = [{ type: 'hammer', exhausted: false }]
  return withPieces(
    minimalState({
      factions: ['marquise', 'vagabond'],
      players: [
        player(0, 'marquise'),
        player(VAGABOND_SEAT, 'vagabond', { board, hand: [RABBIT_COST_CARD] }),
      ],
      currentSeat: VAGABOND_SEAT,
      phase: 'daylight',
      step: 'actions',
    }),
    clearing,
    [{ id: 'pawn-1', kind: 'pawn', owner: VAGABOND_SEAT }],
  )
}

function craftableCardIds(state: GameState): unknown {
  const craftSpec = VAGABOND.legalActions(state, testContext({ state })).find(
    (spec) => spec.type === 'vbCraft',
  )
  return craftSpec?.params?.cardIds
}

describe('Vagabond craft', () => {
  it('Rule: 9.5.8 Craft — hammers pay a cost matching the current clearing', () => {
    const state = stateWithVagabondIn(RABBIT_CLEARING)

    expect(craftableCardIds(state)).toEqual([RABBIT_COST_CARD.id])
  })

  it('Rule: 9.5.8 Craft — hammers cannot pay a cost of another suit', () => {
    const state = stateWithVagabondIn(MOUSE_CLEARING)

    expect(craftableCardIds(state)).toBeUndefined()
    expect(() =>
      VAGABOND.apply(
        state,
        { type: 'vbCraft', cardId: RABBIT_COST_CARD.id },
        testContext({ state }),
      ),
    ).toThrow('CANNOT_CRAFT')
  })
})
