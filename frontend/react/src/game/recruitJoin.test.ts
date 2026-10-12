import { describe, expect, it } from 'vitest'
import {
  NO_STACK_SLOT,
  PLACE_STEP_MS,
  type BoardPlaceEffect,
} from '#game/boardEffects.ts'
import {
  joinsStandingWarriors,
  placementHoldMs,
  RECRUIT_JOIN_MS,
} from '#game/recruitJoin.ts'

const CAT_SEAT = 0
const STANDING_AND_RECRUIT_COUNT = 3
const LATER_STEP = 2

function placeEffect(overrides: Partial<BoardPlaceEffect>): BoardPlaceEffect {
  return {
    kind: 'place',
    clearing: 0,
    step: 0,
    pieceIds: ['recruit'],
    slot: NO_STACK_SLOT,
    stackCount: 1,
    owner: CAT_SEAT,
    pieceKind: 'warrior',
    count: 1,
    ...overrides,
  }
}

describe('joinsStandingWarriors', () => {
  it('is true for a recruit placed where warriors of its own stand', () => {
    expect(
      joinsStandingWarriors(
        placeEffect({ stackCount: STANDING_AND_RECRUIT_COUNT }),
      ),
    ).toBe(true)
  })

  it('is false for warriors placed where none of theirs stood', () => {
    expect(
      joinsStandingWarriors(placeEffect({ count: 2, stackCount: 2 })),
    ).toBe(false)
  })

  it('is false for a token added to a stack of tokens', () => {
    expect(
      joinsStandingWarriors(
        placeEffect({
          pieceKind: 'token',
          pieceType: 'wood',
          stackCount: STANDING_AND_RECRUIT_COUNT,
        }),
      ),
    ).toBe(false)
  })
})

describe('placementHoldMs', () => {
  it('puts a first placement on the board at once', () => {
    expect(placementHoldMs(placeEffect({}))).toBe(0)
  })

  it('holds a later placement back until its step starts', () => {
    expect(placementHoldMs(placeEffect({ step: LATER_STEP }))).toBe(
      LATER_STEP * PLACE_STEP_MS,
    )
  })

  it('holds a recruit back until it has joined its stack', () => {
    expect(
      placementHoldMs(placeEffect({ stackCount: STANDING_AND_RECRUIT_COUNT })),
    ).toBe(RECRUIT_JOIN_MS)
  })

  it('holds a later recruit back for its step and its walk', () => {
    expect(
      placementHoldMs(
        placeEffect({
          step: LATER_STEP,
          stackCount: STANDING_AND_RECRUIT_COUNT,
        }),
      ),
    ).toBe(LATER_STEP * PLACE_STEP_MS + RECRUIT_JOIN_MS)
  })
})
