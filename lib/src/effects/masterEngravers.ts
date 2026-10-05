import { addVictoryPoints } from '#rules/dominance.js'
import type { CardEffect } from '#triggers/effects.js'

export const masterEngraversEffect: CardEffect = {
  defId: 'ROOT-82',
  onSignal(state, signal, ctx) {
    if (signal.s !== 'craft.item') return
    const owner = state.players.find((p) =>
      p.playArea.some((c) => c.defId === 'ROOT-82'),
    )
    if (!owner || owner.seat !== signal.actor) return
    const scored = addVictoryPoints(state, owner.seat, 1)
    if (scored > 0) ctx.emit({ s: 'vp', actor: owner.seat, delta: scored })
  },
}
