import { describe, expect, it } from 'vitest'
import {
  NO_STACK_SLOT,
  PLACE_STEP_MS,
  type BoardMoveEffect,
  type BoardPlaceEffect,
} from '#game/boardEffects.ts'
import {
  joinsStandingWarriors,
  moveHoldMs,
  placementHoldMs,
  RECRUIT_JOIN_MS,
} from '#game/recruitJoin.ts'
import { MOVE_SLIDE_MS } from '#react/boardEffectTiming.ts'

const CAT_SEAT = 0
const STANDING_AND_RECRUIT_COUNT = 3
const STANDING_AND_MOVED_COUNT = 3
const FOREST_INDEX = 2
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

function moveEffect(overrides: Partial<BoardMoveEffect>): BoardMoveEffect {
  return {
    kind: 'move',
    from: 0,
    to: 1,
    step: 0,
    fromSlot: NO_STACK_SLOT,
    toSlot: NO_STACK_SLOT,
    pieceIds: ['marcher'],
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

describe('moveHoldMs', () => {
  it('puts warriors moved into a clearing with none of theirs on the board at once', () => {
    expect(moveHoldMs(moveEffect({}))).toBe(0)
  })

  it('holds warriors back until they have walked into the stack they join', () => {
    expect(
      moveHoldMs(moveEffect({ stackCount: STANDING_AND_MOVED_COUNT })),
    ).toBe(MOVE_SLIDE_MS)
  })

  it('holds a later move back for the moves before it and its own walk', () => {
    expect(
      moveHoldMs(
        moveEffect({ step: LATER_STEP, stackCount: STANDING_AND_MOVED_COUNT }),
      ),
    ).toBe(LATER_STEP * MOVE_SLIDE_MS + MOVE_SLIDE_MS)
  })

  it('holds nothing back for a pawn that slips into a forest', () => {
    expect(
      moveHoldMs(
        moveEffect({
          toForest: FOREST_INDEX,
          stackCount: STANDING_AND_MOVED_COUNT,
        }),
      ),
    ).toBe(0)
  })
})
