import type { Card, CardDef } from '../../cards/types.js'

export const VIZIER_DEF_ID = 'VIZIER' as const

export const VIZIER_DEF: CardDef = {
  defId: VIZIER_DEF_ID,
  name: 'Loyal Vizier',
  suit: 'bird',
  type: 'persistent',
  cost: [],
  description: 'Eyrie Loyal Vizier — always bird; survives Purge.',
  image: '',
  copies: 2,
}

/** Synthetic Loyal Vizier cards (not in shared deck). Rule: Eyrie > Setup 4. */
export function makeViziers(): [Card, Card] {
  return [
    { id: 'vizier-0', defId: VIZIER_DEF_ID },
    { id: 'vizier-1', defId: VIZIER_DEF_ID },
  ]
}

export function isVizier(card: Card): boolean {
  return card.defId === VIZIER_DEF_ID
}
