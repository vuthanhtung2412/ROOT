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

describe('FALL_LAYOUT Autumn alignment', () => {
  it('has a layout entry for every clearing id', () => {
    for (const clearing of FALL.clearings) {
      expect(FALL_LAYOUT.clearings[clearing.id]).toBeDefined()
    }
  })

  it('keeps markers inside the woodland (above VP track)', () => {
    for (const [id, point] of Object.entries(FALL_LAYOUT.clearings)) {
      expect(point.x, `clearing ${id} x`).toBeGreaterThan(0.05)
      expect(point.x, `clearing ${id} x`).toBeLessThan(0.95)
      expect(point.y, `clearing ${id} y`).toBeGreaterThan(0.08)
      expect(point.y, `clearing ${id} y`).toBeLessThan(0.82)
      expect(point.r, `clearing ${id} r`).toBeGreaterThan(0.03)
      expect(point.r, `clearing ${id} r`).toBeLessThan(0.08)
    }
  })

  it('places corners in their map quadrants', () => {
    const [northwest, northeast, southeast, southwest] = FALL.corners
    expect(FALL_LAYOUT.clearings[northwest]!.x).toBeLessThan(0.35)
    expect(FALL_LAYOUT.clearings[northwest]!.y).toBeLessThan(0.35)
    expect(FALL_LAYOUT.clearings[northeast]!.x).toBeGreaterThan(0.65)
    expect(FALL_LAYOUT.clearings[northeast]!.y).toBeLessThan(0.35)
    expect(FALL_LAYOUT.clearings[southeast]!.x).toBeGreaterThan(0.65)
    expect(FALL_LAYOUT.clearings[southeast]!.y).toBeGreaterThan(0.55)
    expect(FALL_LAYOUT.clearings[southwest]!.x).toBeLessThan(0.35)
    expect(FALL_LAYOUT.clearings[southwest]!.y).toBeGreaterThan(0.55)
  })

  it('keeps hub clearing 11 more central than corners', () => {
    const hub = FALL_LAYOUT.clearings[11]!
    expect(hub.x).toBeGreaterThan(0.3)
    expect(hub.x).toBeLessThan(0.55)
    expect(hub.y).toBeGreaterThan(0.4)
    expect(hub.y).toBeLessThan(0.65)
  })
})
