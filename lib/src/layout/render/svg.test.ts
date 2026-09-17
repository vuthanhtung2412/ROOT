import { describe, expect, it } from 'vitest'
import { FALL } from '../../map/fall.js'
import { FALL_LAYOUT } from '../fall.js'
import { toSvg } from './svg.js'

describe('toSvg', () => {
  it('renders fall map with 12 clearing labels', () => {
    const svg = toSvg(FALL, FALL_LAYOUT)
    expect(svg).toContain('<svg')
    expect(svg).toContain(FALL_LAYOUT.image)
    for (let i = 0; i < 12; i++) {
      expect(svg).toContain(`>${i}</text>`)
    }
  })
})
