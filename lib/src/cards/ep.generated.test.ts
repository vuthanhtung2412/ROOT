import { describe, expect, it } from 'vitest'
import { EP_CARD_DEFS } from './ep.generated.js'

describe('EP_CARD_DEFS', () => {
  it('has 54 copies across defs', () => {
    const copies = EP_CARD_DEFS.reduce((n, d) => n + d.copies, 0)
    expect(copies).toBe(54)
  })

  it('suit counts are 14/14/13/13 bird/fox/mouse/rabbit', () => {
    const counts = { bird: 0, fox: 0, mouse: 0, rabbit: 0 }
    for (const d of EP_CARD_DEFS) {
      counts[d.suit] += d.copies
    }
    expect(counts).toEqual({ bird: 14, fox: 14, mouse: 13, rabbit: 13 })
  })

  it('every item has vp', () => {
    for (const d of EP_CARD_DEFS) {
      if (d.type === 'item') {
        expect(d.vp, d.defId).toEqual(expect.any(Number))
        expect(d.vp!).toBeGreaterThan(0)
      }
    }
  })
})
