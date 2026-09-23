import { describe, expect, it } from 'vitest'
import {
  clearingHasRuin,
  clearingOpenSlotCount,
  FALL_CLEARING_SLOT_COUNTS,
  RUIN_MARKER_LABEL,
} from '#game/clearingIndicators.ts'

describe('clearingHasRuin', () => {
  it('true when ruin items remain', () => {
    expect(clearingHasRuin({ ruin: { items: ['boot'] } })).toBe(true)
  })

  it('false when ruin empty or missing', () => {
    expect(clearingHasRuin({ ruin: { items: [] } })).toBe(false)
    expect(clearingHasRuin({})).toBe(false)
    expect(clearingHasRuin(undefined)).toBe(false)
  })
})

describe('clearingOpenSlotCount', () => {
  it('matches lib slot math for buildings and ruins', () => {
    expect(FALL_CLEARING_SLOT_COUNTS[0]).toBe(1)
    expect(
      clearingOpenSlotCount(0, {
        pieces: [{ kind: 'building' }],
      }),
    ).toBe(0)
    expect(
      clearingOpenSlotCount(5, {
        pieces: [{ kind: 'building' }],
        ruin: { items: ['boot'] },
      }),
    ).toBe(0)
    expect(
      clearingOpenSlotCount(5, {
        pieces: [],
        ruin: { items: ['boot'] },
      }),
    ).toBe(1)
    expect(
      clearingOpenSlotCount(10, {
        pieces: [],
      }),
    ).toBe(3)
  })
})

describe('RUIN_MARKER_LABEL', () => {
  it('is single R badge', () => {
    expect(RUIN_MARKER_LABEL).toBe('R')
  })
})
