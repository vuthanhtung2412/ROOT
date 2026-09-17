import { Deck } from '../cards/Deck.js'
import type { CardEffect } from '../triggers/effects.js'
import { playerOf } from '../queries/seat.js'

export const murineBrokerEffect: CardEffect = {
  defId: 'ROOT-85',
  onSignal(state, signal, ctx) {
    if (signal.s !== 'craft.item') return
    const owner = state.players.find((p) =>
      p.playArea.some((c) => c.defId === 'ROOT-85'),
    )
    if (!owner || owner.seat === signal.actor) return
    const drawn = Deck.draw(state.deck, 1, {
      shuffle: (cards) => cards,
      onDominance: (card) => state.dominanceAvailable.push(card),
    })
    playerOf(state, owner.seat).hand.push(...drawn)
    if (drawn.length > 0) ctx.emit({ s: 'draw', actor: owner.seat, count: drawn.length })
  },
}
