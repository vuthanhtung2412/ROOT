import type { CardEffect } from '../triggers/effects.js'
import { playerOf } from '../queries/seat.js'

export const soupKitchensEffect: CardEffect = {
  defId: 'ROOT-97',
  hooks: {
    ruleWeight(state, piece) {
      if (piece.kind !== 'token') return 0
      const owner = playerOf(state, piece.owner)
      if (!owner.playArea.some((c) => c.defId === 'ROOT-97')) return 0
      return 2
    },
  },
}
