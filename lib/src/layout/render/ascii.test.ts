import { describe, expect, it } from 'vitest'
import { FALL } from '#map/fall.js'
import { FALL_LAYOUT } from '#layout/fall.js'
import { toAscii } from '#layout/render/ascii.js'

describe('toAscii', () => {
  it('places all clearing ids on the grid', () => {
    const ascii = toAscii(FALL, FALL_LAYOUT)
    for (let i = 0; i < 12; i++) {
      expect(ascii).toContain(i.toString(16).toUpperCase())
    }
  })

  it('showSuit appends F/R/M to clearing ids', () => {
    const ascii = toAscii(FALL, FALL_LAYOUT, { width: 56, height: 22, showSuit: true })
    expect(ascii).toContain('0F')
    expect(ascii).toContain('1M')
    expect(ascii).toContain('2R')
  })

  it('showForests places f# at centroids; V# when occupied', () => {
    const empty = toAscii(FALL, FALL_LAYOUT, {
      width: 64,
      height: 26,
      showSuit: true,
      showForests: true,
    })
    expect(empty).toContain('[f0]')
    expect(empty).toContain('[f3]')
    expect(empty).toContain(':')
    expect(empty).toContain('+')
    expect(empty).not.toContain('[V3]')

    const occupied = toAscii(FALL, FALL_LAYOUT, {
      width: 64,
      height: 26,
      showSuit: true,
      showForests: true,
      occupiedForests: new Map([[3, 'V']]),
    })
    expect(occupied).toContain('[V3]')
    expect(occupied).toContain('*')
    expect(occupied).not.toContain('[f3]')
  })
})