import { describe, expect, it } from 'vitest'
import { FALL } from '../../map/fall.js'
import { FALL_LAYOUT } from '../fall.js'
import { toAscii } from './ascii.js'

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
})