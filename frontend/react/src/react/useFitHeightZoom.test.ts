import { describe, expect, it } from 'vitest'
import { fitHeightZoom } from '#react/useFitHeightZoom.ts'

describe('fitHeightZoom', () => {
  it('stays unscaled when the content already fits', () => {
    expect(fitHeightZoom(1000, 600)).toBe(1)
  })

  it('shrinks a taller content into the frame, minus the stage padding share', () => {
    expect(fitHeightZoom(700, 880)).toBeCloseTo(0.7)
  })

  it('stops shrinking at the minimum zoom: the stage scrolls past it', () => {
    expect(fitHeightZoom(300, 1000)).toBe(0.6)
  })

  it('stays unscaled before anything is laid out', () => {
    expect(fitHeightZoom(0, 600)).toBe(1)
    expect(fitHeightZoom(700, 0)).toBe(1)
  })
})
