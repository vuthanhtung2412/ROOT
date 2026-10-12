import { describe, expect, it } from 'vitest'
import {
  NO_STACK_SLOT,
  type BoardEffect,
  type BoardEffectBatch,
  type BoardPlaceEffect,
  type BoardRemoveEffect,
} from '#game/boardEffects.ts'
import {
  builtPieceKeys,
  withoutBuildEffects,
} from '#react/map3d/buildEffects.ts'

const CAT_SEAT = 0
const BATCH_SEQUENCE = 7
const SAWMILL_CLEARING = 4
const WARRIOR_CLEARING = 2

function placeEffect(overrides: Partial<BoardPlaceEffect>): BoardPlaceEffect {
  return {
    kind: 'place',
    clearing: SAWMILL_CLEARING,
    step: 0,
    pieceIds: ['sawmill-1'],
    slot: NO_STACK_SLOT,
    stackCount: 1,
    owner: CAT_SEAT,
    pieceKind: 'building',
    pieceType: 'sawmill',
    count: 1,
    ...overrides,
  }
}

function removeEffect(): BoardRemoveEffect {
  return {
    kind: 'remove',
    clearing: WARRIOR_CLEARING,
    slot: NO_STACK_SLOT,
    owner: CAT_SEAT,
    pieceKind: 'warrior',
    count: 1,
  }
}

function batch(effects: readonly BoardEffect[]): BoardEffectBatch {
  return { sequence: BATCH_SEQUENCE, effects }
}

describe('builtPieceKeys', () => {
  it('names every building an update placed, by clearing and piece', () => {
    const keys: string[] = builtPieceKeys(
      batch([
        placeEffect({ pieceIds: ['sawmill-1', 'sawmill-2'], count: 2 }),
        removeEffect(),
      ]),
    )
    expect(keys).toEqual(['4-sawmill-1', '4-sawmill-2'])
  })

  it('leaves out placed pieces that are not buildings', () => {
    const recruited: BoardPlaceEffect = placeEffect({
      clearing: WARRIOR_CLEARING,
      pieceIds: ['warrior-1'],
      pieceKind: 'warrior',
    })
    expect(builtPieceKeys(batch([recruited]))).toEqual([])
  })
})

describe('withoutBuildEffects', () => {
  it('drops new buildings and keeps every other effect and the sequence', () => {
    const recruited: BoardPlaceEffect = placeEffect({
      clearing: WARRIOR_CLEARING,
      pieceIds: ['warrior-1'],
      pieceKind: 'warrior',
    })
    const removed: BoardRemoveEffect = removeEffect()
    expect(
      withoutBuildEffects(batch([placeEffect({}), recruited, removed])),
    ).toEqual({ sequence: BATCH_SEQUENCE, effects: [recruited, removed] })
  })
})
