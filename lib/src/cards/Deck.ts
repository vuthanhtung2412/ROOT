import { EP_CARD_DEFS } from './ep.generated.js'
import type { Card } from './types.js'
import type { CardDef } from './types.js'
import { VIZIER_DEF, VIZIER_DEF_ID } from '../factions/eyrie/viziers.js'

export type DeckState = {
  draw: Card[]
  discard: Card[]
}

export function defOf(card: Card): CardDef {
  if (card.defId === VIZIER_DEF_ID) return VIZIER_DEF
  const def = EP_CARD_DEFS.find((d) => d.defId === card.defId)
  if (!def) throw new Error(`unknown card def ${card.defId}`)
  return def
}

export class Deck {
  /** Draw n cards; empty draw pile → shuffle discard (dominance stays out). */
  static draw(
    deck: DeckState,
    n: number,
    opts: {
      shuffle: (cards: Card[]) => Card[]
      onDominance?: (card: Card) => void
    },
  ): Card[] {
    const out: Card[] = []
    for (let i = 0; i < n; i++) {
      if (deck.draw.length === 0) {
        if (deck.discard.length === 0) break
        deck.draw = opts.shuffle(deck.discard)
        deck.discard = []
      }
      const card = deck.draw.pop()
      if (!card) break
      out.push(card)
    }
    return out
  }

  /** Discard; dominance cards route to dominanceAvailable via callback. Rule: Cards — dominance never discarded. */
  static discard(
    deck: DeckState,
    card: Card,
    opts?: { onDominance?: (card: Card) => void },
  ): void {
    if (defOf(card).type === 'dominance') {
      opts?.onDominance?.(card)
      return
    }
    deck.discard.push(card)
  }
}
