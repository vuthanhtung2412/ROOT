import { describe, expect, it } from 'vitest'
import {
  clearingHasRuin,
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

describe('RUIN_MARKER_LABEL', () => {
  it('is single R badge', () => {
    expect(RUIN_MARKER_LABEL).toBe('R')
  })
})
