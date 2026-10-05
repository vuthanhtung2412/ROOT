import { describe, expect, it } from 'vitest'
import { coverScaleForBounds } from '#ui/sceneBackdrop.ts'

describe('coverScaleForBounds', () => {
  it('scales up to fill wider bounds', () => {
    expect(coverScaleForBounds(100, 100, 200, 100)).toBe(2)
  })

  it('scales up to fill taller bounds', () => {
    expect(coverScaleForBounds(100, 100, 100, 200)).toBe(2)
  })

  it('picks the larger axis scale for mismatch', () => {
    expect(coverScaleForBounds(1920, 1080, 1280, 720)).toBeCloseTo(1280 / 1920)
  })
})
