import { describe, expect, it } from 'vitest'
import {
  boardEffectsBetween,
  type BoardEffectClearing,
  type BoardEffectPiece,
} from '#game/boardEffects.ts'
import {
  pawnForestMovesBetween,
  withPawnForestMoves,
  type PawnEffectState,
} from '#game/pawnForestMoves.ts'

const VAGABOND_SEAT = 1
const START_FOREST = 2
const OTHER_FOREST = 5
const TARGET_CLEARING = 1
const PAWN: BoardEffectPiece = {
  id: `pawn-${String(VAGABOND_SEAT)}`,
  kind: 'pawn',
  owner: VAGABOND_SEAT,
}

type PawnPlace = { forest: number } | { clearing: number }

/** Three clearings; the Vagabond pawn in a forest or on a clearing. */
function stateWithPawn(place: PawnPlace): PawnEffectState {
  const clearings: BoardEffectClearing[] = [0, 1, 2].map(
    (clearingId: number): BoardEffectClearing => ({
      pieces: 'clearing' in place && place.clearing === clearingId ? [PAWN] : [],
    }),
  )
  return {
    id: 'game',
    clearings,
    pending: [],
    players: [
      { seat: 0, board: { kind: 'marquise' } },
      {
        seat: VAGABOND_SEAT,
        board: {
          kind: 'vagabond',
          character: 'thief',
          forest: 'forest' in place ? place.forest : null,
        },
      },
    ],
  }
}

describe('pawnForestMovesBetween', () => {
  it('tells a slip out of a forest as a move onto the clearing', () => {
    expect(
      pawnForestMovesBetween(
        stateWithPawn({ forest: START_FOREST }),
        stateWithPawn({ clearing: TARGET_CLEARING }),
      ),
    ).toMatchObject([
      {
        kind: 'move',
        fromForest: START_FOREST,
        to: TARGET_CLEARING,
        owner: VAGABOND_SEAT,
        pieceKind: 'pawn',
        pieceType: 'thief',
        count: 1,
      },
    ])
  })

  it('tells a slip into a forest and from forest to forest', () => {
    expect(
      pawnForestMovesBetween(
        stateWithPawn({ clearing: TARGET_CLEARING }),
        stateWithPawn({ forest: START_FOREST }),
      ),
    ).toMatchObject([{ from: TARGET_CLEARING, toForest: START_FOREST }])
    expect(
      pawnForestMovesBetween(
        stateWithPawn({ forest: START_FOREST }),
        stateWithPawn({ forest: OTHER_FOREST }),
      ),
    ).toMatchObject([{ fromForest: START_FOREST, toForest: OTHER_FOREST }])
  })

  it('leaves clearing-to-clearing moves and a still pawn alone', () => {
    expect(
      pawnForestMovesBetween(
        stateWithPawn({ clearing: 0 }),
        stateWithPawn({ clearing: TARGET_CLEARING }),
      ),
    ).toEqual([])
    expect(
      pawnForestMovesBetween(
        stateWithPawn({ forest: START_FOREST }),
        stateWithPawn({ forest: START_FOREST }),
      ),
    ).toEqual([])
  })
})

describe('withPawnForestMoves', () => {
  it('replaces the placed pawn of a slip with the move', () => {
    const previous = stateWithPawn({ forest: START_FOREST })
    const next = stateWithPawn({ clearing: TARGET_CLEARING })
    const compared = boardEffectsBetween(previous, next)
    expect(compared.map((effect) => effect.kind)).toEqual(['place'])
    expect(
      withPawnForestMoves(compared, previous, next).map(
        (effect) => effect.kind,
      ),
    ).toEqual(['move'])
  })

  it('replaces the removed pawn of a slip into a forest with the move', () => {
    const previous = stateWithPawn({ clearing: TARGET_CLEARING })
    const next = stateWithPawn({ forest: START_FOREST })
    expect(
      withPawnForestMoves(
        boardEffectsBetween(previous, next),
        previous,
        next,
      ).map((effect) => effect.kind),
    ).toEqual(['move'])
  })
})
