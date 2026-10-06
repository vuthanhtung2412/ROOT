import { describe, expect, it } from 'vitest'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import {
  clearingHasRuin,
  clearingMarkersGoAbove,
  clearingOpenSlotCount,
  FALL_CLEARING_SLOT_COUNTS,
  RUIN_MARKER_TEXTURE_KEY,
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
      clearingOpenSlotCount(5, {
        pieces: [],
        ruin: { items: [] },
      }),
    ).toBe(1)
    expect(
      clearingOpenSlotCount(10, {
        pieces: [],
      }),
    ).toBe(3)
  })
})

describe('RUIN_MARKER_TEXTURE_KEY', () => {
  it('matches gameAssets markerRuin key', () => {
    expect(RUIN_MARKER_TEXTURE_KEY).toBe(GAME_ASSET_KEYS.markerRuin)
  })
})

describe('clearingMarkersGoAbove', () => {
  const map = { top: 100, height: 400 }

  it('keeps markers below for a clearing in the upper part of the map', () => {
    expect(clearingMarkersGoAbove(250, map)).toBe(false)
  })

  it('moves markers above for a clearing in the bottom band', () => {
    expect(clearingMarkersGoAbove(450, map)).toBe(true)
  })
})
