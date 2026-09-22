import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { CardSuit } from '#cards/types.js'
import type { Suit } from '#map/types.js'

/** Rule: Cards > Birds are wild — bird matches any suit; otherwise exact. */
export function matchesSuit(card: Card, suit: Suit | CardSuit): boolean {
  const cardSuit = defOf(card).suit
  if (cardSuit === 'bird') return true
  return cardSuit === suit
}
