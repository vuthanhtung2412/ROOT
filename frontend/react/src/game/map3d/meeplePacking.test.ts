import { describe, expect, it } from 'vitest'
import {
  MEEPLE_PACK_SPACING,
  meeplePackOffsets,
} from '#game/map3d/meeplePacking.ts'

const HALF = 0.5
const EQUILATERAL_HALF_HEIGHT = Math.sqrt(3) * HALF

describe('meeplePackOffsets', () => {
  it('puts one meeple on the stack centre', () => {
    expect(meeplePackOffsets(1)).toEqual([{ x: 0, z: 0 }])
  })

  it('puts two meeples side by side', () => {
    expect(meeplePackOffsets(2)).toEqual([
      { x: -HALF * MEEPLE_PACK_SPACING, z: 0 },
      { x: HALF * MEEPLE_PACK_SPACING, z: 0 },
    ])
  })

  it('puts three meeples in a triangle (two front, one back)', () => {
    const baseOffset: number =
      (EQUILATERAL_HALF_HEIGHT / 3) * MEEPLE_PACK_SPACING
    const peakOffset: number =
      ((EQUILATERAL_HALF_HEIGHT * 2) / 3) * MEEPLE_PACK_SPACING
    expect(meeplePackOffsets(3)).toEqual([
      { x: -HALF * MEEPLE_PACK_SPACING, z: baseOffset },
      { x: HALF * MEEPLE_PACK_SPACING, z: baseOffset },
      { x: 0, z: -peakOffset },
    ])
  })

  it('puts four meeples in a square', () => {
    const half: number = HALF * MEEPLE_PACK_SPACING
    expect(meeplePackOffsets(4)).toEqual([
      { x: -half, z: -half },
      { x: half, z: -half },
      { x: -half, z: half },
      { x: half, z: half },
    ])
  })

  it('fills a centred grid when the stack is bigger than four', () => {
    const offsets = meeplePackOffsets(5)
    expect(offsets).toHaveLength(5)
    const centreX: number =
      offsets.reduce((sum: number, offset): number => sum + offset.x, 0) /
      offsets.length
    const centreZ: number =
      offsets.reduce((sum: number, offset): number => sum + offset.z, 0) /
      offsets.length
    expect(centreX).toBeCloseTo(0)
    expect(centreZ).toBeCloseTo(0)
  })
})
