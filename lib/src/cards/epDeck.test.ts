import { describe, expect, it } from 'vitest'
import { EP_DECK, expandEpDeck } from './epDeck.js'

describe('EP_DECK', () => {
  it('expands to 54 cards with unique ids', () => {
    expect(EP_DECK).toHaveLength(54)
    expect(new Set(EP_DECK.map((c) => c.id)).size).toBe(54)
    expect(expandEpDeck()).toHaveLength(54)
  })
})
