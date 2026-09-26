import { describe, expect, it } from 'vitest'
import { FALL_FORESTS } from '@root/lib/fall-metadata'
import {
  isVagabondBoardWithForest,
  type ForestPawnMarker,
} from '#game/forestLayout.ts'

describe('forestLayout helpers', () => {
  it('detects vagabond forest board', () => {
    expect(isVagabondBoardWithForest({ kind: 'vagabond', forest: 3 })).toBe(
      true,
    )
    expect(isVagabondBoardWithForest({ kind: 'vagabond', forest: null })).toBe(
      false,
    )
    expect(isVagabondBoardWithForest({ kind: 'marquise' })).toBe(false)
  })

  it('FALL_FORESTS corners available for polygon', () => {
    expect(FALL_FORESTS.length).toBe(7)
    expect(FALL_FORESTS[3]).toEqual([1, 5, 9, 10, 11])
  })
})

describe('ForestPawnMarker shape', () => {
  it('carries forest index + seat', () => {
    const marker: ForestPawnMarker = {
      forestIndex: 3,
      seat: 1,
      factionId: 'vagabond',
    }
    expect(marker.forestIndex).toBe(3)
  })
})
