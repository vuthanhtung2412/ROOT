import { describe, expect, it } from 'vitest'
import {
  marchArrivalShare,
  marchTiming,
  MARCH_MAXIMUM_PIECE_COUNT,
  MOVE_SLIDE_MS,
  type MarchTiming,
} from '#react/boardEffectTiming.ts'

/** First piece leaving to last piece arriving. */
function marchDuration(timing: MarchTiming): number {
  return (timing.pieceCount - 1) * timing.stepMs + timing.travelMs
}

describe('marchArrivalShare', () => {
  it('has a piece at the start, the middle and the end on time', () => {
    const middle = 0.5

    expect(marchArrivalShare(0)).toBeCloseTo(0)
    expect(marchArrivalShare(middle)).toBeCloseTo(middle)
    expect(marchArrivalShare(1)).toBeCloseTo(1)
  })

  it('reaches the first stretch late: the piece starts slowly', () => {
    const earlyWayShare = 0.1

    expect(marchArrivalShare(earlyWayShare)).toBeGreaterThan(earlyWayShare)
  })
})

describe('marchTiming', () => {
  it('walks one piece per piece moved', () => {
    const movedCount = 4

    expect(marchTiming(movedCount).pieceCount).toBe(movedCount)
  })

  it('takes the same time for a move of any size', () => {
    const movedCounts: readonly number[] = [1, 2, 5, MARCH_MAXIMUM_PIECE_COUNT]

    for (const movedCount of movedCounts) {
      expect(marchDuration(marchTiming(movedCount))).toBeCloseTo(MOVE_SLIDE_MS)
    }
  })

  it('sends a lone piece off at once, on its way for the whole move', () => {
    expect(marchTiming(1)).toEqual({
      pieceCount: 1,
      stepMs: 0,
      travelMs: MOVE_SLIDE_MS,
    })
  })

  it('caps a huge army at the longest line', () => {
    const hugeArmy = 25

    const timing: MarchTiming = marchTiming(hugeArmy)

    expect(timing.pieceCount).toBe(MARCH_MAXIMUM_PIECE_COUNT)
    expect(marchDuration(timing)).toBeCloseTo(MOVE_SLIDE_MS)
  })
})
