import { describe, expect, it } from 'vitest'
import { Deck } from '#cards/Deck.js'
import { EP_DECK } from '#cards/epDeck.js'
import { EP_CARD_DEFS } from '#cards/ep.generated.js'

describe('Deck', () => {
  it('reshuffles discard when draw empty', () => {
    const a = EP_DECK[0]!
    const b = EP_DECK[1]!
    const deck: { draw: typeof EP_DECK; discard: typeof EP_DECK } = {
      draw: [],
      discard: [a, b],
    }
    const drawn = Deck.draw(deck, 2, { shuffle: (cards) => [...cards].reverse() })
    expect(drawn).toHaveLength(2)
    expect(deck.discard).toHaveLength(0)
  })

  it('routes dominance to dominanceAvailable', () => {
    const domDef = EP_CARD_DEFS.find((d) => d.type === 'dominance')!
    const card = { id: `${domDef.defId}#1`, defId: domDef.defId }
    const deck: { draw: typeof EP_DECK; discard: typeof EP_DECK } = {
      draw: [],
      discard: [],
    }
    const available: typeof EP_DECK = []
    Deck.discard(deck, card, { onDominance: (c) => available.push(c) })
    expect(deck.discard).toHaveLength(0)
    expect(available).toEqual([card])
  })
})
