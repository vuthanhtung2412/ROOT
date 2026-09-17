import { EP_CARD_DEFS } from './ep.generated.js'
import type { Card } from './types.js'

/** Expand defs by `copies` into 54 physical cards. */
export function expandEpDeck(): Card[] {
  const cards: Card[] = []
  for (const def of EP_CARD_DEFS) {
    for (let n = 1; n <= def.copies; n++) {
      cards.push({ id: `${def.defId}#${n}`, defId: def.defId })
    }
  }
  return cards
}

export const EP_DECK: Card[] = expandEpDeck()
