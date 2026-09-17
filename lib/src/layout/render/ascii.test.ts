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
})
